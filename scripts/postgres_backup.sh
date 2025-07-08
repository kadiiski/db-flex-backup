#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# PostgreSQL backup handler - mirrors MySQL functionality
# Sources common utilities from utils.sh

# Source common utilities
source "/usr/local/bin/utils.sh"

# ---- POSTGRESQL CONFIGURATION ----
: "${POSTGRES_HOST:?   Need POSTGRES_HOST}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?   Need POSTGRES_USER}"
: "${POSTGRES_PASSWORD:?Need POSTGRES_PASSWORD}"
: "${POSTGRES_DATABASE:-}" # optional; if empty dumps all

export PGPASSWORD="$POSTGRES_PASSWORD"

check_postgres_requirements() {
    local missing_deps=()

    # Check for required PostgreSQL commands
    for cmd in pg_dump pg_dumpall psql; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required PostgreSQL commands: ${missing_deps[*]}"
    fi

    # Check AWS requirements
    check_aws_requirements
}

perform_postgres_backup() {
    local timestamp=$(date +'%Y-%m-%d_%H-%M-%S')
    local file="backup-$timestamp.sql.gz"
    local temp_file="/tmp/$file"

    log "Starting PostgreSQL database backup to s3://$S3_BUCKET/$S3_PREFIX/$file ..."

    # Validate that POSTGRES_DATABASE is set
    if [ -z "${POSTGRES_DATABASE:-}" ]; then
        error "POSTGRES_DATABASE environment variable must be set for backup."
    fi

    # Perform backup for specific database only
    if ! pg_dump \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DATABASE" \
        --clean \
        --create \
        --if-exists | gzip >"$temp_file"; then
        rm -f "$temp_file"
        error "PostgreSQL backup failed during pg_dump"
    fi

    # Upload to S3
    upload_to_s3 "$temp_file" "$file"

    rm -f "$temp_file"
    success "PostgreSQL backup completed successfully: $file"
}

perform_postgres_restore() {
    local file="$1"
    local temp_file="/tmp/$file"

    if [ -z "$file" ]; then
        error "you must specify a backup file to restore"
    fi

    log "Downloading $file and restoring to PostgreSQL database..."

    # Download from S3
    download_from_s3 "$file" "$temp_file"

    log "Restoring specific database: $POSTGRES_DATABASE"

    # Generate a random temp database name
    TEMPDB="tempdb_restore_$(date +%s)_$RANDOM"

    # Create the temp database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "\
        CREATE DATABASE $TEMPDB;\
    " >/dev/null 2>&1; then
        error "Failed to create temporary database"
    fi

    # Block new connections to the target database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEMPDB" -c "\
        ALTER DATABASE \"$POSTGRES_DATABASE\"\
            WITH CONNECTION LIMIT 0;\
    " >/dev/null 2>&1; then
        error "Failed to block new connections to the target database"
    fi

    # Terminate existing connections to the target database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEMPDB" -c "\
        SELECT pg_terminate_backend(pid)\
        FROM pg_stat_activity\
        WHERE datname = '$POSTGRES_DATABASE'\
          AND pid <> pg_backend_pid();\
    " >/dev/null 2>&1; then
        error "Failed to terminate existing connections to the target database"
    fi

    # Drop the target database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEMPDB" -c "\
        DROP DATABASE \"$POSTGRES_DATABASE\";\
    " >/dev/null 2>&1; then
        error "Failed to drop the target database"
    fi

    # Recreate the target database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEMPDB" -c "\
        CREATE DATABASE \"$POSTGRES_DATABASE\";\
    " >/dev/null 2>&1; then
        error "Failed to recreate the target database"
    fi

    # Restore the backup to the target database
    if ! gunzip -c "$temp_file" |
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE"; then
        rm -f "$temp_file"
        error "PostgreSQL restore failed during database import"
    fi

    # Restore connection limit
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$TEMPDB" -c "\
        ALTER DATABASE \"$POSTGRES_DATABASE\"\
            WITH CONNECTION LIMIT -1;\
    " >/dev/null 2>&1; then
        error "Failed to restore connection limit"
    fi

    # Cleanup
    rm -f "$temp_file"

    # Drop the temp database
    if ! psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "DROP DATABASE $TEMPDB;" >/dev/null 2>&1; then
        error "Failed to drop the temp database"
    fi

    success "PostgreSQL restore completed successfully: $file"
}

check_postgres_login() {
    local user=""
    local password=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --user)
                user="$2"; shift 2;;
            --password)
                password="$2"; shift 2;;
            *)
                echo "Unknown argument: $1" >&2; return 1;;
        esac
    done

    # Validate arguments
    if [[ -z "$user" || -z "$password" ]]; then
        echo "false"
        return 1
    fi

    PGPASSWORD="$password" psql \
        -h "$POSTGRES_HOST" \
        -p "$POSTGRES_PORT" \
        -U "$user" \
        -d "$POSTGRES_DATABASE" \
        -c "\q" >/dev/null 2>&1
    if [[ $? -eq 0 ]]; then
        echo "true"
        return 0
    else
        echo "false"
        return 1
    fi
}

# Main PostgreSQL backup handler function
handle_postgres_command() {
    # Check requirements before proceeding
    check_postgres_requirements

    case "${1:-}" in
    list)
        list_backups
        ;;
    backup)
        perform_postgres_backup
        enforce_retention
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            error "Restore command requires a backup filename"
        fi
        perform_postgres_restore "$2"
        ;;
    check-login)
        shift
        check_postgres_login "$@"
        ;;
    download)
        if [ -z "${2:-}" ]; then
            error "Download command requires a s3 filename"
        fi
        if [ -z "${3:-}" ]; then
            error "Download command requires a temp filename"
        fi
        download_from_s3 "$2" "$3"
        ;;
    upload)
        if [ -z "${2:-}" ]; then
            error "Upload command requires a temp filedir"
        fi
        local timestamp=$(date +'%Y-%m-%d_%H-%M-%S')
        local file="backup-$timestamp.sql.gz"
        upload_to_s3 "$2" "$file"
        enforce_retention
        ;;
    *)
        echo "PostgreSQL backup handler"
        echo "Usage: postgres_backup.sh <command> [args]"
        echo
        echo "Commands:"
        echo "  list                    List available backups"
        echo "  backup                  Create a new PostgreSQL backup"
        echo "  restore <filename>      Restore from a specific backup file"
        echo "  check-login             Check PostgreSQL login"
        echo "  download <s3 filename> <temp filename>     Download a backup file from S3"
        echo "  upload <temp filename>  Upload a backup file to S3"
        exit 1
        ;;
    esac
}

# If called directly, handle the command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    handle_postgres_command "$@"
fi
