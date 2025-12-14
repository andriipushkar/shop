# ============================================================
# Outputs for AWS Infrastructure
# ============================================================

# VPC
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

# EKS
output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS cluster CA data"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_oidc_provider_arn" {
  description = "OIDC provider ARN for IRSA"
  value       = module.eks.oidc_provider_arn
}

# RDS
output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_port" {
  description = "RDS port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_instance_name
}

# Redis
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.cluster_address
}

output "redis_port" {
  description = "ElastiCache Redis port"
  value       = 6379
}

# S3 Buckets
output "s3_images_bucket" {
  description = "S3 bucket for images"
  value       = module.s3_images.s3_bucket_id
}

output "s3_static_bucket" {
  description = "S3 bucket for static assets"
  value       = module.s3_static.s3_bucket_id
}

output "s3_backups_bucket" {
  description = "S3 bucket for backups"
  value       = module.s3_backups.s3_bucket_id
}

# CloudFront
output "cdn_domain" {
  description = "CloudFront distribution domain"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cdn_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.cdn.id
}

# Load Balancer
output "alb_dns_name" {
  description = "ALB DNS name"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "ALB zone ID"
  value       = aws_lb.main.zone_id
}

# Secrets
output "database_secret_arn" {
  description = "ARN of database credentials secret"
  value       = aws_secretsmanager_secret.database.arn
}

output "redis_secret_arn" {
  description = "ARN of Redis credentials secret"
  value       = aws_secretsmanager_secret.redis.arn
}

# IRSA Roles
output "s3_role_arn" {
  description = "IAM role ARN for S3 access"
  value       = module.s3_irsa.iam_role_arn
}

output "secrets_role_arn" {
  description = "IAM role ARN for Secrets Manager access"
  value       = module.secrets_irsa.iam_role_arn
}

# Kubeconfig command
output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
