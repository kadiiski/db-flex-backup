#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Backward compatibility wrapper for the original MySQL backup script
# This maintains the exact same interface and behavior as before
# while internally using the new modular structure

# Set DB_TYPE to mysql for backward compatibility
export DB_TYPE="mysql"

# Set default S3_PREFIX to match original behavior
: "${S3_PREFIX:=mysql}"
export S3_PREFIX

# Source the MySQL backup handler directly to maintain exact compatibility
source "/usr/local/bin/mysql_backup.sh"

# Call the MySQL handler with all arguments
handle_mysql_command "$@"
