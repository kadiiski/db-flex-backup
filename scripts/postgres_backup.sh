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
    *)
        echo "PostgreSQL backup handler"
        echo "Usage: postgres_backup.sh <command> [args]"
        echo
        echo "Commands:"
        echo "  list                    List available backups"
        echo "  backup                  Create a new PostgreSQL backup"
        echo "  restore <filename>      Restore from a specific backup file"
        exit 1
        ;;
    esac
}

# If called directly, handle the command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    handle_postgres_command "$@"
fi
