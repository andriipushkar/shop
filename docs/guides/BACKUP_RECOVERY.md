# Backup & Recovery Guide

Стратегії резервного копіювання та відновлення даних.

## Огляд

| Компонент | Метод | Частота | Retention |
|-----------|-------|---------|-----------|
| PostgreSQL | pg_dump + WAL | Щоденно + continuous | 30 днів |
| Redis | RDB + AOF | Щогодини | 7 днів |
| Elasticsearch | Snapshots | Щоденно | 14 днів |
| Files (S3) | Cross-region replication | Continuous | Unlimited |

## PostgreSQL

### Automated Backups (pg_dump)

```bash
#!/bin/bash
# scripts/backup-postgres.sh

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-shopdb}"
DB_USER="${DB_USER:-shop}"
BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
S3_BUCKET="${S3_BUCKET:-shop-backups}"
RETENTION_DAYS=30

# Generate filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup of $DB_NAME..."

# Create backup
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    -Z 9 \
    --verbose \
    --no-owner \
    --no-privileges \
    > "$BACKUP_FILE"

# Calculate checksum
CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
echo "$CHECKSUM" > "${BACKUP_FILE}.sha256"

# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/postgres/$BACKUP_FILE"
aws s3 cp "${BACKUP_FILE}.sha256" "s3://$S3_BUCKET/postgres/${BACKUP_FILE}.sha256"

echo "Backup completed: $BACKUP_FILE"
echo "Checksum: $CHECKSUM"

# Cleanup old local backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

# Cleanup old S3 backups
aws s3 ls "s3://$S3_BUCKET/postgres/" | while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_NAME=$(echo "$line" | awk '{print $4}')

    if [[ $(date -d "$FILE_DATE" +%s) -lt $(date -d "-$RETENTION_DAYS days" +%s) ]]; then
        aws s3 rm "s3://$S3_BUCKET/postgres/$FILE_NAME"
    fi
done

echo "Cleanup completed"
```

### Point-in-Time Recovery (WAL Archiving)

```bash
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://shop-backups/wal/%f'
archive_timeout = 60

# Максимальний розрив між checkpoint
max_wal_size = 1GB
min_wal_size = 80MB
```

### Restore from Backup

```bash
#!/bin/bash
# scripts/restore-postgres.sh

set -e

BACKUP_FILE="$1"
DB_NAME="${DB_NAME:-shopdb}"
DB_USER="${DB_USER:-shop}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    aws s3 ls s3://shop-backups/postgres/ --recursive | tail -20
    exit 1
fi

echo "Downloading backup..."
aws s3 cp "s3://shop-backups/postgres/$BACKUP_FILE" /tmp/restore.sql.gz

# Verify checksum
aws s3 cp "s3://shop-backups/postgres/${BACKUP_FILE}.sha256" /tmp/restore.sha256
EXPECTED=$(cat /tmp/restore.sha256)
ACTUAL=$(sha256sum /tmp/restore.sql.gz | cut -d' ' -f1)

if [ "$EXPECTED" != "$ACTUAL" ]; then
    echo "Checksum mismatch! Aborting."
    exit 1
fi

echo "Checksum verified"

# Stop applications
echo "Stopping applications..."
kubectl scale deployment --all --replicas=0 -n shop

# Drop and recreate database
echo "Recreating database..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME';
    DROP DATABASE IF EXISTS $DB_NAME;
    CREATE DATABASE $DB_NAME OWNER $DB_USER;
"

# Restore
echo "Restoring backup..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --no-owner \
    --no-privileges \
    /tmp/restore.sql.gz

# Start applications
echo "Starting applications..."
kubectl scale deployment --all --replicas=3 -n shop

echo "Restore completed successfully!"
```

### Point-in-Time Recovery

```bash
#!/bin/bash
# scripts/pitr-restore.sh

RECOVERY_TARGET_TIME="$1"  # Format: '2024-01-15 14:30:00'

if [ -z "$RECOVERY_TARGET_TIME" ]; then
    echo "Usage: $0 '2024-01-15 14:30:00'"
    exit 1
fi

# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Backup current data
sudo mv /var/lib/postgresql/15/main /var/lib/postgresql/15/main.old

# 3. Restore base backup
sudo mkdir /var/lib/postgresql/15/main
aws s3 cp s3://shop-backups/postgres/base_latest.tar.gz - | tar xzf - -C /var/lib/postgresql/15/main

# 4. Download WAL files
mkdir -p /var/lib/postgresql/15/main/pg_wal
aws s3 sync s3://shop-backups/wal/ /var/lib/postgresql/15/main/pg_wal/

# 5. Create recovery configuration
cat > /var/lib/postgresql/15/main/postgresql.auto.conf << EOF
restore_command = 'cp /var/lib/postgresql/15/main/pg_wal/%f %p'
recovery_target_time = '$RECOVERY_TARGET_TIME'
recovery_target_action = 'promote'
EOF

touch /var/lib/postgresql/15/main/recovery.signal

# 6. Fix permissions
sudo chown -R postgres:postgres /var/lib/postgresql/15/main

# 7. Start PostgreSQL
sudo systemctl start postgresql

echo "PITR recovery initiated to $RECOVERY_TARGET_TIME"
echo "Check PostgreSQL logs for recovery progress"
```

## Redis

### RDB Snapshots

```bash
#!/bin/bash
# scripts/backup-redis.sh

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
BACKUP_DIR="${BACKUP_DIR:-/backups/redis}"
S3_BUCKET="${S3_BUCKET:-shop-backups}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/dump_${TIMESTAMP}.rdb"

mkdir -p "$BACKUP_DIR"

# Trigger BGSAVE
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE

# Wait for completion
while [ "$(redis-cli -h "$REDIS_HOST" LASTSAVE)" == "$(redis-cli -h "$REDIS_HOST" LASTSAVE)" ]; do
    sleep 1
done

# Copy dump file
cp /var/lib/redis/dump.rdb "$BACKUP_FILE"

# Compress and upload
gzip "$BACKUP_FILE"
aws s3 cp "${BACKUP_FILE}.gz" "s3://$S3_BUCKET/redis/"

# Cleanup old backups
find "$BACKUP_DIR" -name "*.rdb.gz" -mtime +7 -delete

echo "Redis backup completed: ${BACKUP_FILE}.gz"
```

### Restore Redis

```bash
#!/bin/bash
# scripts/restore-redis.sh

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Download backup
aws s3 cp "s3://shop-backups/redis/$BACKUP_FILE" /tmp/dump.rdb.gz
gunzip /tmp/dump.rdb.gz

# Stop Redis
sudo systemctl stop redis

# Replace dump file
sudo cp /tmp/dump.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis

echo "Redis restore completed"
```

## Elasticsearch

### Snapshot Repository

```bash
# Створення репозиторію
curl -X PUT "localhost:9200/_snapshot/s3_backup" -H 'Content-Type: application/json' -d'
{
  "type": "s3",
  "settings": {
    "bucket": "shop-backups",
    "base_path": "elasticsearch",
    "region": "eu-central-1"
  }
}'
```

### Create Snapshot

```bash
#!/bin/bash
# scripts/backup-elasticsearch.sh

ES_HOST="${ES_HOST:-localhost:9200}"
SNAPSHOT_NAME="snapshot_$(date +%Y%m%d_%H%M%S)"

# Create snapshot
curl -X PUT "$ES_HOST/_snapshot/s3_backup/$SNAPSHOT_NAME?wait_for_completion=true" -H 'Content-Type: application/json' -d'
{
  "indices": "products,orders,customers",
  "ignore_unavailable": true,
  "include_global_state": false
}'

echo "Snapshot created: $SNAPSHOT_NAME"

# List snapshots
curl -X GET "$ES_HOST/_snapshot/s3_backup/_all?pretty"
```

### Restore Snapshot

```bash
#!/bin/bash
# scripts/restore-elasticsearch.sh

ES_HOST="${ES_HOST:-localhost:9200}"
SNAPSHOT_NAME="$1"

if [ -z "$SNAPSHOT_NAME" ]; then
    echo "Usage: $0 <snapshot_name>"
    echo "Available snapshots:"
    curl -s "$ES_HOST/_snapshot/s3_backup/_all" | jq '.snapshots[].snapshot'
    exit 1
fi

# Close indices first
curl -X POST "$ES_HOST/products,orders,customers/_close"

# Restore
curl -X POST "$ES_HOST/_snapshot/s3_backup/$SNAPSHOT_NAME/_restore" -H 'Content-Type: application/json' -d'
{
  "indices": "products,orders,customers",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# Open indices
curl -X POST "$ES_HOST/products,orders,customers/_open"

echo "Restore initiated from $SNAPSHOT_NAME"
```

## S3/MinIO Files

### Cross-Region Replication

```terraform
# terraform/s3-replication.tf
resource "aws_s3_bucket" "primary" {
  bucket = "shop-files-eu-central-1"

  versioning {
    enabled = true
  }

  replication_configuration {
    role = aws_iam_role.replication.arn

    rules {
      id     = "replicate-all"
      status = "Enabled"

      destination {
        bucket        = aws_s3_bucket.replica.arn
        storage_class = "STANDARD_IA"
      }
    }
  }
}

resource "aws_s3_bucket" "replica" {
  provider = aws.us-east-1
  bucket   = "shop-files-us-east-1-replica"

  versioning {
    enabled = true
  }
}
```

### Manual Backup

```bash
#!/bin/bash
# scripts/backup-s3.sh

SOURCE_BUCKET="shop-files"
BACKUP_BUCKET="shop-files-backup"
TIMESTAMP=$(date +%Y%m%d)

# Sync to backup bucket
aws s3 sync "s3://$SOURCE_BUCKET" "s3://$BACKUP_BUCKET/$TIMESTAMP/"

echo "S3 backup completed to s3://$BACKUP_BUCKET/$TIMESTAMP/"
```

## Kubernetes Secrets & ConfigMaps

### Backup

```bash
#!/bin/bash
# scripts/backup-k8s-config.sh

NAMESPACE="shop"
BACKUP_DIR="/backups/kubernetes"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup secrets (encrypted)
kubectl get secrets -n "$NAMESPACE" -o yaml | \
    kubeseal --format yaml > "$BACKUP_DIR/secrets_${TIMESTAMP}.yaml"

# Backup configmaps
kubectl get configmaps -n "$NAMESPACE" -o yaml > "$BACKUP_DIR/configmaps_${TIMESTAMP}.yaml"

# Backup to S3
aws s3 cp "$BACKUP_DIR/" "s3://shop-backups/kubernetes/" --recursive

echo "Kubernetes config backup completed"
```

## Disaster Recovery Plan

### RPO & RTO

| Сценарій | RPO | RTO |
|----------|-----|-----|
| Втрата даних БД | 1 година | 2 години |
| Втрата region | 24 години | 4 години |
| Втрата одного сервісу | 0 | 5 хвилин |
| Корупція даних | 1 година | 4 години |

### DR Runbook

#### 1. Database Failure

```bash
# 1. Switch to replica (if available)
kubectl patch service postgres -n shop -p '{"spec":{"selector":{"role":"replica"}}}'

# 2. Or restore from backup
./scripts/restore-postgres.sh latest_backup.sql.gz

# 3. Verify
psql -h postgres -U shop -d shopdb -c "SELECT count(*) FROM orders;"
```

#### 2. Complete Region Failure

```bash
# 1. Update DNS to DR region
aws route53 change-resource-record-sets --hosted-zone-id ZONE_ID --change-batch '{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "api.yourstore.com",
      "Type": "A",
      "AliasTarget": {
        "DNSName": "dr-alb.us-east-1.elb.amazonaws.com",
        "HostedZoneId": "Z35SXDOTRQ7X7K"
      }
    }
  }]
}'

# 2. Scale up DR cluster
kubectl config use-context dr-cluster
kubectl scale deployment --all --replicas=3 -n shop

# 3. Restore latest backup to DR database
./scripts/restore-postgres.sh latest_backup.sql.gz
```

## Automated Backup Schedule

### Kubernetes CronJobs

```yaml
# kubernetes/backup-cronjobs.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: shop
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:15-alpine
              command:
                - /scripts/backup-postgres.sh
              envFrom:
                - secretRef:
                    name: backup-secrets
              volumeMounts:
                - name: scripts
                  mountPath: /scripts
          volumes:
            - name: scripts
              configMap:
                name: backup-scripts
                defaultMode: 0755
          restartPolicy: OnFailure
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: shop
spec:
  schedule: "0 * * * *"  # Hourly
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: redis:7-alpine
              command:
                - /scripts/backup-redis.sh
          restartPolicy: OnFailure
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: elasticsearch-backup
  namespace: shop
spec:
  schedule: "0 3 * * *"  # Daily at 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: curlimages/curl:latest
              command:
                - /scripts/backup-elasticsearch.sh
          restartPolicy: OnFailure
```

## Backup Verification

### Automated Testing

```bash
#!/bin/bash
# scripts/verify-backup.sh

# 1. Download latest backup
LATEST_BACKUP=$(aws s3 ls s3://shop-backups/postgres/ | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://shop-backups/postgres/$LATEST_BACKUP" /tmp/

# 2. Restore to test database
PGPASSWORD="$TEST_DB_PASSWORD" pg_restore \
    -h localhost \
    -U test \
    -d testdb \
    "/tmp/$LATEST_BACKUP"

# 3. Run verification queries
PGPASSWORD="$TEST_DB_PASSWORD" psql -h localhost -U test -d testdb -c "
    SELECT
        (SELECT count(*) FROM products) as products,
        (SELECT count(*) FROM orders) as orders,
        (SELECT count(*) FROM customers) as customers;
"

# 4. Cleanup
PGPASSWORD="$TEST_DB_PASSWORD" psql -h localhost -U postgres -c "DROP DATABASE testdb;"

echo "Backup verification completed"
```

## Моніторинг бекапів

### Alerts

```yaml
# prometheus/rules/backup-alerts.yml
groups:
  - name: backup-alerts
    rules:
      - alert: BackupMissing
        expr: |
          time() - backup_last_success_timestamp{job="postgres-backup"} > 86400
        for: 1h
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL backup missing"
          description: "No successful backup in the last 24 hours"

      - alert: BackupFailed
        expr: backup_last_status{job="postgres-backup"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Backup job failed"
```

## Checklist

### Backup Checklist

- [ ] PostgreSQL daily backup configured
- [ ] WAL archiving enabled
- [ ] Redis hourly backup configured
- [ ] Elasticsearch daily snapshots
- [ ] S3 cross-region replication
- [ ] Backup encryption enabled
- [ ] Backup monitoring alerts
- [ ] Monthly restore testing

### Recovery Checklist

- [ ] Documented recovery procedures
- [ ] Tested recovery scripts
- [ ] DR site configured
- [ ] DNS failover ready
- [ ] Team trained on procedures
- [ ] Communication plan in place
