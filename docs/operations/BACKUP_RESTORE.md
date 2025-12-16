# Backup & Restore

Процедури резервного копіювання та відновлення даних.

## Backup Strategy

### 3-2-1 Rule
- **3** копії даних
- **2** різних типи носіїв
- **1** копія офсайт

### Backup Types

| Type | Frequency | Retention | RTO | RPO |
|------|-----------|-----------|-----|-----|
| Full | Weekly | 30 days | 4h | 24h |
| Incremental | Daily | 14 days | 2h | 24h |
| Transaction logs | 15 min | 7 days | 15min | 15min |
| Snapshots | Hourly | 48h | 30min | 1h |

## PostgreSQL Backup

### Automated Backup Script

```bash
#!/bin/bash
# scripts/backup-postgres.sh

set -e

BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
DB_NAME="shop"
S3_BUCKET="shop-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup with pg_dump
echo "Starting PostgreSQL backup..."
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -Fc -f "$BACKUP_DIR/${DB_NAME}_${DATE}.dump"

# Compress
gzip "$BACKUP_DIR/${DB_NAME}_${DATE}.dump"

# Upload to S3
aws s3 cp "$BACKUP_DIR/${DB_NAME}_${DATE}.dump.gz" \
  "s3://${S3_BUCKET}/postgres/${DATE}/"

# Clean old local backups (keep 7 days)
find $BACKUP_DIR -name "*.dump.gz" -mtime +7 -delete

echo "Backup completed: ${DB_NAME}_${DATE}.dump.gz"
```

### Point-in-Time Recovery (PITR)

```bash
# Enable WAL archiving in postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://shop-backups/wal/%f'
wal_level = replica

# Restore to specific point in time
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --target-time="2024-01-15 14:30:00" \
  /backups/shop_full.dump
```

### Kubernetes CronJob

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15
              command:
                - /bin/bash
                - -c
                - |
                  pg_dump -h $DB_HOST -U $DB_USER -d shop -Fc | \
                  gzip | \
                  aws s3 cp - s3://shop-backups/postgres/$(date +%Y-%m-%d).dump.gz
              envFrom:
                - secretRef:
                    name: postgres-credentials
                - secretRef:
                    name: aws-credentials
          restartPolicy: OnFailure
```

## Redis Backup

### RDB Snapshot

```bash
#!/bin/bash
# scripts/backup-redis.sh

BACKUP_DIR="/backups/redis"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
S3_BUCKET="shop-backups"

# Trigger BGSAVE
redis-cli -h $REDIS_HOST BGSAVE

# Wait for completion
while [ $(redis-cli -h $REDIS_HOST LASTSAVE) == $(redis-cli -h $REDIS_HOST LASTSAVE) ]; do
  sleep 1
done

# Copy RDB file
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_${DATE}.rdb"

# Upload to S3
aws s3 cp "$BACKUP_DIR/redis_${DATE}.rdb" \
  "s3://${S3_BUCKET}/redis/${DATE}/"
```

### AOF Backup

```bash
# Enable AOF in redis.conf
appendonly yes
appendfsync everysec

# Backup AOF file
cp /var/lib/redis/appendonly.aof "$BACKUP_DIR/redis_aof_${DATE}.aof"
```

## Elasticsearch Backup

### Snapshot Repository

```bash
# Register S3 repository
PUT /_snapshot/s3_repository
{
  "type": "s3",
  "settings": {
    "bucket": "shop-backups",
    "base_path": "elasticsearch",
    "compress": true
  }
}

# Create snapshot
PUT /_snapshot/s3_repository/snapshot_$(date +%Y%m%d)
{
  "indices": "products,orders,customers",
  "ignore_unavailable": true,
  "include_global_state": false
}

# Check snapshot status
GET /_snapshot/s3_repository/snapshot_20240115/_status
```

### Automated Snapshots

```bash
#!/bin/bash
# scripts/backup-elasticsearch.sh

DATE=$(date +%Y%m%d_%H%M%S)

# Create snapshot
curl -X PUT "http://elasticsearch:9200/_snapshot/s3_repository/snapshot_${DATE}" \
  -H 'Content-Type: application/json' \
  -d '{
    "indices": "*",
    "ignore_unavailable": true,
    "include_global_state": false
  }'

# Delete old snapshots (keep 30 days)
curl -X DELETE "http://elasticsearch:9200/_snapshot/s3_repository/snapshot_$(date -d '30 days ago' +%Y%m%d)*"
```

## File Storage Backup

### S3 Cross-Region Replication

```terraform
# terraform/s3-backup.tf
resource "aws_s3_bucket_replication_configuration" "shop_storage" {
  bucket = aws_s3_bucket.shop_storage.id

  rule {
    id     = "backup-rule"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.shop_storage_backup.arn
      storage_class = "STANDARD_IA"
    }
  }
}
```

### Versioning

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket shop-storage \
  --versioning-configuration Status=Enabled

# List versions
aws s3api list-object-versions \
  --bucket shop-storage \
  --prefix products/
```

## Restore Procedures

### PostgreSQL Restore

```bash
#!/bin/bash
# scripts/restore-postgres.sh

BACKUP_FILE=$1
DB_NAME="shop"

# Download from S3
aws s3 cp "s3://shop-backups/postgres/${BACKUP_FILE}" /tmp/restore.dump.gz

# Decompress
gunzip /tmp/restore.dump.gz

# Stop application connections
kubectl scale deployment/core-service --replicas=0

# Drop and recreate database
psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE IF EXISTS ${DB_NAME};"
psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE ${DB_NAME};"

# Restore
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME /tmp/restore.dump

# Restart application
kubectl scale deployment/core-service --replicas=3

echo "Restore completed"
```

### Redis Restore

```bash
#!/bin/bash
# scripts/restore-redis.sh

BACKUP_FILE=$1

# Download backup
aws s3 cp "s3://shop-backups/redis/${BACKUP_FILE}" /tmp/dump.rdb

# Stop Redis
redis-cli -h $REDIS_HOST SHUTDOWN NOSAVE

# Replace RDB file
cp /tmp/dump.rdb /var/lib/redis/dump.rdb

# Start Redis
redis-server /etc/redis/redis.conf
```

### Elasticsearch Restore

```bash
# Close indices before restore
POST /products/_close
POST /orders/_close

# Restore from snapshot
POST /_snapshot/s3_repository/snapshot_20240115/_restore
{
  "indices": "products,orders",
  "ignore_unavailable": true,
  "include_global_state": false
}

# Open indices
POST /products/_open
POST /orders/_open
```

## Backup Verification

### Automated Testing

```bash
#!/bin/bash
# scripts/verify-backup.sh

# Restore to test environment
./restore-postgres.sh latest.dump.gz test_shop

# Run verification queries
psql -h $TEST_DB_HOST -U $DB_USER -d test_shop -c "
  SELECT COUNT(*) as products FROM products;
  SELECT COUNT(*) as orders FROM orders;
  SELECT COUNT(*) as customers FROM customers;
"

# Compare with production
PROD_COUNTS=$(psql -h $PROD_DB_HOST -U $DB_USER -d shop -t -c "
  SELECT COUNT(*) FROM products;
")

TEST_COUNTS=$(psql -h $TEST_DB_HOST -U $DB_USER -d test_shop -t -c "
  SELECT COUNT(*) FROM products;
")

if [ "$PROD_COUNTS" != "$TEST_COUNTS" ]; then
  echo "WARNING: Backup verification failed - count mismatch"
  exit 1
fi

echo "Backup verification successful"
```

## Monitoring Backups

### Alerts

```yaml
# prometheus/alerts/backup.yml
groups:
  - name: backup
    rules:
      - alert: BackupMissing
        expr: time() - backup_last_success_timestamp > 86400 * 2
        labels:
          severity: critical
        annotations:
          summary: "No successful backup in 2 days"

      - alert: BackupFailed
        expr: backup_last_status == 0
        labels:
          severity: critical
        annotations:
          summary: "Last backup failed"
```

### Metrics

```promql
# Last backup timestamp
backup_last_success_timestamp{type="postgres"}

# Backup size
backup_size_bytes{type="postgres"}

# Backup duration
backup_duration_seconds{type="postgres"}
```

## See Also

- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Infrastructure](../INFRASTRUCTURE.md)
- [Database Schema](../infrastructure/DATABASE_SCHEMA.md)
