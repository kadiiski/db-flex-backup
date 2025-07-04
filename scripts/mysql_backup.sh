#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# MySQL backup handler - preserves exact current implementation
# Sources common utilities from utils.sh

# Source common utilities
source "/usr/local/bin/utils.sh"

# ---- MYSQL CONFIGURATION ----
: "${MYSQL_HOST:?   Need MYSQL_HOST}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:?   Need MYSQL_USER}"
: "${MYSQL_PASSWORD:?Need MYSQL_PASSWORD}"
: "${MYSQL_DATABASE:-}" # optional; if empty dumps all

check_mysql_requirements() {
    local missing_deps=()

    # Check for required MySQL commands
    for cmd in mysqldump mysql; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required MySQL commands: ${missing_deps[*]}"
    fi

    # Check AWS requirements
    check_aws_requirements
}

perform_mysql_backup() {
    local timestamp=$(date +'%Y-%m-%d_%H-%M-%S')
    local file="backup-$timestamp.sql.gz"
    local temp_file="/tmp/$file"

    log "Starting MySQL database backup to s3://$S3_BUCKET/$S3_PREFIX/$file ..."

    # Build mysqldump options in an array
    local dump_opts=()
    dump_opts+=(--add-drop-database)

    if [ -n "${MYSQL_DATABASE:-}" ]; then
        dump_opts+=(--databases)
        dump_opts+=("$MYSQL_DATABASE")
    else
        dump_opts+=(--all-databases)
    fi

    # Perform backup
    if ! mysqldump \
        -h "$MYSQL_HOST" \
        -P "$MYSQL_PORT" \
        -u "$MYSQL_USER" \
        -p"$MYSQL_PASSWORD" \
        "${dump_opts[@]}" | gzip >"$temp_file"; then
        rm -f "$temp_file"
        error "MySQL backup failed during mysqldump"
    fi

    # Upload to S3
    upload_to_s3 "$temp_file" "$file"

    rm -f "$temp_file"
    success "MySQL backup completed successfully: $file"
}

perform_mysql_restore() {
    local file="$1"
    local temp_file="/tmp/$file"

    if [ -z "$file" ]; then
        error "you must specify a backup file to restore"
    fi

    log "Downloading $file and restoring to MySQL database..."

    # Download from S3
    download_from_s3 "$file" "$temp_file"

    # Restore to database
    if ! gunzip -c "$temp_file" |
        mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" \
            -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
            ${MYSQL_DATABASE:+--database="$MYSQL_DATABASE"}; then
        rm -f "$temp_file"
        error "MySQL restore failed during database import"
    fi

    # Cleanup
    rm -f "$temp_file"
    success "MySQL restore completed successfully: $file"
}

# Main MySQL backup handler function
handle_mysql_command() {
    # Check requirements before proceeding
    check_mysql_requirements

    case "${1:-}" in
    list)
        list_backups
        ;;
    backup)
        perform_mysql_backup
        enforce_retention
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            error "Restore command requires a backup filename"
        fi
        perform_mysql_restore "$2"
        ;;
    *)
        echo "MySQL backup handler"
        echo "Usage: mysql_backup.sh <command> [args]"
        echo
        echo "Commands:"
        echo "  list                    List available backups"
        echo "  backup                  Create a new MySQL backup"
        echo "  restore <filename>      Restore from a specific backup file"
        exit 1
        ;;
    esac
}

# If called directly, handle the command
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    handle_mysql_command "$@"
fi
