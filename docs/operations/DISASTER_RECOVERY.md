# Disaster Recovery

Документація з аварійного відновлення Shop Platform.

## Огляд

Disaster Recovery (DR) план забезпечує:
- Мінімізацію часу простою
- Захист даних від втрати
- Швидке відновлення сервісів
- Безперервність бізнесу

## Цілі відновлення

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | < 4 години | Максимальний час відновлення |
| **RPO** (Recovery Point Objective) | < 1 година | Максимальна втрата даних |
| **MTTR** (Mean Time To Recovery) | < 2 години | Середній час відновлення |
| **Availability** | 99.9% | Річна доступність |

## Архітектура DR

```
                         Primary Region (eu-central-1)
                    ┌────────────────────────────────────┐
                    │                                    │
                    │  ┌─────────┐    ┌─────────────┐   │
                    │  │   EKS   │────│    RDS      │   │
                    │  │ Cluster │    │  (Primary)  │   │
                    │  └────┬────┘    └──────┬──────┘   │
                    │       │                │          │
                    │       │         Replication       │
                    │       │                │          │
                    └───────┼────────────────┼──────────┘
                            │                │
              ──────────────┼────────────────┼──────────────
                            │                │
                         DR Region (eu-west-1)
                    ┌───────┼────────────────┼──────────┐
                    │       │                │          │
                    │  ┌────┴────┐    ┌──────┴──────┐   │
                    │  │   EKS   │────│    RDS      │   │
                    │  │ (Standby)│   │  (Replica)  │   │
                    │  └─────────┘    └─────────────┘   │
                    │                                    │
                    └────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
              ┌─────┴─────┐                   ┌─────┴─────┐
              │    S3     │                   │    S3     │
              │ (Primary) │◄─────Cross─────►  │ (Replica) │
              │           │    Replication    │           │
              └───────────┘                   └───────────┘
```

## Backup Strategy

### Database Backups

```yaml
# kubernetes/backup/rds-backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: rds-backup
spec:
  schedule: "0 */6 * * *"  # Кожні 6 годин
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: shop-platform/db-backup:latest
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
            - name: S3_BUCKET
              value: shop-platform-backups
            - name: BACKUP_RETENTION_DAYS
              value: "30"
            command:
            - /bin/sh
            - -c
            - |
              TIMESTAMP=$(date +%Y%m%d_%H%M%S)
              BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"

              # Create backup
              pg_dump $DATABASE_URL | gzip > /tmp/$BACKUP_FILE

              # Upload to S3
              aws s3 cp /tmp/$BACKUP_FILE s3://$S3_BUCKET/database/$BACKUP_FILE

              # Cleanup old backups
              aws s3 ls s3://$S3_BUCKET/database/ | while read -r line; do
                createDate=$(echo $line | awk '{print $1" "$2}')
                createDate=$(date -d "$createDate" +%s)
                olderThan=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%s)
                if [[ $createDate -lt $olderThan ]]; then
                  fileName=$(echo $line | awk '{print $4}')
                  aws s3 rm s3://$S3_BUCKET/database/$fileName
                fi
              done
          restartPolicy: OnFailure
```

### Backup Script

```go
// scripts/backup/backup.go
package main

import (
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type BackupService struct {
	s3Client *s3.Client
	bucket   string
}

func (s *BackupService) BackupDatabase(ctx context.Context) error {
	timestamp := time.Now().Format("20060102_150405")
	backupFile := fmt.Sprintf("/tmp/backup_%s.sql", timestamp)
	compressedFile := backupFile + ".gz"

	// Run pg_dump
	cmd := exec.CommandContext(ctx, "pg_dump",
		"-h", os.Getenv("DB_HOST"),
		"-U", os.Getenv("DB_USER"),
		"-d", os.Getenv("DB_NAME"),
		"-F", "c", // Custom format
		"-f", backupFile,
	)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+os.Getenv("DB_PASSWORD"))

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_dump failed: %w", err)
	}

	// Compress
	if err := compressFile(backupFile, compressedFile); err != nil {
		return fmt.Errorf("compression failed: %w", err)
	}

	// Upload to S3
	if err := s.uploadToS3(ctx, compressedFile, fmt.Sprintf("database/backup_%s.sql.gz", timestamp)); err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	// Cleanup local files
	os.Remove(backupFile)
	os.Remove(compressedFile)

	return nil
}

func (s *BackupService) BackupRedis(ctx context.Context) error {
	timestamp := time.Now().Format("20060102_150405")
	backupFile := fmt.Sprintf("/tmp/redis_%s.rdb", timestamp)

	// Trigger BGSAVE and wait
	// ...

	// Upload to S3
	return s.uploadToS3(ctx, backupFile, fmt.Sprintf("redis/redis_%s.rdb", timestamp))
}

func (s *BackupService) BackupElasticsearch(ctx context.Context) error {
	// Use Elasticsearch snapshot API
	// ...
	return nil
}

func (s *BackupService) uploadToS3(ctx context.Context, localPath, s3Key string) error {
	file, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = s.s3Client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: &s.bucket,
		Key:    &s3Key,
		Body:   file,
	})
	return err
}

func compressFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	gzw := gzip.NewWriter(out)
	defer gzw.Close()

	_, err = io.Copy(gzw, in)
	return err
}
```

### Cross-Region Replication

```hcl
# terraform/modules/backup/main.tf

# Primary backup bucket
resource "aws_s3_bucket" "backups_primary" {
  bucket = "shop-platform-backups-${var.region}"
}

resource "aws_s3_bucket_versioning" "backups_primary" {
  bucket = aws_s3_bucket.backups_primary.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Replica bucket in DR region
resource "aws_s3_bucket" "backups_replica" {
  provider = aws.dr_region
  bucket   = "shop-platform-backups-${var.dr_region}"
}

resource "aws_s3_bucket_versioning" "backups_replica" {
  provider = aws.dr_region
  bucket   = aws_s3_bucket.backups_replica.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Replication configuration
resource "aws_s3_bucket_replication_configuration" "backups" {
  bucket = aws_s3_bucket.backups_primary.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "replicate-all"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.backups_replica.arn
      storage_class = "STANDARD"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.dr.arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }
  }
}
```

## Recovery Procedures

### Database Recovery

```bash
#!/bin/bash
# scripts/recovery/restore-database.sh

set -e

BACKUP_FILE=$1
TARGET_DB=${2:-shop_restored}

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [target_db]"
    exit 1
fi

echo "=== Database Recovery Started ==="
echo "Backup file: $BACKUP_FILE"
echo "Target database: $TARGET_DB"

# Download backup from S3
echo "Downloading backup from S3..."
aws s3 cp "s3://shop-platform-backups/database/$BACKUP_FILE" /tmp/restore.sql.gz

# Decompress
echo "Decompressing backup..."
gunzip -c /tmp/restore.sql.gz > /tmp/restore.sql

# Create new database
echo "Creating target database..."
psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE $TARGET_DB;"

# Restore
echo "Restoring database..."
pg_restore -h $DB_HOST -U $DB_USER -d $TARGET_DB /tmp/restore.sql

# Verify
echo "Verifying restoration..."
TABLES=$(psql -h $DB_HOST -U $DB_USER -d $TARGET_DB -c "\dt" | wc -l)
echo "Restored $TABLES tables"

# Cleanup
rm /tmp/restore.sql /tmp/restore.sql.gz

echo "=== Database Recovery Completed ==="
```

### Full System Recovery

```go
// scripts/recovery/full_recovery.go
package main

import (
	"context"
	"fmt"
	"log"
	"time"
)

type RecoveryService struct {
	db         *DatabaseRecovery
	redis      *RedisRecovery
	elastic    *ElasticRecovery
	kubernetes *KubernetesRecovery
	dns        *DNSRecovery
}

type RecoveryPlan struct {
	Steps []RecoveryStep
}

type RecoveryStep struct {
	Name        string
	Description string
	Execute     func(ctx context.Context) error
	Rollback    func(ctx context.Context) error
	Timeout     time.Duration
}

func (s *RecoveryService) ExecuteFullRecovery(ctx context.Context, backupTimestamp string) error {
	plan := RecoveryPlan{
		Steps: []RecoveryStep{
			{
				Name:        "Verify DR Infrastructure",
				Description: "Ensure DR region resources are available",
				Execute:     s.verifyDRInfrastructure,
				Timeout:     5 * time.Minute,
			},
			{
				Name:        "Restore Database",
				Description: "Restore PostgreSQL from backup",
				Execute:     func(ctx context.Context) error { return s.db.Restore(ctx, backupTimestamp) },
				Rollback:    s.db.Cleanup,
				Timeout:     30 * time.Minute,
			},
			{
				Name:        "Restore Redis",
				Description: "Restore Redis cache",
				Execute:     func(ctx context.Context) error { return s.redis.Restore(ctx, backupTimestamp) },
				Timeout:     10 * time.Minute,
			},
			{
				Name:        "Restore Elasticsearch",
				Description: "Restore Elasticsearch indices",
				Execute:     func(ctx context.Context) error { return s.elastic.Restore(ctx, backupTimestamp) },
				Timeout:     20 * time.Minute,
			},
			{
				Name:        "Deploy Applications",
				Description: "Deploy all microservices to DR cluster",
				Execute:     s.kubernetes.DeployAll,
				Timeout:     15 * time.Minute,
			},
			{
				Name:        "Verify Services",
				Description: "Run health checks on all services",
				Execute:     s.verifyServices,
				Timeout:     10 * time.Minute,
			},
			{
				Name:        "Switch DNS",
				Description: "Update DNS to point to DR region",
				Execute:     s.dns.SwitchToDR,
				Rollback:    s.dns.SwitchToPrimary,
				Timeout:     5 * time.Minute,
			},
			{
				Name:        "Notify Stakeholders",
				Description: "Send recovery completion notifications",
				Execute:     s.notifyStakeholders,
				Timeout:     1 * time.Minute,
			},
		},
	}

	return s.executePlan(ctx, plan)
}

func (s *RecoveryService) executePlan(ctx context.Context, plan RecoveryPlan) error {
	log.Println("=== Starting Disaster Recovery ===")
	startTime := time.Now()

	completedSteps := []RecoveryStep{}

	for i, step := range plan.Steps {
		log.Printf("[%d/%d] %s: %s", i+1, len(plan.Steps), step.Name, step.Description)

		stepCtx, cancel := context.WithTimeout(ctx, step.Timeout)

		err := step.Execute(stepCtx)
		cancel()

		if err != nil {
			log.Printf("FAILED: %s - %v", step.Name, err)

			// Rollback completed steps
			log.Println("Starting rollback...")
			for j := len(completedSteps) - 1; j >= 0; j-- {
				if completedSteps[j].Rollback != nil {
					if rbErr := completedSteps[j].Rollback(ctx); rbErr != nil {
						log.Printf("Rollback failed for %s: %v", completedSteps[j].Name, rbErr)
					}
				}
			}

			return fmt.Errorf("recovery failed at step '%s': %w", step.Name, err)
		}

		log.Printf("COMPLETED: %s", step.Name)
		completedSteps = append(completedSteps, step)
	}

	duration := time.Since(startTime)
	log.Printf("=== Recovery Completed in %s ===", duration)

	return nil
}

func (s *RecoveryService) verifyDRInfrastructure(ctx context.Context) error {
	checks := []struct {
		name  string
		check func() error
	}{
		{"EKS Cluster", s.kubernetes.CheckCluster},
		{"RDS Instance", s.db.CheckInstance},
		{"ElastiCache", s.redis.CheckCluster},
		{"S3 Access", s.checkS3Access},
	}

	for _, c := range checks {
		if err := c.check(); err != nil {
			return fmt.Errorf("%s check failed: %w", c.name, err)
		}
	}

	return nil
}

func (s *RecoveryService) verifyServices(ctx context.Context) error {
	services := []string{
		"core",
		"web",
		"admin",
		"search",
		"notification",
	}

	for _, svc := range services {
		healthy, err := s.kubernetes.CheckServiceHealth(ctx, svc)
		if err != nil || !healthy {
			return fmt.Errorf("service %s is not healthy", svc)
		}
	}

	return nil
}
```

## Failover Automation

### Automated Failover Script

```go
// scripts/failover/auto_failover.go
package main

import (
	"context"
	"log"
	"time"
)

type FailoverConfig struct {
	PrimaryRegion  string
	DRRegion       string
	HealthCheckURL string
	FailureThreshold int
	CheckInterval  time.Duration
}

type FailoverService struct {
	config      FailoverConfig
	recovery    *RecoveryService
	alerting    *AlertingService
	failureCount int
}

func (s *FailoverService) Monitor(ctx context.Context) {
	ticker := time.NewTicker(s.config.CheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.checkPrimaryHealth(ctx); err != nil {
				s.failureCount++
				log.Printf("Primary health check failed (%d/%d): %v",
					s.failureCount, s.config.FailureThreshold, err)

				if s.failureCount >= s.config.FailureThreshold {
					s.initiateFailover(ctx)
				}
			} else {
				s.failureCount = 0
			}
		}
	}
}

func (s *FailoverService) checkPrimaryHealth(ctx context.Context) error {
	// Check multiple endpoints
	endpoints := []string{
		"/health",
		"/api/v1/health",
		"/api/v1/health/db",
		"/api/v1/health/redis",
	}

	for _, endpoint := range endpoints {
		url := s.config.HealthCheckURL + endpoint
		if err := httpHealthCheck(ctx, url); err != nil {
			return err
		}
	}

	return nil
}

func (s *FailoverService) initiateFailover(ctx context.Context) {
	log.Println("=== INITIATING AUTOMATIC FAILOVER ===")

	// Alert team
	s.alerting.SendCriticalAlert(ctx, "Automatic failover initiated",
		"Primary region unresponsive after multiple health check failures")

	// Get latest backup timestamp
	latestBackup, err := s.recovery.GetLatestBackup(ctx)
	if err != nil {
		log.Printf("Failed to get latest backup: %v", err)
		return
	}

	// Execute recovery
	if err := s.recovery.ExecuteFullRecovery(ctx, latestBackup); err != nil {
		log.Printf("Failover failed: %v", err)
		s.alerting.SendCriticalAlert(ctx, "Failover FAILED",
			fmt.Sprintf("Automatic failover failed: %v", err))
		return
	}

	s.alerting.SendCriticalAlert(ctx, "Failover COMPLETED",
		"System successfully failed over to DR region")
}
```

### DNS Failover

```go
// scripts/failover/dns_failover.go
package main

import (
	"context"

	"github.com/aws/aws-sdk-go-v2/service/route53"
)

type DNSRecovery struct {
	r53Client     *route53.Client
	hostedZoneID  string
	primaryIP     string
	drIP          string
}

func (d *DNSRecovery) SwitchToDR(ctx context.Context) error {
	records := []string{
		"api.shop-platform.com",
		"www.shop-platform.com",
		"admin.shop-platform.com",
		"cdn.shop-platform.com",
	}

	for _, record := range records {
		if err := d.updateRecord(ctx, record, d.drIP); err != nil {
			return err
		}
	}

	return nil
}

func (d *DNSRecovery) SwitchToPrimary(ctx context.Context) error {
	records := []string{
		"api.shop-platform.com",
		"www.shop-platform.com",
		"admin.shop-platform.com",
		"cdn.shop-platform.com",
	}

	for _, record := range records {
		if err := d.updateRecord(ctx, record, d.primaryIP); err != nil {
			return err
		}
	}

	return nil
}

func (d *DNSRecovery) updateRecord(ctx context.Context, name, ip string) error {
	_, err := d.r53Client.ChangeResourceRecordSets(ctx, &route53.ChangeResourceRecordSetsInput{
		HostedZoneId: &d.hostedZoneID,
		ChangeBatch: &route53types.ChangeBatch{
			Changes: []route53types.Change{
				{
					Action: route53types.ChangeActionUpsert,
					ResourceRecordSet: &route53types.ResourceRecordSet{
						Name: &name,
						Type: route53types.RRTypeA,
						TTL:  aws.Int64(60),
						ResourceRecords: []route53types.ResourceRecord{
							{Value: &ip},
						},
					},
				},
			},
		},
	})
	return err
}
```

## DR Testing

### DR Test Plan

```yaml
# dr-test-plan.yaml
name: Quarterly DR Test
schedule: "0 2 1 */3 *"  # Перша субота кожного кварталу

phases:
  - name: Preparation
    duration: 1h
    tasks:
      - Notify stakeholders
      - Create test backup
      - Verify DR infrastructure
      - Document current state

  - name: Failover
    duration: 2h
    tasks:
      - Initiate controlled failover
      - Monitor recovery progress
      - Verify data integrity
      - Test all services

  - name: Validation
    duration: 2h
    tasks:
      - Run smoke tests
      - Verify user access
      - Test payment processing (sandbox)
      - Test order flow

  - name: Failback
    duration: 2h
    tasks:
      - Sync any data created during test
      - Switch back to primary
      - Verify primary operation

  - name: Documentation
    duration: 1h
    tasks:
      - Document findings
      - Update runbooks
      - Create improvement tickets
```

### DR Test Script

```go
// scripts/dr-test/run_test.go
package main

import (
	"context"
	"fmt"
	"log"
	"time"
)

type DRTestResult struct {
	StartTime      time.Time
	EndTime        time.Time
	RTOAchieved    time.Duration
	RPOAchieved    time.Duration
	DataIntegrity  bool
	ServicesHealth map[string]bool
	Issues         []string
	Passed         bool
}

func RunDRTest(ctx context.Context) (*DRTestResult, error) {
	result := &DRTestResult{
		StartTime:      time.Now(),
		ServicesHealth: make(map[string]bool),
	}

	log.Println("=== DR TEST STARTED ===")

	// Phase 1: Create checkpoint
	checkpointTime := time.Now()
	lastOrderID, err := getLastOrderID(ctx)
	if err != nil {
		return nil, err
	}
	log.Printf("Checkpoint: Last order ID = %s at %s", lastOrderID, checkpointTime)

	// Phase 2: Trigger failover
	log.Println("Triggering failover to DR region...")
	failoverStart := time.Now()

	recovery := NewRecoveryService()
	latestBackup, _ := recovery.GetLatestBackup(ctx)

	if err := recovery.ExecuteFullRecovery(ctx, latestBackup); err != nil {
		result.Issues = append(result.Issues, fmt.Sprintf("Failover failed: %v", err))
		result.Passed = false
		return result, err
	}

	result.RTOAchieved = time.Since(failoverStart)
	log.Printf("Failover completed in %s", result.RTOAchieved)

	// Phase 3: Verify data integrity
	log.Println("Verifying data integrity...")
	drLastOrderID, err := getLastOrderID(ctx)
	if err != nil {
		result.Issues = append(result.Issues, fmt.Sprintf("Failed to verify data: %v", err))
	}

	if drLastOrderID == lastOrderID {
		result.DataIntegrity = true
		result.RPOAchieved = 0
		log.Println("Data integrity: PASSED (no data loss)")
	} else {
		result.DataIntegrity = false
		// Calculate RPO
		missingOrders := calculateMissingOrders(lastOrderID, drLastOrderID)
		result.Issues = append(result.Issues, fmt.Sprintf("Missing %d orders", missingOrders))
	}

	// Phase 4: Service health checks
	services := []string{"core", "web", "admin", "search", "notification"}
	for _, svc := range services {
		healthy := checkServiceHealth(ctx, svc)
		result.ServicesHealth[svc] = healthy
		if !healthy {
			result.Issues = append(result.Issues, fmt.Sprintf("Service %s unhealthy", svc))
		}
	}

	// Phase 5: Run smoke tests
	log.Println("Running smoke tests...")
	smokeTestResults := runSmokeTests(ctx)
	for _, tr := range smokeTestResults {
		if !tr.Passed {
			result.Issues = append(result.Issues, fmt.Sprintf("Smoke test failed: %s", tr.Name))
		}
	}

	// Phase 6: Failback
	log.Println("Initiating failback to primary...")
	if err := recovery.Failback(ctx); err != nil {
		result.Issues = append(result.Issues, fmt.Sprintf("Failback failed: %v", err))
	}

	result.EndTime = time.Now()
	result.Passed = len(result.Issues) == 0

	log.Printf("=== DR TEST COMPLETED ===")
	log.Printf("Duration: %s", result.EndTime.Sub(result.StartTime))
	log.Printf("RTO: %s (target: 4h)", result.RTOAchieved)
	log.Printf("Data Integrity: %v", result.DataIntegrity)
	log.Printf("Result: %s", map[bool]string{true: "PASSED", false: "FAILED"}[result.Passed])

	if len(result.Issues) > 0 {
		log.Println("Issues found:")
		for _, issue := range result.Issues {
			log.Printf("  - %s", issue)
		}
	}

	return result, nil
}
```

## Runbooks

### Database Failure Runbook

```markdown
# Database Failure Runbook

## Symptoms
- Application errors: "database connection refused"
- Monitoring alerts: RDS CPU/Memory spike, connection limit reached
- Health check failures on /api/v1/health/db

## Immediate Actions

### 1. Assess Situation (5 min)
- Check AWS RDS console for instance status
- Review CloudWatch metrics
- Check for ongoing AWS incidents

### 2. If RDS Instance Unreachable

#### Option A: Promote Read Replica (15 min)
```bash
# Check replica status
aws rds describe-db-instances --db-instance-identifier shop-replica

# Promote to standalone
aws rds promote-read-replica --db-instance-identifier shop-replica

# Update application config
kubectl set env deployment/core DATABASE_URL=<new-endpoint>
```

#### Option B: Restore from Snapshot (30-60 min)
```bash
# List available snapshots
aws rds describe-db-snapshots --db-instance-identifier shop-production

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier shop-restored \
  --db-snapshot-identifier <snapshot-id> \
  --db-instance-class db.r6g.xlarge

# Wait for availability
aws rds wait db-instance-available --db-instance-identifier shop-restored
```

### 3. Verify Recovery
- Run health checks
- Verify data integrity
- Monitor error rates

### 4. Post-Incident
- Document timeline
- Update monitoring
- Schedule post-mortem
```

## Communication Plan

### Incident Communication Template

```markdown
## Incident Notification

**Status**: [INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED]
**Severity**: [Critical | High | Medium | Low]
**Start Time**: YYYY-MM-DD HH:MM UTC
**Current Time**: YYYY-MM-DD HH:MM UTC

### Summary
[Brief description of the incident]

### Impact
- Affected services: [list]
- Affected users: [percentage or count]
- Business impact: [description]

### Current Actions
- [Action 1]
- [Action 2]

### Next Update
Expected at: YYYY-MM-DD HH:MM UTC

### Contact
Incident Commander: [Name]
```

## Checklist

### Pre-Disaster
- [ ] Backups running successfully
- [ ] Cross-region replication active
- [ ] DR infrastructure provisioned
- [ ] Runbooks up to date
- [ ] Team trained on procedures
- [ ] Last DR test within 90 days

### During Incident
- [ ] Incident declared and logged
- [ ] Team assembled
- [ ] Communication sent
- [ ] Recovery initiated
- [ ] Progress monitored
- [ ] Stakeholders updated

### Post-Recovery
- [ ] Services verified
- [ ] Data integrity confirmed
- [ ] Monitoring active
- [ ] Root cause identified
- [ ] Post-mortem scheduled
- [ ] Documentation updated

## Див. також

- [Monitoring](./MONITORING.md)
- [Security](./SECURITY.md)
- [Infrastructure](../infrastructure/TERRAFORM.md)
