# ============================================================
# Staging Environment Configuration
# ============================================================

environment  = "staging"
aws_region   = "eu-central-1"
project_name = "shop-platform"
domain       = "staging.shop.com"

# VPC
vpc_cidr             = "10.1.0.0/16"
private_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
public_subnet_cidrs  = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]

# EKS
cluster_name            = "shop-platform-staging"
kubernetes_version      = "1.28"
app_node_instance_types = ["t3.large"]
app_node_min_size       = 2
app_node_max_size       = 5
app_node_desired_size   = 2

# RDS (Staging: smaller instance, single-AZ)
rds_instance_class        = "db.t3.medium"
rds_allocated_storage     = 50
rds_max_allocated_storage = 200

# Redis (Staging: smaller instance)
redis_node_type = "cache.t3.medium"

# Elasticsearch
elasticsearch_instance_type = "t3.medium.elasticsearch"
elasticsearch_volume_size   = 50
