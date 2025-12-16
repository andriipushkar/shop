# Terraform Infrastructure

Infrastructure as Code (IaC) для Shop Platform з підтримкою AWS та DigitalOcean.

## Архітектура

```
infrastructure/
├── terraform/
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── terraform.tfvars
│   │   ├── staging/
│   │   │   └── ...
│   │   └── production/
│   │       └── ...
│   ├── modules/
│   │   ├── networking/
│   │   ├── kubernetes/
│   │   ├── database/
│   │   ├── cache/
│   │   ├── storage/
│   │   ├── cdn/
│   │   ├── monitoring/
│   │   └── security/
│   └── global/
│       ├── backend.tf
│       └── providers.tf
```

## Провайдери

### AWS Provider

```hcl
# terraform/global/providers.tf
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "shop-platform-terraform-state"
    key            = "terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "shop-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_ca_certificate)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}
```

### DigitalOcean Provider

```hcl
# terraform/global/providers_do.tf
terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
  }

  backend "s3" {
    endpoint                    = "fra1.digitaloceanspaces.com"
    bucket                      = "shop-platform-terraform"
    key                         = "terraform.tfstate"
    region                      = "us-east-1"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
  }
}

provider "digitalocean" {
  token             = var.do_token
  spaces_access_id  = var.spaces_access_id
  spaces_secret_key = var.spaces_secret_key
}
```

## Модулі

### Networking Module (AWS)

```hcl
# terraform/modules/networking/main.tf
variable "environment" {
  type = string
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "availability_zones" {
  type    = list(string)
  default = ["eu-central-1a", "eu-central-1b", "eu-central-1c"]
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "shop-${var.environment}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "shop-${var.environment}-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                           = "shop-${var.environment}-public-${count.index + 1}"
    "kubernetes.io/role/elb"                       = "1"
    "kubernetes.io/cluster/shop-${var.environment}" = "shared"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                           = "shop-${var.environment}-private-${count.index + 1}"
    "kubernetes.io/role/internal-elb"              = "1"
    "kubernetes.io/cluster/shop-${var.environment}" = "shared"
  }
}

# NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name = "shop-${var.environment}-nat-${count.index + 1}"
  }
}

resource "aws_nat_gateway" "main" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "shop-${var.environment}-nat-${count.index + 1}"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "shop-${var.environment}-public-rt"
  }
}

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "shop-${var.environment}-private-rt-${count.index + 1}"
  }
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}
```

### Kubernetes Module (EKS)

```hcl
# terraform/modules/kubernetes/main.tf
variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "node_instance_types" {
  type    = list(string)
  default = ["t3.medium", "t3.large"]
}

variable "node_desired_size" {
  type    = number
  default = 3
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 10
}

# EKS Cluster
resource "aws_eks_cluster" "main" {
  name     = "shop-${var.environment}"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.29"

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    security_group_ids      = [aws_security_group.eks_cluster.id]
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  encryption_config {
    provider {
      key_arn = aws_kms_key.eks.arn
    }
    resources = ["secrets"]
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller,
  ]
}

# KMS Key for EKS
resource "aws_kms_key" "eks" {
  description             = "EKS Secret Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

# EKS Node Group
resource "aws_eks_node_group" "main" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "shop-${var.environment}-workers"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = var.node_instance_types
  capacity_type   = "ON_DEMAND"

  scaling_config {
    desired_size = var.node_desired_size
    min_size     = var.node_min_size
    max_size     = var.node_max_size
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    Environment = var.environment
    Role        = "worker"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_policy,
  ]
}

# Spot Node Group for cost optimization
resource "aws_eks_node_group" "spot" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "shop-${var.environment}-spot"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnet_ids
  instance_types  = ["t3.large", "t3.xlarge", "t3a.large", "t3a.xlarge"]
  capacity_type   = "SPOT"

  scaling_config {
    desired_size = 2
    min_size     = 0
    max_size     = 20
  }

  labels = {
    Environment  = var.environment
    Role         = "worker"
    CapacityType = "spot"
  }

  taint {
    key    = "spot"
    value  = "true"
    effect = "PREFER_NO_SCHEDULE"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_policy,
  ]
}

# IAM Roles
resource "aws_iam_role" "eks_cluster" {
  name = "shop-${var.environment}-eks-cluster"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
  role       = aws_iam_role.eks_cluster.name
}

resource "aws_iam_role" "eks_nodes" {
  name = "shop-${var.environment}-eks-nodes"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker_node_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_nodes.name
}

resource "aws_iam_role_policy_attachment" "eks_ecr_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_nodes.name
}

# Security Group
resource "aws_security_group" "eks_cluster" {
  name_prefix = "shop-${var.environment}-eks-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cluster_ca_certificate" {
  value = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_security_group_id" {
  value = aws_security_group.eks_cluster.id
}
```

### Database Module (RDS)

```hcl
# terraform/modules/database/main.tf
variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "instance_class" {
  type    = string
  default = "db.r6g.large"
}

variable "allocated_storage" {
  type    = number
  default = 100
}

variable "multi_az" {
  type    = bool
  default = true
}

# Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "shop-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "shop-${var.environment}-db-subnet"
  }
}

# Security Group
resource "aws_security_group" "rds" {
  name_prefix = "shop-${var.environment}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Parameter Group
resource "aws_db_parameter_group" "main" {
  family = "postgres15"
  name   = "shop-${var.environment}"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "max_connections"
    value = "500"
  }
}

# Random password
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "shop-${var.environment}/database"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = "shop_admin"
    password = random_password.db_password.result
    host     = aws_db_instance.main.address
    port     = 5432
    database = "shop_${var.environment}"
  })
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "shop-${var.environment}"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  db_name  = "shop_${var.environment}"
  username = "shop_admin"
  password = random_password.db_password.result

  multi_az               = var.multi_az
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "shop-${var.environment}-final"

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "shop-${var.environment}-db"
  }
}

# Read Replica (Production only)
resource "aws_db_instance" "replica" {
  count = var.environment == "production" ? 1 : 0

  identifier          = "shop-${var.environment}-replica"
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.instance_class

  storage_encrypted = true
  kms_key_id        = aws_kms_key.rds.arn

  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
}

# KMS Key
resource "aws_kms_key" "rds" {
  description             = "RDS Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}

output "replica_endpoint" {
  value = var.environment == "production" ? aws_db_instance.replica[0].endpoint : null
}
```

### Cache Module (ElastiCache)

```hcl
# terraform/modules/cache/main.tf
variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "node_type" {
  type    = string
  default = "cache.r6g.large"
}

variable "num_cache_clusters" {
  type    = number
  default = 2
}

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "shop-${var.environment}"
  subnet_ids = var.private_subnet_ids
}

# Security Group
resource "aws_security_group" "redis" {
  name_prefix = "shop-${var.environment}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.eks_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "shop-${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }
}

# Replication Group (Cluster Mode Disabled)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "shop-${var.environment}"
  description          = "Redis cluster for Shop Platform"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_clusters
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
  parameter_group_name = aws_elasticache_parameter_group.main.name

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  snapshot_retention_limit = 7
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "sun:06:00-sun:07:00"

  apply_immediately = false
}

# Auth Token
resource "random_password" "redis_auth" {
  length  = 32
  special = false
}

# Secrets Manager
resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "shop-${var.environment}/redis"
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    host      = aws_elasticache_replication_group.main.primary_endpoint_address
    port      = 6379
    auth      = random_password.redis_auth.result
    read_host = aws_elasticache_replication_group.main.reader_endpoint_address
  })
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  value = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_secret_arn" {
  value = aws_secretsmanager_secret.redis_credentials.arn
}
```

### Storage Module (S3)

```hcl
# terraform/modules/storage/main.tf
variable "environment" {
  type = string
}

variable "domain" {
  type = string
}

# Main Storage Bucket
resource "aws_s3_bucket" "storage" {
  bucket = "shop-${var.environment}-storage"

  tags = {
    Name = "shop-${var.environment}-storage"
  }
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.storage.arn
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    id     = "delete-temp-files"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "archive-old-files"
    status = "Enabled"

    filter {
      prefix = "archives/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${var.domain}", "https://*.${var.domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Public Assets Bucket
resource "aws_s3_bucket" "assets" {
  bucket = "shop-${var.environment}-assets"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "assets" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadGetObject"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.assets.arn}/*"
    }]
  })

  depends_on = [aws_s3_bucket_public_access_block.assets]
}

# Backup Bucket
resource "aws_s3_bucket" "backups" {
  bucket = "shop-${var.environment}-backups"
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# KMS Key
resource "aws_kms_key" "storage" {
  description             = "S3 Storage Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

output "storage_bucket_name" {
  value = aws_s3_bucket.storage.id
}

output "assets_bucket_name" {
  value = aws_s3_bucket.assets.id
}

output "backups_bucket_name" {
  value = aws_s3_bucket.backups.id
}

output "storage_bucket_arn" {
  value = aws_s3_bucket.storage.arn
}
```

### CDN Module (CloudFront)

```hcl
# terraform/modules/cdn/main.tf
variable "environment" {
  type = string
}

variable "domain" {
  type = string
}

variable "assets_bucket_domain" {
  type = string
}

variable "acm_certificate_arn" {
  type = string
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "main" {
  comment = "OAI for Shop ${var.environment}"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Shop Platform CDN - ${var.environment}"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  aliases             = ["cdn.${var.domain}"]

  # S3 Origin for static assets
  origin {
    domain_name = var.assets_bucket_domain
    origin_id   = "S3-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.main.cloudfront_access_identity_path
    }
  }

  # API Gateway Origin
  origin {
    domain_name = "api.${var.domain}"
    origin_id   = "API"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior for static assets
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-assets"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
  }

  # API cache behavior
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "X-Tenant-ID", "Accept-Language"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # Images cache behavior
  ordered_cache_behavior {
    path_pattern     = "/images/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-assets"

    forwarded_values {
      query_string = true
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 604800
    max_ttl                = 31536000
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.image_optimization.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = {
    Environment = var.environment
  }
}

# Image Optimization Function
resource "aws_cloudfront_function" "image_optimization" {
  name    = "shop-${var.environment}-image-optimization"
  runtime = "cloudfront-js-1.0"
  comment = "Image optimization and resizing"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // Add WebP support
      var accept = request.headers.accept;
      if (accept && accept.value.includes('image/webp')) {
        if (uri.match(/\.(jpg|jpeg|png)$/i)) {
          request.uri = uri.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        }
      }

      return request;
    }
  EOF
}

output "distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "distribution_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}
```

### Monitoring Module

```hcl
# terraform/modules/monitoring/main.tf
variable "environment" {
  type = string
}

variable "slack_webhook_url" {
  type      = string
  sensitive = true
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "application" {
  name              = "/shop/${var.environment}/application"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "access" {
  name              = "/shop/${var.environment}/access"
  retention_in_days = 14
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "shop-${var.environment}-alerts"
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "shop-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EKS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "High CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = "shop-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "shop-${var.environment}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "ContainerInsights"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "High memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = "shop-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name          = "shop-${var.environment}-db-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 400
  alarm_description   = "High database connections"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = "shop-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_rate" {
  alarm_name          = "shop-${var.environment}-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High 5XX error rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Lambda for Slack notifications
resource "aws_lambda_function" "slack_notifier" {
  filename         = data.archive_file.slack_notifier.output_path
  function_name    = "shop-${var.environment}-slack-notifier"
  role             = aws_iam_role.lambda_slack.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.slack_notifier.output_base64sha256
  runtime          = "nodejs18.x"

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
    }
  }
}

data "archive_file" "slack_notifier" {
  type        = "zip"
  output_path = "${path.module}/slack_notifier.zip"

  source {
    content  = <<-EOF
      const https = require('https');

      exports.handler = async (event) => {
        const message = JSON.parse(event.Records[0].Sns.Message);

        const payload = JSON.stringify({
          text: `:warning: *${message.AlarmName}*\n${message.AlarmDescription}\nState: ${message.NewStateValue}`,
          attachments: [{
            color: message.NewStateValue === 'ALARM' ? 'danger' : 'good',
            fields: [{
              title: 'Region',
              value: message.Region,
              short: true
            }, {
              title: 'Timestamp',
              value: message.StateChangeTime,
              short: true
            }]
          }]
        });

        const url = new URL(process.env.SLACK_WEBHOOK_URL);

        return new Promise((resolve, reject) => {
          const req = https.request({
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, (res) => resolve({ statusCode: res.statusCode }));

          req.on('error', reject);
          req.write(payload);
          req.end();
        });
      };
    EOF
    filename = "index.js"
  }
}

resource "aws_iam_role" "lambda_slack" {
  name = "shop-${var.environment}-lambda-slack"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_sns_topic_subscription" "slack" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier.arn
}

resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.slack_notifier.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alerts.arn
}

output "log_group_application" {
  value = aws_cloudwatch_log_group.application.name
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
```

## Environment Configuration

### Production

```hcl
# terraform/environments/production/main.tf
module "networking" {
  source      = "../../modules/networking"
  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
}

module "kubernetes" {
  source             = "../../modules/kubernetes"
  environment        = "production"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  node_instance_types = ["t3.large", "t3.xlarge"]
  node_desired_size  = 5
  node_min_size      = 3
  node_max_size      = 20
}

module "database" {
  source                = "../../modules/database"
  environment           = "production"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.kubernetes.cluster_security_group_id
  instance_class        = "db.r6g.xlarge"
  allocated_storage     = 500
  multi_az              = true
}

module "cache" {
  source                = "../../modules/cache"
  environment           = "production"
  vpc_id                = module.networking.vpc_id
  private_subnet_ids    = module.networking.private_subnet_ids
  eks_security_group_id = module.kubernetes.cluster_security_group_id
  node_type             = "cache.r6g.large"
  num_cache_clusters    = 3
}

module "storage" {
  source      = "../../modules/storage"
  environment = "production"
  domain      = "shop-platform.com"
}

module "cdn" {
  source               = "../../modules/cdn"
  environment          = "production"
  domain               = "shop-platform.com"
  assets_bucket_domain = module.storage.assets_bucket_domain
  acm_certificate_arn  = var.acm_certificate_arn
}

module "monitoring" {
  source            = "../../modules/monitoring"
  environment       = "production"
  slack_webhook_url = var.slack_webhook_url
}
```

### Variables

```hcl
# terraform/environments/production/variables.tf
variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for CloudFront"
}

variable "slack_webhook_url" {
  type        = string
  description = "Slack webhook URL for alerts"
  sensitive   = true
}
```

## Команди

### Ініціалізація

```bash
# Ініціалізація Terraform
cd terraform/environments/production
terraform init

# Валідація конфігурації
terraform validate

# Форматування коду
terraform fmt -recursive
```

### Планування та застосування

```bash
# Планування змін
terraform plan -out=tfplan

# Застосування змін
terraform apply tfplan

# Знищення інфраструктури (обережно!)
terraform destroy
```

### Робота з воркспейсами

```bash
# Створення нового воркспейсу
terraform workspace new staging

# Перемикання між воркспейсами
terraform workspace select production

# Список воркспейсів
terraform workspace list
```

## CI/CD Pipeline

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  push:
    branches: [main]
    paths:
      - 'terraform/**'
  pull_request:
    branches: [main]
    paths:
      - 'terraform/**'

env:
  TF_VERSION: '1.6.0'
  AWS_REGION: 'eu-central-1'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Format
        run: terraform fmt -check -recursive
        working-directory: terraform

      - name: Terraform Init
        run: terraform init -backend=false
        working-directory: terraform/environments/production

      - name: Terraform Validate
        run: terraform validate
        working-directory: terraform/environments/production

  plan:
    needs: validate
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/production

      - name: Terraform Plan
        run: terraform plan -no-color
        working-directory: terraform/environments/production
        continue-on-error: true

  apply:
    needs: validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: ${{ env.TF_VERSION }}

      - name: Terraform Init
        run: terraform init
        working-directory: terraform/environments/production

      - name: Terraform Apply
        run: terraform apply -auto-approve
        working-directory: terraform/environments/production
```

## Див. також

- [Kubernetes Deployment](./KUBERNETES.md)
- [Environment Variables](./ENV_VARS.md)
- [Database Schema](./DATABASE_SCHEMA.md)
