# GKE Cluster Module for Multi-Region Deployment

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  provider = google-beta

  name     = var.cluster_name
  location = var.region

  # Regional cluster for high availability
  node_locations = var.node_zones

  # VPC-native cluster
  network    = var.vpc_network
  subnetwork = var.vpc_subnetwork

  # Use release channel for automatic upgrades
  release_channel {
    channel = var.release_channel
  }

  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Private cluster config
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  # IP allocation policy for VPC-native
  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  # Master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Addons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gce_persistent_disk_csi_driver_config {
      enabled = true
    }
    gcp_filestore_csi_driver_config {
      enabled = true
    }
    dns_cache_config {
      enabled = true
    }
  }

  # Enable network policy
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = var.maintenance_start_time
      end_time   = var.maintenance_end_time
      recurrence = var.maintenance_recurrence
    }
  }

  # Enable Dataplane V2 (eBPF)
  datapath_provider = "ADVANCED_DATAPATH"

  # Binary Authorization
  binary_authorization {
    evaluation_mode = var.enable_binary_auth ? "PROJECT_SINGLETON_POLICY_ENFORCE" : "DISABLED"
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
    managed_prometheus {
      enabled = true
    }
  }

  # Cost management
  cost_management_config {
    enabled = true
  }

  # Security posture
  security_posture_config {
    mode               = "BASIC"
    vulnerability_mode = "VULNERABILITY_BASIC"
  }

  # Gateway API
  gateway_api_config {
    channel = "CHANNEL_STANDARD"
  }

  # Resource labels
  resource_labels = var.labels

  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  lifecycle {
    ignore_changes = [
      node_config,
      initial_node_count
    ]
  }
}

# Primary Node Pool - General Workloads
resource "google_container_node_pool" "primary" {
  name     = "${var.cluster_name}-primary-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  # Auto-scaling
  autoscaling {
    min_node_count  = var.primary_pool_min_nodes
    max_node_count  = var.primary_pool_max_nodes
    location_policy = "BALANCED"
  }

  # Management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 2
    max_unavailable = 0
    strategy        = "SURGE"
  }

  node_config {
    machine_type = var.primary_pool_machine_type
    disk_size_gb = var.primary_pool_disk_size
    disk_type    = "pd-ssd"

    # Service account
    service_account = var.node_service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Shielded instance
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Spot VMs for cost savings (optional)
    spot = var.use_spot_instances

    # Labels and taints
    labels = merge(var.labels, {
      "node-pool" = "primary"
    })

    tags = var.node_tags

    # Resource labels for GCE
    resource_labels = var.labels
  }
}

# High-Memory Node Pool - For databases and caches
resource "google_container_node_pool" "highmem" {
  count = var.create_highmem_pool ? 1 : 0

  name     = "${var.cluster_name}-highmem-pool"
  location = var.region
  cluster  = google_container_cluster.primary.name

  autoscaling {
    min_node_count  = var.highmem_pool_min_nodes
    max_node_count  = var.highmem_pool_max_nodes
    location_policy = "BALANCED"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.highmem_pool_machine_type
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    service_account = var.node_service_account
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = merge(var.labels, {
      "node-pool" = "highmem"
    })

    taint {
      key    = "workload"
      value  = "database"
      effect = "NO_SCHEDULE"
    }

    tags = var.node_tags
  }
}

# Outputs
output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  value     = google_container_cluster.primary.endpoint
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive = true
}

output "cluster_location" {
  value = google_container_cluster.primary.location
}
