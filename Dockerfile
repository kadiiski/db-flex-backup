# database-s3-backup
# A Docker image for automated MySQL and PostgreSQL database backups to S3-compatible storage
# Version: 2.0.0

FROM alpine:3.18

LABEL maintainer="Ivaylo Kadiyski <kadiiski94@gmail.com>"
LABEL description="MySQL and PostgreSQL cron database backup & restore with S3-compatible storage"
LABEL version="2.0.0"

# Install required packages for both MySQL and PostgreSQL
RUN apk add --no-cache \
    mysql-client \
    postgresql-client \
    aws-cli \
    bash \
    busybox-suid \
    tzdata

# Set default timezone
ENV TZ=Europe/Sofia

# Copy scripts to /usr/local/bin for consistent paths
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/backup_main.sh /usr/local/bin/backup_main.sh
COPY scripts/utils.sh /usr/local/bin/utils.sh
COPY scripts/mysql_backup.sh /usr/local/bin/mysql_backup.sh
COPY scripts/postgres_backup.sh /usr/local/bin/postgres_backup.sh
COPY scripts/backup.sh /backup.sh

# Make scripts executable
RUN chmod +x /entrypoint.sh /usr/local/bin/backup_main.sh /usr/local/bin/utils.sh /usr/local/bin/mysql_backup.sh /usr/local/bin/postgres_backup.sh /backup.sh

# Create backup command symlink for easy access
RUN ln -s /usr/local/bin/backup_main.sh /usr/local/bin/backup

# Set default environment variables
ENV CRON_SCHEDULE="0 12 * * *" \
    DB_TYPE="mysql" \
    MYSQL_PORT=3306 \
    POSTGRES_PORT=5432 \
    S3_PREFIX="backups" \
    RETENTION_COUNT=7

ENTRYPOINT ["/entrypoint.sh"]
