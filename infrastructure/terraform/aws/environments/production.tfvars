# ============================================================
# Production Environment Configuration
# ============================================================

environment  = "production"
aws_region   = "eu-central-1"
project_name = "shop-platform"
domain       = "shop.com"

# VPC
vpc_cidr             = "10.0.0.0/16"
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

# EKS
cluster_name            = "shop-platform-prod"
kubernetes_version      = "1.28"
app_node_instance_types = ["m5.xlarge", "m5.2xlarge"]
app_node_min_size       = 3
app_node_max_size       = 20
app_node_desired_size   = 5

# RDS (Production: Multi-AZ, larger instance)
rds_instance_class        = "db.r6g.xlarge"
rds_allocated_storage     = 100
rds_max_allocated_storage = 1000

# Redis (Production: larger instance)
redis_node_type = "cache.r6g.large"

# Elasticsearch
elasticsearch_instance_type = "m5.large.elasticsearch"
elasticsearch_volume_size   = 200
