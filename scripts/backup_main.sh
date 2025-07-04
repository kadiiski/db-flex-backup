#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Main backup script - routes to appropriate database handler
# Supports both MySQL and PostgreSQL backup operations

# ---- CONFIGURATION ----
: "${DB_TYPE:=mysql}" # Default to mysql for backward compatibility

# Simple logging for the main script
log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ℹ️  $*" >&1
}

error() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ❌ ERROR: $*" >&2
    exit 1
}

show_usage() {
    echo "Database Backup Tool"
    echo "Supports MySQL and PostgreSQL backups to S3-compatible storage"
    echo
    echo "Usage: backup <command> [args]"
    echo
    echo "Commands:"
    echo "  list                    List available backups"
    echo "  backup                  Create a new backup"
    echo "  restore <filename>      Restore from a specific backup file"
    echo
    echo "Environment Variables:"
    echo "  DB_TYPE                 Database type: 'mysql' or 'postgres' (default: mysql)"
    echo
    echo "MySQL Configuration:"
    echo "  MYSQL_HOST              MySQL server hostname"
    echo "  MYSQL_PORT              MySQL port (default: 3306)"
    echo "  MYSQL_USER              MySQL username"
    echo "  MYSQL_PASSWORD          MySQL password"
    echo "  MYSQL_DATABASE          Specific database to backup (optional)"
    echo
    echo "PostgreSQL Configuration:"
    echo "  POSTGRES_HOST           PostgreSQL server hostname"
    echo "  POSTGRES_PORT           PostgreSQL port (default: 5432)"
    echo "  POSTGRES_USER           PostgreSQL username"
    echo "  POSTGRES_PASSWORD       PostgreSQL password"
    echo "  POSTGRES_DATABASE       Specific database to backup (optional)"
    echo
    echo "S3 Configuration:"
    echo "  S3_BUCKET              S3 bucket name"
    echo "  S3_PREFIX              S3 prefix/path (default: 'backups')"
    echo "  AWS_ENDPOINT_URL       S3 endpoint URL"
    echo "  AWS_ACCESS_KEY_ID      AWS access key"
    echo "  AWS_SECRET_ACCESS_KEY  AWS secret key"
    echo "  RETENTION_COUNT        Number of backups to keep (default: 7)"
    echo
    echo "Examples:"
    echo "  # MySQL backup"
    echo "  export DB_TYPE=mysql"
    echo "  backup backup"
    echo
    echo "  # PostgreSQL backup"
    echo "  export DB_TYPE=postgres"
    echo "  backup backup"
    echo
    echo "  # List backups"
    echo "  backup list"
    echo
    echo "  # Restore from backup"
    echo "  backup restore backup-2024-05-21_10-30-00.sql.gz"
}

main() {
    # Validate DB_TYPE
    case "$DB_TYPE" in
    mysql | MySQL)
        DB_TYPE="mysql"
        ;;
    postgres | postgresql | PostgreSQL | POSTGRES)
        DB_TYPE="postgres"
        ;;
    *)
        error "Invalid DB_TYPE: $DB_TYPE. Must be 'mysql' or 'postgres'"
        ;;
    esac

    # Show usage if no command provided
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi

    # Route to appropriate handler
    case "$DB_TYPE" in
    mysql)
        log "Using MySQL backup handler"
        source "/usr/local/bin/mysql_backup.sh"
        handle_mysql_command "$@"
        ;;
    postgres)
        log "Using PostgreSQL backup handler"
        source "/usr/local/bin/postgres_backup.sh"
        handle_postgres_command "$@"
        ;;
    *)
        error "Unsupported database type: $DB_TYPE"
        ;;
    esac
}

main "$@"
