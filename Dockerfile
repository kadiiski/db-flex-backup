# mysql-s3-backup
# A Docker image for automated MySQL database backups to S3-compatible storage
# Version: 1.0.0

FROM alpine:3.18

LABEL maintainer="Ivaylo Kadiyski <kadiiski94@gmail.com>"
LABEL description="MySQL database backup to S3-compatible storage"
LABEL version="1.0.0"

# Install required packages
RUN apk add --no-cache \
    mysql-client \
    aws-cli \
    bash \
    busybox-suid \
    tzdata 

# Set default timezone
ENV TZ=Europe/Sofia

# Copy scripts
COPY scripts/entrypoint.sh /entrypoint.sh
COPY scripts/backup.sh /backup.sh

# Make scripts executable
RUN chmod +x /entrypoint.sh /backup.sh

# Set default environment variables
ENV CRON_SCHEDULE="0 12 * * *" \
    MYSQL_PORT=3306 \
    S3_PREFIX="mysql" \
    RETENTION_COUNT=7

ENTRYPOINT ["/entrypoint.sh"] 