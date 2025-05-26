#!/bin/sh
set -e

# Default once-a-day @ midnight if not overridden
: "${CRON_SCHEDULE:=0 0 * * *}"

# Create crontab directory if it doesn't exist
mkdir -p /etc/crontabs

# Write a cron job that invokes our backup script
echo "$CRON_SCHEDULE /backup.sh backup" >/etc/crontabs/root

# Ensure the backup script is executable
chmod +x /backup.sh

# Launch cron in foreground with logs to stdout
exec crond -f -L /dev/stdout
