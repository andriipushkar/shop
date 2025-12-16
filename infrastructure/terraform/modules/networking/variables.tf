# Networking Module Variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "network_name" {
  description = "VPC network name"
  type        = string
}

variable "primary_region" {
  description = "Primary region"
  type        = string
  default     = "europe-west1"
}

variable "secondary_region" {
  description = "Secondary region for DR"
  type        = string
  default     = "europe-west4"
}

variable "primary_cidr" {
  description = "Primary subnet CIDR"
  type        = string
  default     = "10.0.0.0/20"
}

variable "primary_pods_cidr" {
  description = "Primary pods CIDR"
  type        = string
  default     = "10.4.0.0/14"
}

variable "primary_services_cidr" {
  description = "Primary services CIDR"
  type        = string
  default     = "10.8.0.0/20"
}

variable "secondary_cidr" {
  description = "Secondary subnet CIDR"
  type        = string
  default     = "10.16.0.0/20"
}

variable "secondary_pods_cidr" {
  description = "Secondary pods CIDR"
  type        = string
  default     = "10.20.0.0/14"
}

variable "secondary_services_cidr" {
  description = "Secondary services CIDR"
  type        = string
  default     = "10.24.0.0/20"
}

variable "master_cidr_primary" {
  description = "Master CIDR for primary cluster"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_cidr_secondary" {
  description = "Master CIDR for secondary cluster"
  type        = string
  default     = "172.16.1.0/28"
}

variable "ssl_domains" {
  description = "Domains for SSL certificate"
  type        = list(string)
  default     = []
}
