# GKE Module Variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "node_zones" {
  description = "Zones for nodes"
  type        = list(string)
  default     = []
}

variable "vpc_network" {
  description = "VPC network name"
  type        = string
}

variable "vpc_subnetwork" {
  description = "VPC subnetwork name"
  type        = string
}

variable "pods_range_name" {
  description = "Secondary range name for pods"
  type        = string
}

variable "services_range_name" {
  description = "Secondary range name for services"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for master network"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "Authorized networks for master access"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = []
}

variable "release_channel" {
  description = "GKE release channel"
  type        = string
  default     = "REGULAR"
}

variable "maintenance_start_time" {
  description = "Maintenance window start time"
  type        = string
  default     = "2024-01-01T02:00:00Z"
}

variable "maintenance_end_time" {
  description = "Maintenance window end time"
  type        = string
  default     = "2024-01-01T06:00:00Z"
}

variable "maintenance_recurrence" {
  description = "Maintenance recurrence"
  type        = string
  default     = "FREQ=WEEKLY;BYDAY=SA,SU"
}

variable "enable_binary_auth" {
  description = "Enable Binary Authorization"
  type        = bool
  default     = true
}

variable "node_service_account" {
  description = "Service account for nodes"
  type        = string
}

variable "primary_pool_min_nodes" {
  description = "Minimum nodes in primary pool"
  type        = number
  default     = 2
}

variable "primary_pool_max_nodes" {
  description = "Maximum nodes in primary pool"
  type        = number
  default     = 10
}

variable "primary_pool_machine_type" {
  description = "Machine type for primary pool"
  type        = string
  default     = "e2-standard-4"
}

variable "primary_pool_disk_size" {
  description = "Disk size for primary pool nodes"
  type        = number
  default     = 100
}

variable "use_spot_instances" {
  description = "Use spot instances for cost savings"
  type        = bool
  default     = false
}

variable "create_highmem_pool" {
  description = "Create high-memory node pool"
  type        = bool
  default     = true
}

variable "highmem_pool_min_nodes" {
  description = "Minimum nodes in highmem pool"
  type        = number
  default     = 1
}

variable "highmem_pool_max_nodes" {
  description = "Maximum nodes in highmem pool"
  type        = number
  default     = 5
}

variable "highmem_pool_machine_type" {
  description = "Machine type for highmem pool"
  type        = string
  default     = "n2-highmem-4"
}

variable "labels" {
  description = "Labels for resources"
  type        = map(string)
  default     = {}
}

variable "node_tags" {
  description = "Network tags for nodes"
  type        = list(string)
  default     = []
}
