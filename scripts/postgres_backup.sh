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

    # Perform backup
    if [ -n "${POSTGRES_DATABASE:-}" ]; then
        # Backup specific database with PostgreSQL equivalent of --add-drop-database
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
    else
        # Backup all databases
        if ! pg_dumpall \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            --clean | gzip >"$temp_file"; then
            rm -f "$temp_file"
            error "PostgreSQL backup failed during pg_dumpall"
        fi
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

    # For PostgreSQL, always restore to postgres maintenance database
    # This allows the dump's DROP DATABASE and CREATE DATABASE commands to work properly
    if [ -n "${POSTGRES_DATABASE:-}" ]; then
        log "Restoring specific database: $POSTGRES_DATABASE (connecting to postgres maintenance DB)"
    else
        log "Restoring all databases"
    fi

    if ! gunzip -c "$temp_file" |
        psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" -d postgres; then
        rm -f "$temp_file"
        error "PostgreSQL restore failed during database import"
    fi

    # Cleanup
    rm -f "$temp_file"
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
