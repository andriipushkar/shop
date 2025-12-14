# ============================================================
# Disaster Recovery & Backup Automation
# ============================================================
# This module provides:
# - Cross-region RDS replication
# - S3 cross-region replication
# - Automated backup schedules
# - Recovery procedures
# ============================================================

# ============================================================
# Variables for DR
# ============================================================

variable "enable_dr" {
  description = "Enable disaster recovery setup"
  type        = bool
  default     = false
}

variable "dr_region" {
  description = "DR region for cross-region replication"
  type        = string
  default     = "eu-west-1"
}

# ============================================================
# DR Provider (Secondary Region)
# ============================================================

provider "aws" {
  alias  = "dr"
  region = var.dr_region

  default_tags {
    tags = {
      Project     = "shop-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Purpose     = "disaster-recovery"
    }
  }
}

# ============================================================
# RDS Read Replica (Cross-Region)
# ============================================================

resource "aws_db_instance" "replica" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr

  identifier          = "${var.project_name}-${var.environment}-replica"
  replicate_source_db = module.rds.db_instance_arn

  instance_class      = var.rds_instance_class
  storage_encrypted   = true

  # Network
  vpc_security_group_ids = [aws_security_group.rds_dr[0].id]

  # Backup settings for replica
  backup_retention_period = 7
  backup_window          = "03:00-06:00"

  # Performance Insights
  performance_insights_enabled = true

  tags = {
    Name = "${var.project_name}-${var.environment}-replica"
    Role = "read-replica"
  }
}

# DR VPC for replica
module "vpc_dr" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  providers = {
    aws = aws.dr
  }

  name = "${var.project_name}-${var.environment}-dr"
  cidr = "10.1.0.0/16"

  azs             = ["${var.dr_region}a", "${var.dr_region}b", "${var.dr_region}c"]
  private_subnets = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnets  = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_security_group" "rds_dr" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr

  name        = "${var.project_name}-rds-dr-${var.environment}"
  description = "Security group for RDS replica in DR region"
  vpc_id      = module.vpc_dr[0].vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc_dr[0].vpc_cidr_block]
  }
}

# ============================================================
# S3 Cross-Region Replication
# ============================================================

# Replication role
resource "aws_iam_role" "s3_replication" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  name = "${var.project_name}-s3-replication-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "s3_replication" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  name = "${var.project_name}-s3-replication-policy"
  role = aws_iam_role.s3_replication[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket"
        ]
        Resource = [
          module.s3_images.s3_bucket_arn,
          module.s3_backups.s3_bucket_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging"
        ]
        Resource = [
          "${module.s3_images.s3_bucket_arn}/*",
          "${module.s3_backups.s3_bucket_arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags"
        ]
        Resource = [
          "${aws_s3_bucket.images_replica[0].arn}/*",
          "${aws_s3_bucket.backups_replica[0].arn}/*"
        ]
      }
    ]
  })
}

# Images replica bucket in DR region
resource "aws_s3_bucket" "images_replica" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr
  bucket   = "${var.project_name}-images-replica-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "images_replica" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr
  bucket   = aws_s3_bucket.images_replica[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

# Backups replica bucket in DR region
resource "aws_s3_bucket" "backups_replica" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr
  bucket   = "${var.project_name}-backups-replica-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "backups_replica" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr
  bucket   = aws_s3_bucket.backups_replica[0].id

  versioning_configuration {
    status = "Enabled"
  }
}

# Replication configuration for images bucket
resource "aws_s3_bucket_replication_configuration" "images" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  depends_on = [aws_s3_bucket_versioning.images_replica]

  role   = aws_iam_role.s3_replication[0].arn
  bucket = module.s3_images.s3_bucket_id

  rule {
    id     = "replicate-all"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.images_replica[0].arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = "arn:aws:kms:${var.dr_region}:${data.aws_caller_identity.current.account_id}:alias/aws/s3"
      }
    }

    filter {
      prefix = ""
    }

    delete_marker_replication {
      status = "Enabled"
    }
  }
}

# Replication configuration for backups bucket
resource "aws_s3_bucket_replication_configuration" "backups" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  depends_on = [aws_s3_bucket_versioning.backups_replica]

  role   = aws_iam_role.s3_replication[0].arn
  bucket = module.s3_backups.s3_bucket_id

  rule {
    id     = "replicate-backups"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.backups_replica[0].arn
      storage_class = "GLACIER"
    }

    filter {
      prefix = ""
    }
  }
}

# ============================================================
# AWS Backup for automated backups
# ============================================================

resource "aws_backup_vault" "main" {
  name = "${var.project_name}-${var.environment}"

  tags = {
    Name = "${var.project_name}-backup-vault"
  }
}

resource "aws_backup_plan" "main" {
  name = "${var.project_name}-${var.environment}-backup-plan"

  # Daily backups
  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 3 * * ? *)" # 3 AM UTC daily

    lifecycle {
      delete_after = var.environment == "production" ? 30 : 7
    }

    copy_action {
      destination_vault_arn = var.enable_dr ? aws_backup_vault.dr[0].arn : null

      lifecycle {
        delete_after = var.environment == "production" ? 90 : 14
      }
    }
  }

  # Weekly backups (production only)
  dynamic "rule" {
    for_each = var.environment == "production" ? [1] : []
    content {
      rule_name         = "weekly-backup"
      target_vault_name = aws_backup_vault.main.name
      schedule          = "cron(0 4 ? * SUN *)" # 4 AM UTC every Sunday

      lifecycle {
        cold_storage_after = 30
        delete_after       = 365
      }
    }
  }

  # Monthly backups (production only)
  dynamic "rule" {
    for_each = var.environment == "production" ? [1] : []
    content {
      rule_name         = "monthly-backup"
      target_vault_name = aws_backup_vault.main.name
      schedule          = "cron(0 5 1 * ? *)" # 5 AM UTC first day of month

      lifecycle {
        cold_storage_after = 90
        delete_after       = 2555 # 7 years
      }
    }
  }
}

# DR backup vault
resource "aws_backup_vault" "dr" {
  count = var.enable_dr && var.environment == "production" ? 1 : 0

  provider = aws.dr
  name     = "${var.project_name}-${var.environment}-dr"
}

# Backup selection - what to backup
resource "aws_backup_selection" "main" {
  name         = "${var.project_name}-${var.environment}-selection"
  plan_id      = aws_backup_plan.main.id
  iam_role_arn = aws_iam_role.backup.arn

  # Backup RDS
  resources = [
    module.rds.db_instance_arn
  ]

  # Backup EBS volumes with specific tags
  selection_tag {
    type  = "STRINGEQUALS"
    key   = "Backup"
    value = "true"
  }
}

# Backup IAM role
resource "aws_iam_role" "backup" {
  name = "${var.project_name}-backup-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

# ============================================================
# SNS for Backup notifications
# ============================================================

resource "aws_sns_topic" "backup_notifications" {
  name = "${var.project_name}-${var.environment}-backup-notifications"
}

resource "aws_backup_vault_notifications" "main" {
  backup_vault_name   = aws_backup_vault.main.name
  sns_topic_arn       = aws_sns_topic.backup_notifications.arn
  backup_vault_events = [
    "BACKUP_JOB_STARTED",
    "BACKUP_JOB_COMPLETED",
    "BACKUP_JOB_FAILED",
    "RESTORE_JOB_STARTED",
    "RESTORE_JOB_COMPLETED",
    "RESTORE_JOB_FAILED",
  ]
}

# ============================================================
# Outputs
# ============================================================

output "backup_vault_arn" {
  description = "ARN of backup vault"
  value       = aws_backup_vault.main.arn
}

output "backup_plan_id" {
  description = "ID of backup plan"
  value       = aws_backup_plan.main.id
}

output "dr_rds_endpoint" {
  description = "DR RDS replica endpoint"
  value       = var.enable_dr && var.environment == "production" ? aws_db_instance.replica[0].endpoint : null
}

output "images_replica_bucket" {
  description = "S3 images replica bucket in DR region"
  value       = var.enable_dr && var.environment == "production" ? aws_s3_bucket.images_replica[0].id : null
}
