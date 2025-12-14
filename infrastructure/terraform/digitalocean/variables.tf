# ============================================================
# Variables for DigitalOcean Infrastructure
# ============================================================

variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name"
  type        = string

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "shop-platform"
}

variable "domain" {
  description = "Root domain"
  type        = string
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "fra1" # Frankfurt
}

variable "spaces_region" {
  description = "DigitalOcean Spaces region"
  type        = string
  default     = "fra1"
}

# VPC
variable "vpc_ip_range" {
  description = "VPC IP range"
  type        = string
  default     = "10.10.10.0/24"
}

# Kubernetes
variable "kubernetes_version" {
  description = "Kubernetes version"
  type        = string
  default     = "1.28.2-do.0"
}

variable "system_node_size" {
  description = "System node pool droplet size"
  type        = string
  default     = "s-2vcpu-4gb"
}

variable "system_node_count" {
  description = "System node pool initial count"
  type        = number
  default     = 2
}

variable "app_node_size" {
  description = "Application node pool droplet size"
  type        = string
  default     = "s-4vcpu-8gb"
}

variable "app_node_min" {
  description = "Application node pool minimum nodes"
  type        = number
  default     = 2
}

variable "app_node_max" {
  description = "Application node pool maximum nodes"
  type        = number
  default     = 10
}

# Database
variable "db_size" {
  description = "Database droplet size"
  type        = string
  default     = "db-s-2vcpu-4gb"
}

# Redis
variable "redis_size" {
  description = "Redis droplet size"
  type        = string
  default     = "db-s-1vcpu-2gb"
}

# DNS
variable "use_do_dns" {
  description = "Use DigitalOcean DNS"
  type        = bool
  default     = false
}
