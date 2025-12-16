# Production Environment Variables

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "primary_region" {
  description = "Primary region"
  type        = string
  default     = "europe-west1"  # Belgium (closest to Ukraine)
}

variable "secondary_region" {
  description = "Secondary region for DR"
  type        = string
  default     = "europe-west4"  # Netherlands
}
