# Database S3 Backup

A Docker image for automated MySQL and PostgreSQL database backups to S3-compatible storage with configurable retention policies.

## Features

- **Multi-Database Support**: Both MySQL and PostgreSQL
- **S3-Compatible Storage**: Works with AWS S3, MinIO, and other S3-compatible services
- **Automated Scheduling**: Configurable cron-based backups
- **Retention Management**: Automatic cleanup of old backups
- **Compression**: All backups are gzipped for storage efficiency
- **Easy Restore**: Simple restore functionality from any backup
- **Backward Compatibility**: Existing MySQL setups continue to work unchanged

## Quick Start

### MySQL Backup

```bash
docker run -d \
  --name mysql-backup \
  -e DB_TYPE=mysql \
  -e MYSQL_HOST=your-mysql-host \
  -e MYSQL_USER=backup_user \
  -e MYSQL_PASSWORD=your_password \
  -e S3_BUCKET=your-backup-bucket \
  -e AWS_ENDPOINT_URL=https://s3.amazonaws.com \
  -e AWS_ACCESS_KEY_ID=your_access_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret_key \
  kadiiski/mysql-s3-backup
```

### PostgreSQL Backup

```bash
docker run -d \
  --name postgres-backup \
  -e DB_TYPE=postgres \
  -e POSTGRES_HOST=your-postgres-host \
  -e POSTGRES_USER=backup_user \
  -e POSTGRES_PASSWORD=your_password \
  -e S3_BUCKET=your-backup-bucket \
  -e AWS_ENDPOINT_URL=https://s3.amazonaws.com \
  -e AWS_ACCESS_KEY_ID=your_access_key \
  -e AWS_SECRET_ACCESS_KEY=your_secret_key \
  kadiiski/mysql-s3-backup
```

## Environment Variables

### Database Type Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_TYPE` | Database type: `mysql` or `postgres` | `mysql` | No |

### MySQL Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `MYSQL_HOST` | MySQL server hostname | - | Yes (for MySQL) |
| `MYSQL_PORT` | MySQL port | `3306` | No |
| `MYSQL_USER` | MySQL username | - | Yes (for MySQL) |
| `MYSQL_PASSWORD` | MySQL password | - | Yes (for MySQL) |
| `MYSQL_DATABASE` | Specific database to backup (optional) | - | No |

### PostgreSQL Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_HOST` | PostgreSQL server hostname | - | Yes (for PostgreSQL) |
| `POSTGRES_PORT` | PostgreSQL port | `5432` | No |
| `POSTGRES_USER` | PostgreSQL username | - | Yes (for PostgreSQL) |
| `POSTGRES_PASSWORD` | PostgreSQL password | - | Yes (for PostgreSQL) |
| `POSTGRES_DATABASE` | Specific database to backup (optional) | - | No |

### S3 Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `S3_BUCKET` | S3 bucket name | - | Yes |
| `S3_PREFIX` | S3 prefix/path | `backups` | No |
| `AWS_ENDPOINT_URL` | S3 endpoint URL | - | Yes |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | Yes |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | Yes |

### Scheduling & Retention

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CRON_SCHEDULE` | Cron schedule for backups | `0 0 * * *` (daily at midnight) | No |
| `RETENTION_COUNT` | Number of backups to keep | `7` | No |
| `TZ` | Timezone for cron jobs | `Europe/Sofia` | No |

## Usage

### Automated Backups

The container runs automated backups based on the `CRON_SCHEDULE`. Default is daily at midnight (`0 0 * * *`).

### Manual Operations

You can run manual operations using the `backup` command:

```bash
# List available backups
docker exec mysql-backup backup list

# Create manual backup
docker exec mysql-backup backup backup

# Restore from specific backup
docker exec mysql-backup backup restore backup-2024-05-21_10-30-00.sql.gz
```

### Database-Specific Examples

#### MySQL: Backup specific database

```bash
docker run -d \
  --name mysql-app-backup \
  -e DB_TYPE=mysql \
  -e MYSQL_HOST=db.example.com \
  -e MYSQL_USER=backup_user \
  -e MYSQL_PASSWORD=secure_password \
  -e MYSQL_DATABASE=myapp \
  -e S3_BUCKET=backups \
  -e S3_PREFIX=mysql/myapp \
  -e AWS_ENDPOINT_URL=https://s3.amazonaws.com \
  -e AWS_ACCESS_KEY_ID=AKIA... \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  -e CRON_SCHEDULE="0 2 * * *" \
  kadiiski/mysql-s3-backup
```

#### PostgreSQL: All databases with custom retention

```bash
docker run -d \
  --name postgres-full-backup \
  -e DB_TYPE=postgres \
  -e POSTGRES_HOST=postgres.example.com \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=secure_password \
  -e S3_BUCKET=backups \
  -e S3_PREFIX=postgres/full \
  -e RETENTION_COUNT=14 \
  -e AWS_ENDPOINT_URL=https://minio.example.com \
  -e AWS_ACCESS_KEY_ID=minioadmin \
  -e AWS_SECRET_ACCESS_KEY=minioadmin \
  -e CRON_SCHEDULE="0 3 * * *" \
  kadiiski/mysql-s3-backup
```

## Docker Compose Examples

### MySQL

```yaml
version: '3.8'
services:
  mysql-backup:
    image: kadiiski/mysql-s3-backup
    environment:
      DB_TYPE: mysql
      MYSQL_HOST: mysql
      MYSQL_USER: backup_user
      MYSQL_PASSWORD: backup_password
      S3_BUCKET: mysql-backups
      S3_PREFIX: production
      AWS_ENDPOINT_URL: https://s3.amazonaws.com
      AWS_ACCESS_KEY_ID: your_access_key
      AWS_SECRET_ACCESS_KEY: your_secret_key
      CRON_SCHEDULE: "0 2 * * *"
      RETENTION_COUNT: 7
    restart: unless-stopped
```

### PostgreSQL

```yaml
version: '3.8'
services:
  postgres-backup:
    image: kadiiski/mysql-s3-backup
    environment:
      DB_TYPE: postgres
      POSTGRES_HOST: postgres
      POSTGRES_USER: backup_user
      POSTGRES_PASSWORD: backup_password
      S3_BUCKET: postgres-backups
      S3_PREFIX: production
      AWS_ENDPOINT_URL: https://s3.amazonaws.com
      AWS_ACCESS_KEY_ID: your_access_key
      AWS_SECRET_ACCESS_KEY: your_secret_key
      CRON_SCHEDULE: "0 3 * * *"
      RETENTION_COUNT: 14
    restart: unless-stopped
```

## Backup Behavior

### MySQL Backups
- **All databases**: Uses `mysqldump --all-databases --add-drop-database` when no specific database is set
- **Specific database**: Uses `mysqldump --databases <db_name> --add-drop-database` when `MYSQL_DATABASE` is specified
- **Restore**: Connects directly to the target database or uses default connection for all-database restores

### PostgreSQL Backups
- **All databases**: Uses `pg_dumpall --clean` to backup all databases and roles
- **Specific database**: Uses `pg_dump --clean --create --if-exists` for single database backups
- **Restore**: 
  - For specific databases: Explicitly terminates connections, drops the existing database, then recreates it from backup
  - For all databases: Uses the `pg_dumpall` restore which handles all database recreation
  - Always connects to the `postgres` maintenance database for proper permissions

## Backward Compatibility

**Existing MySQL setups continue to work unchanged!** If you're upgrading from version 1.x:

- All existing environment variables work as before
- The original `./backup.sh` script still works and automatically sets `DB_TYPE=mysql`
- Default behavior remains the same for MySQL
- S3_PREFIX defaults to `mysql` when using the legacy backup.sh script

## Backup File Format

Backups are stored with the following naming convention:
```
backup-YYYY-MM-DD_HH-MM-SS.sql.gz
```

Examples:
- `backup-2024-05-21_14-30-45.sql.gz`
- `backup-2024-05-22_02-00-12.sql.gz`

## Security Considerations

- Use dedicated backup users with minimal required permissions
- Store credentials securely (consider using Docker secrets or external secret management)
- Enable S3 bucket encryption and access logging
- Regularly test restore procedures
- Monitor backup success/failure logs

## Troubleshooting

### Check logs
```bash
docker logs mysql-backup
```

### Test connection manually
```bash
# Test MySQL connection
docker exec -it mysql-backup mysql -h $MYSQL_HOST -u $MYSQL_USER -p

# Test PostgreSQL connection  
docker exec -it mysql-backup psql -h $POSTGRES_HOST -U $POSTGRES_USER -d postgres

# Test S3 connection
docker exec -it mysql-backup aws s3 ls s3://$S3_BUCKET --endpoint-url $AWS_ENDPOINT_URL
```

### Common Issues

1. **Connection refused**: Check database host and port
2. **Authentication failed**: Verify credentials and user permissions
3. **S3 upload failed**: Check S3 credentials and bucket permissions
4. **Cron not running**: Verify cron schedule format