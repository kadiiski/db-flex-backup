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


## Web UI

The project includes a modern web UI (in the `ui/` directory) built with Next.js for managing and restoring database backups. The UI is organized as follows:

- **@/app** (`ui/src/app/`):
  - Contains the main application pages and components, including the login page, backup list, upload/restore dialogs, and the main dashboard.
  - Handles user interactions for viewing, downloading, uploading, and restoring backups.

- **@/api** (`ui/src/app/api/`):
  - Implements API routes for backup operations (list, backup, download, upload, restore, login, logout).
  - Each route calls the underlying backup scripts/commands and returns results to the UI.
  - Handles authentication (login/logout) and enforces security for backup operations.

- **@/middleware.ts** (`ui/src/middleware.ts`):
  - Provides authentication middleware for the UI and API routes.
  - Checks for a valid JWT in the `auth` cookie and redirects unauthenticated users to the login page.
  - Protects all routes except `/login` and `/api/login`.

### Authentication & API Integration

- The UI uses a login form to authenticate users. Credentials are checked via the `/api/login` route, which issues a JWT stored in an `auth` cookie.
- Alternatively, authentication can be performed via a token (see `/api/login` GET handler), allowing for SSO or external integrations. The token is decrypted and used to log in the user securely.
- For programmatic access, you can generate a secure login token via `/api/login/generate-token`:
  ```bash
  # Generate a login token (expires in 1 hour)
  curl -X POST https://your-server/api/login/generate-token \
    -H "Content-Type: application/json" \
    -d '{"username": "your_db_username", "password": "your_db_password"}'

  # Response:
  {
    "token": "base64_encoded_token"
  }
  ```
  The generated token:
  - Expires in 1 hour
  - Can be used directly via the `loginUrl` for browser-based redirects
- All backup management actions (list, create, download, upload, restore) are performed via API routes under `/api/`, which are protected by the authentication middleware.
- The UI provides a secure, user-friendly way to manage database backups without direct command-line access.

### UI Configuration

The UI automatically reflects the container's configuration through these environment variables:

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `BACKUPS_UI_TITLE` | Custom title for the backup management page | `"Database Backups"` | No |
| `RETENTION_COUNT` | Number of backups to keep (shown in UI) | `7` | No |
| `CRON_SCHEDULE` | Cron schedule for backups (shown in UI) | `0 0 * * *` | No |

These container environment variables are automatically passed to the UI, allowing it to display accurate backup configuration information without additional setup.

**Note:**
If you want these variables (such as `BACKUPS_UI_TITLE`, `RETENTION_COUNT`, and `CRON_SCHEDULE`) to be available at both build time (for use in the Dockerfile) and runtime (for the running container), you must provide them in two places in your `docker-compose.yml`:

- As build arguments under `build.args` (for build-time use)
- As environment variables under `environment` (for runtime use)

#### Example: Providing Variables for Both Build and Runtime

```yaml
services:
  postgres-backup-ui:
    build:
      context: .
      args:
        BACKUPS_UI_TITLE: "Title here"
        RETENTION_COUNT: 12
        CRON_SCHEDULE: 0 0 * * *
    environment:
      BACKUPS_UI_TITLE: "Title here"
      RETENTION_COUNT: 12
      CRON_SCHEDULE: 0 0 * * *
    # ... other config ...
```

- `build.args` makes the variables available during the Docker image build (e.g., for use in the Dockerfile with `ARG` and `ENV`)
- `environment` makes the variables available to the running container and the application inside it

## Common Issues

1. **Connection refused**: Check database host and port
2. **Authentication failed**: Verify credentials and user permissions
3. **S3 upload failed**: Check S3 credentials and bucket permissions
4. **Cron not running**: Verify cron schedule format