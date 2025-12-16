# Database Module Variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "instance_name" {
  description = "Database instance name"
  type        = string
}

variable "primary_region" {
  description = "Primary region"
  type        = string
}

variable "secondary_region" {
  description = "Secondary region for replica"
  type        = string
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "primary_tier" {
  description = "Machine tier for primary"
  type        = string
  default     = "db-custom-4-16384"
}

variable "replica_tier" {
  description = "Machine tier for replica"
  type        = string
  default     = "db-custom-2-8192"
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 100
}

variable "backup_location" {
  description = "Backup location"
  type        = string
  default     = "eu"
}

variable "vpc_network_id" {
  description = "VPC network ID"
  type        = string
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "shop"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "shop_admin"
}

variable "create_replica" {
  description = "Create read replica"
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Labels for resources"
  type        = map(string)
  default     = {}
}
