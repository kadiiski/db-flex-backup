#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# A script for backing up and restoring MySQL databases to/from S3 storage.
# Supports full database backups and specific database backups.
#
# Examples:
#   # List available backups
#   ./backup.sh list
#
#   # Backup entire database
#   ./backup.sh backup
#
#   # Backup specific database
#   MYSQL_DATABASE=myapp ./backup.sh backup
#
#   # Restore from a specific backup
#   ./backup.sh restore backup-2024-05-21_10-30-00.sql.gz
#
# Required environment variables:
#   MYSQL_HOST         - MySQL server hostname
#   MYSQL_USER         - MySQL username
#   MYSQL_PASSWORD     - MySQL password
#   S3_BUCKET         - S3 bucket name
#   AWS_ENDPOINT_URL  - S3 endpoint URL
#   AWS_ACCESS_KEY_ID - AWS access key
#   AWS_SECRET_ACCESS_KEY - AWS secret key
#
# Optional environment variables:
#   MYSQL_PORT        - MySQL port (default: 3306)
#   MYSQL_DATABASE    - Specific database to backup (default: all databases)
#   S3_PREFIX         - S3 prefix/path (default: mysql)
#   RETENTION_COUNT   - Number of backups to keep (default: 7)

# ---- TRAP HANDLING ----
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Script failed with exit code $exit_code"
    fi
    exit $exit_code
}

trap cleanup EXIT
trap 'error "Script interrupted by user"' INT TERM

# ---- CONFIGURATION (via env vars) ----
: "${MYSQL_HOST:?   Need MYSQL_HOST}"
: "${MYSQL_PORT:=3306}"
: "${MYSQL_USER:?   Need MYSQL_USER}"
: "${MYSQL_PASSWORD:?Need MYSQL_PASSWORD}"
: "${MYSQL_DATABASE:-}" # optional; if empty dumps all

: "${S3_BUCKET:?        Need S3_BUCKET}"
: "${S3_PREFIX:=mysql}" # e.g. 'mysql-backups'
: "${AWS_ENDPOINT_URL:?Need AWS_ENDPOINT_URL}"
: "${AWS_ACCESS_KEY_ID:?    Need AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Need AWS_SECRET_ACCESS_KEY}"
: "${RETENTION_COUNT:=7}" # how many to keep

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

# ---- HELPER FUNCTIONS ----
log() {
    # Write to stdout for container logs
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ℹ️  $*" >&1
}

success() {
    # Write success messages to stdout
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ✅ $*" >&1
}

error() {
    # Write errors to stderr for container logs
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ❌ ERROR: $*" >&2
    exit 1
}

check_requirements() {
    local missing_deps=()

    # Check for required commands
    for cmd in mysqldump mysql aws gzip; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required commands: ${missing_deps[*]}"
    fi
}

# ---- BACKUP FUNCTIONS ----
list_backups() {
    log "Listing available backups in s3://$S3_BUCKET/$S3_PREFIX/:"
    aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --endpoint-url "$AWS_ENDPOINT_URL" | grep "backup-" | sort -r
}

perform_backup() {
    local timestamp=$(date +'%Y-%m-%d_%H-%M-%S')
    local file="backup-$timestamp.sql.gz"
    local temp_file="/tmp/$file"

    log "Starting database backup to s3://$S3_BUCKET/$S3_PREFIX/$file ..."

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
        error "Backup failed during mysqldump"
    fi

    # Upload to S3
    if ! aws s3 cp "$temp_file" "s3://$S3_BUCKET/$S3_PREFIX/$file" --endpoint-url "$AWS_ENDPOINT_URL"; then
        rm -f "$temp_file"
        error "Backup failed during S3 upload"
    fi

    rm -f "$temp_file"
    success "Backup completed successfully: $file"
}

enforce_retention() {
    log "Checking backup retention policy (keeping latest $RETENTION_COUNT backups)..."

    local backups
    backups=$(aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --endpoint-url "$AWS_ENDPOINT_URL" |
        grep "backup-" |
        awk '{print $4}' |
        sort)

    if [ -z "$backups" ]; then
        log "No existing backups found."
        return
    fi

    local count
    count=$(echo "$backups" | wc -l)

    if [ "$count" -le "$RETENTION_COUNT" ]; then
        log "Found $count backups, which is within retention limit of $RETENTION_COUNT. No cleanup needed."
        return
    fi

    local del_count=$((count - RETENTION_COUNT))
    log "Found $count backups. Removing $del_count oldest backups to maintain retention limit..."

    echo "$backups" | head -n "$del_count" | while read -r old; do
        log "Removing old backup: $old"
        if ! aws s3 rm "s3://$S3_BUCKET/$S3_PREFIX/$old" --endpoint-url "$AWS_ENDPOINT_URL"; then
            error "Failed to remove backup: $old"
        fi
    done

    success "Retention cleanup completed. Kept $RETENTION_COUNT most recent backups."
}

perform_restore() {
    local file="$1"
    local temp_file="/tmp/$file"

    if [ -z "$file" ]; then
        error "you must specify a backup file to restore"
    fi

    log "Downloading $file and restoring to database..."

    # Download from S3
    if ! aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/$file" "$temp_file" --endpoint-url "$AWS_ENDPOINT_URL"; then
        rm -f "$temp_file"
        error "Failed to download backup from S3"
    fi

    # Restore to database
    if ! gunzip -c "$temp_file" |
        mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" \
            -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" \
            ${MYSQL_DATABASE:+--database="$MYSQL_DATABASE"}; then
        rm -f "$temp_file"
        error "Restore failed during database import"
    fi

    # Cleanup
    rm -f "$temp_file"
    success "Restore completed successfully: $file"
}

# ---- MAIN ----
main() {
    # Check requirements before proceeding
    check_requirements

    case "${1:-}" in
    list)
        list_backups
        ;;
    backup)
        perform_backup
        enforce_retention
        ;;
    restore)
        if [ -z "${2:-}" ]; then
            error "Restore command requires a backup filename"
        fi
        perform_restore "$2"
        ;;
    *)
        echo "Usage: $0 <command> [args]"
        echo
        echo "Commands:"
        echo "  list                    List available backups"
        echo "  backup                  Create a new backup"
        echo "  restore <filename>      Restore from a specific backup file"
        exit 1
        ;;
    esac
}

main "$@"
