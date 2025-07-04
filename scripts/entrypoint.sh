#!/bin/sh
set -e

# Default once-a-day @ midnight if not overridden
: "${CRON_SCHEDULE:=0 0 * * *}"

# Create crontab directory if it doesn't exist
mkdir -p /etc/crontabs

# Write a cron job that invokes our backup command
echo "$CRON_SCHEDULE backup backup" >/etc/crontabs/root

# Ensure all backup scripts are executable
chmod +x /usr/local/bin/backup_main.sh /usr/local/bin/utils.sh /usr/local/bin/mysql_backup.sh /usr/local/bin/postgres_backup.sh /backup.sh

# Launch cron in foreground with logs to stdout
exec crond -f -L /dev/stdout
