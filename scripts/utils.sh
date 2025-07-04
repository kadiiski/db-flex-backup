#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Common utility functions for database backup operations
# Shared between MySQL and PostgreSQL backup handlers

# ---- COMMON CONFIGURATION ----
: "${S3_BUCKET:?        Need S3_BUCKET}"
: "${S3_PREFIX:=backups}" # e.g. 'mysql-backups' or 'postgres-backups'
: "${AWS_ENDPOINT_URL:?Need AWS_ENDPOINT_URL}"
: "${AWS_ACCESS_KEY_ID:?    Need AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Need AWS_SECRET_ACCESS_KEY}"
: "${RETENTION_COUNT:=7}" # how many to keep

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY

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

# ---- LOGGING FUNCTIONS ----
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

# ---- COMMON S3 FUNCTIONS ----
list_backups() {
    log "Listing available backups in s3://$S3_BUCKET/$S3_PREFIX/:"
    aws s3 ls "s3://$S3_BUCKET/$S3_PREFIX/" --endpoint-url "$AWS_ENDPOINT_URL" | grep "backup-" | sort -r
}

upload_to_s3() {
    local temp_file="$1"
    local s3_file="$2"

    if ! aws s3 cp "$temp_file" "s3://$S3_BUCKET/$S3_PREFIX/$s3_file" --endpoint-url "$AWS_ENDPOINT_URL"; then
        rm -f "$temp_file"
        error "Backup failed during S3 upload"
    fi
}

download_from_s3() {
    local s3_file="$1"
    local temp_file="$2"

    if ! aws s3 cp "s3://$S3_BUCKET/$S3_PREFIX/$s3_file" "$temp_file" --endpoint-url "$AWS_ENDPOINT_URL"; then
        rm -f "$temp_file"
        error "Failed to download backup from S3"
    fi
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

check_aws_requirements() {
    local missing_deps=()

    # Check for required AWS commands
    for cmd in aws gzip; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        error "Missing required commands: ${missing_deps[*]}"
    fi
}
