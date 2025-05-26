# MySQL S3 Backup Docker Image

A Docker image for automated MySQL database backups to S3-compatible storage. This image provides a simple way to backup your MySQL databases to any S3-compatible storage service, including AWS S3 and Cloudflare R2.

## Features

- Automated daily backups (configurable schedule)
- Support for full database or specific database backups
- Automatic backup retention management
- Restore functionality
- S3-compatible storage support (works with AWS S3, Cloudflare R2, MinIO, etc.)
- Detailed logging
- Error handling and cleanup
- Multi-architecture support (amd64 and arm64)

## System Requirements

The image includes all necessary dependencies:
- MySQL client tools (mysqldump, mysql)
- AWS CLI for S3 operations
- gzip for compression
- cron for scheduling

## Quick Start

1. Pull the image:
```bash
docker pull kadiiski/mysql-s3-backup:latest
```

2. Run the container with required environment variables:
```bash
docker run -d \
  --name mysql-backup \
  -e MYSQL_HOST=your-mysql-host \
  -e MYSQL_USER=your-mysql-user \
  -e MYSQL_PASSWORD=your-mysql-password \
  -e S3_BUCKET=your-s3-bucket \
  -e AWS_ENDPOINT_URL=your-s3-endpoint \
  -e AWS_ACCESS_KEY_ID=your-access-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret-key \
  kadiiski/mysql-s3-backup:latest
```

## Environment Variables

### Required Variables

- `MYSQL_HOST`: MySQL server hostname
- `MYSQL_USER`: MySQL username
- `MYSQL_PASSWORD`: MySQL password
- `S3_BUCKET`: S3 bucket name
- `AWS_ENDPOINT_URL`: S3 endpoint URL (required for S3-compatible storage)
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

### Optional Variables

- `MYSQL_PORT`: MySQL port (default: 3306)
- `MYSQL_DATABASE`: Specific database to backup (default: all databases)
- `S3_PREFIX`: S3 prefix/path (default: mysql)
- `RETENTION_COUNT`: Number of backups to keep (default: 7)
- `CRON_SCHEDULE`: Cron schedule for backups (default: "0 0 * * *" - daily at midnight)
- `TZ`: Timezone (default: Europe/Sofia)

## Usage Examples

### List Available Backups

```bash
docker exec mysql-backup /backup.sh list
```

### Manual Backup

```bash
docker exec mysql-backup /backup.sh backup
```

### Restore from Backup

```bash
docker exec mysql-backup /backup.sh restore backup-2024-05-21_10-30-00.sql.gz
```

### Custom Backup Schedule

```bash
docker run -d \
  --name mysql-backup \
  -e CRON_SCHEDULE="0 2 * * *" \  # Run at 2 AM daily
  ... other environment variables ...
  mysql-s3-backup
```

## Docker Compose Example

```yaml
version: '3.8'

services:
  mysql-s3-backup:
    image: kadiiski/mysql-s3-backup:latest
    pull_policy: always  # Ensures the latest version is pulled on each deployment
    container_name: mysql_s3_backup
    depends_on:
      mariadb:
        condition: service_healthy
    environment:
      # MySQL connection
      MYSQL_HOST: mariadb
      MYSQL_PORT: "3306"
      MYSQL_USER: ${MYSQL_USER:-symfony}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-symfony}
      MYSQL_DATABASE: my_database  # Optional: specific database to backup
      
      # S3/R2 configuration
      S3_BUCKET: my-backups
      S3_PREFIX: mysql-backups
      AWS_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}      # Use R2_ACCESS_KEY_ID for Cloudflare R2
      AWS_SECRET_ACCESS_KEY: ${R2_SECRET_KEY}     # Use R2_SECRET_KEY for Cloudflare R2
      AWS_ENDPOINT_URL: ${R2_ENDPOINT_URL}        # Required for Cloudflare R2 (e.g., https://<account_id>.r2.cloudflarestorage.com)
      
      # Backup configuration
      CRON_SCHEDULE: "0 0 * * *"  # Daily at midnight
      RETENTION_COUNT: 10  # Keep last 7 backups
      TZ: Europe/Sofia
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

This example shows:
- Using the latest multi-arch image
- Automatic pulling of the latest version on each deployment
- Health check dependency on the database
- Environment variable configuration with defaults
- Network configuration
- All available configuration options
- Cloudflare R2 integration example

### Updating the Latest Tag

When using the `:latest` tag, you can ensure you always get the latest version by:

1. Using `pull_policy: always` in your docker-compose.yml (as shown above)
2. Running `docker-compose pull` before `docker-compose up`
3. Using `docker-compose up --pull always`

This ensures your container will always use the most recent version of the image when you rebuild your stack.

### Cloudflare R2 Configuration

To use with Cloudflare R2:
1. Set `AWS_ENDPOINT_URL` to your R2 endpoint (e.g., `https://<account_id>.r2.cloudflarestorage.com`)
2. Use your R2 credentials for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
3. Create a bucket in R2 and set it as `S3_BUCKET`

The image works seamlessly with R2 as it's fully S3-compatible.

## Building and Publishing

### Quick Build (Single Architecture)

1. Build the image:
```bash
docker build -t your-registry/mysql-s3-backup:1.0.0 .
```

2. Push to your registry:
```bash
docker push your-registry/mysql-s3-backup:1.0.0
```

### Multi-Architecture Build

For building and pushing a multi-architecture image (recommended for production use):

1. Use the provided push script:
```bash
./push.sh
```

Or manually:

1. Create and use a new builder instance:
```bash
docker buildx create --use
```

2. Build and push multi-arch image:
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t your-registry/mysql-s3-backup:latest --push .
```

The multi-architecture build ensures the image works on both x86_64 (amd64) and ARM-based systems, making it compatible with various cloud providers and local development environments.

## License

MIT License 