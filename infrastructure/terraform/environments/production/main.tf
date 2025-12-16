# Production Environment - Multi-Region Setup

terraform {
  required_version = ">= 1.5.0"

  backend "gcs" {
    bucket = "shop-terraform-state-prod"
    prefix = "production"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.primary_region
}

provider "google-beta" {
  project = var.project_id
  region  = var.primary_region
}

# Locals
locals {
  environment = "production"
  labels = {
    environment = local.environment
    managed-by  = "terraform"
    project     = "shop"
  }
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_id       = var.project_id
  network_name     = "shop-${local.environment}"
  primary_region   = var.primary_region
  secondary_region = var.secondary_region

  primary_cidr          = "10.0.0.0/20"
  primary_pods_cidr     = "10.4.0.0/14"
  primary_services_cidr = "10.8.0.0/20"

  secondary_cidr          = "10.16.0.0/20"
  secondary_pods_cidr     = "10.20.0.0/14"
  secondary_services_cidr = "10.24.0.0/20"

  ssl_domains = [
    "shop.example.com",
    "api.shop.example.com",
    "admin.shop.example.com"
  ]
}

# GKE Cluster - Primary Region
module "gke_primary" {
  source = "../../modules/gke"

  project_id           = var.project_id
  cluster_name         = "shop-${local.environment}-primary"
  region               = var.primary_region
  node_zones           = ["${var.primary_region}-b", "${var.primary_region}-c", "${var.primary_region}-d"]
  vpc_network          = module.networking.network_name
  vpc_subnetwork       = module.networking.primary_subnetwork
  pods_range_name      = "pods"
  services_range_name  = "services"
  node_service_account = google_service_account.gke_nodes.email

  release_channel = "REGULAR"

  primary_pool_min_nodes    = 3
  primary_pool_max_nodes    = 20
  primary_pool_machine_type = "e2-standard-4"

  create_highmem_pool       = true
  highmem_pool_min_nodes    = 2
  highmem_pool_max_nodes    = 10
  highmem_pool_machine_type = "n2-highmem-8"

  enable_binary_auth = true
  use_spot_instances = false

  master_authorized_networks = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "all"  # Restrict in production
    }
  ]

  labels    = local.labels
  node_tags = ["gke-node", "shop-${local.environment}"]

  depends_on = [module.networking]
}

# GKE Cluster - Secondary Region (DR)
module "gke_secondary" {
  source = "../../modules/gke"

  project_id           = var.project_id
  cluster_name         = "shop-${local.environment}-secondary"
  region               = var.secondary_region
  node_zones           = ["${var.secondary_region}-a", "${var.secondary_region}-b", "${var.secondary_region}-c"]
  vpc_network          = module.networking.network_name
  vpc_subnetwork       = module.networking.secondary_subnetwork
  pods_range_name      = "pods"
  services_range_name  = "services"
  node_service_account = google_service_account.gke_nodes.email

  master_ipv4_cidr_block = "172.16.1.0/28"
  release_channel        = "REGULAR"

  primary_pool_min_nodes    = 2
  primary_pool_max_nodes    = 15
  primary_pool_machine_type = "e2-standard-4"

  create_highmem_pool       = true
  highmem_pool_min_nodes    = 1
  highmem_pool_max_nodes    = 5
  highmem_pool_machine_type = "n2-highmem-8"

  enable_binary_auth = true
  use_spot_instances = false

  master_authorized_networks = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "all"
    }
  ]

  labels    = local.labels
  node_tags = ["gke-node", "shop-${local.environment}"]

  depends_on = [module.networking]
}

# Database
module "database" {
  source = "../../modules/database"

  project_id       = var.project_id
  instance_name    = "shop-${local.environment}"
  primary_region   = var.primary_region
  secondary_region = var.secondary_region

  vpc_network_id = module.networking.network_id

  primary_tier = "db-custom-8-32768"
  replica_tier = "db-custom-4-16384"
  disk_size    = 500

  create_replica      = true
  deletion_protection = true

  labels = local.labels

  depends_on = [module.networking]
}

# Service Account for GKE Nodes
resource "google_service_account" "gke_nodes" {
  account_id   = "gke-nodes-${local.environment}"
  display_name = "GKE Nodes Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "gke_nodes_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_monitoring_viewer" {
  project = var.project_id
  role    = "roles/monitoring.viewer"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

resource "google_project_iam_member" "gke_nodes_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_nodes.email}"
}

# Redis (Memorystore)
resource "google_redis_instance" "cache" {
  name           = "shop-${local.environment}-cache"
  project        = var.project_id
  region         = var.primary_region
  tier           = "STANDARD_HA"
  memory_size_gb = 5

  redis_version     = "REDIS_7_0"
  display_name      = "Shop Cache - ${local.environment}"
  authorized_network = module.networking.network_id

  replica_count = 1
  read_replicas_mode = "READ_REPLICAS_ENABLED"

  transit_encryption_mode = "SERVER_AUTHENTICATION"
  connect_mode           = "PRIVATE_SERVICE_ACCESS"

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
      }
    }
  }

  labels = local.labels

  depends_on = [module.networking]
}

# Outputs
output "primary_cluster_name" {
  value = module.gke_primary.cluster_name
}

output "secondary_cluster_name" {
  value = module.gke_secondary.cluster_name
}

output "database_connection" {
  value     = module.database.primary_connection_name
  sensitive = true
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "lb_ip_address" {
  value = module.networking.lb_ip_address
}
