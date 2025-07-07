#!/bin/bash
set -e

VERSION="2.0.1"

echo "Building and pushing database-s3-backup:${VERSION}..."
echo "This image supports both MySQL and PostgreSQL backups"

# Build and push multi-arch image with version tag
docker buildx build --platform linux/amd64,linux/arm64 \
    -t kadiiski/database-s3-backup:${VERSION} \
    -t kadiiski/database-s3-backup:latest \
    -t kadiiski/mysql-s3-backup:${VERSION} \
    -t kadiiski/mysql-s3-backup:latest \
    --push .

echo "✅ Successfully pushed:"
echo "  - kadiiski/database-s3-backup:${VERSION}"
echo "  - kadiiski/database-s3-backup:latest"
echo "  - kadiiski/mysql-s3-backup:${VERSION} (backward compatibility)"
echo "  - kadiiski/mysql-s3-backup:latest (backward compatibility)"
