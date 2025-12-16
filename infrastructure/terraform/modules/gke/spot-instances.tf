# Spot Instances Configuration for GKE
# Saves up to 70% on compute costs for stateless workloads

# =============================================================================
# SPOT NODE POOL - General Workloads (70% savings)
# =============================================================================

resource "google_container_node_pool" "spot_general" {
  name       = "spot-general"
  location   = var.region
  cluster    = google_container_cluster.primary.name

  # Autoscaling configuration
  autoscaling {
    min_node_count  = 0
    max_node_count  = 20
    location_policy = "BALANCED"
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    # SPOT VMs - 70% cheaper than on-demand
    spot = true

    machine_type = "n2-standard-4"  # 4 vCPU, 16 GB RAM
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    # Service account for nodes
    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Labels for workload targeting
    labels = {
      "node-type"    = "spot"
      "workload"     = "general"
      "cost-tier"    = "low"
    }

    # Taints to ensure only spot-tolerant workloads run here
    taint {
      key    = "cloud.google.com/gke-spot"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }

  # Lifecycle - handle spot preemption gracefully
  lifecycle {
    ignore_changes = [
      node_count,
    ]
  }
}

# =============================================================================
# SPOT NODE POOL - High Memory (Analytics, ClickHouse workers)
# =============================================================================

resource "google_container_node_pool" "spot_highmem" {
  name       = "spot-highmem"
  location   = var.region
  cluster    = google_container_cluster.primary.name

  autoscaling {
    min_node_count  = 0
    max_node_count  = 10
    location_policy = "BALANCED"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    spot = true

    machine_type = "n2-highmem-4"  # 4 vCPU, 32 GB RAM
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "node-type"    = "spot"
      "workload"     = "analytics"
      "cost-tier"    = "low"
    }

    taint {
      key    = "cloud.google.com/gke-spot"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    taint {
      key    = "workload"
      value  = "analytics"
      effect = "NO_SCHEDULE"
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}

# =============================================================================
# SPOT NODE POOL - AI/ML Workloads (GPU optional)
# =============================================================================

resource "google_container_node_pool" "spot_ai" {
  name       = "spot-ai"
  location   = var.region
  cluster    = google_container_cluster.primary.name

  autoscaling {
    min_node_count  = 0
    max_node_count  = 5
    location_policy = "ANY"  # More flexibility for GPU availability
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    spot = true

    machine_type = "n1-standard-8"  # 8 vCPU, 30 GB RAM
    disk_size_gb = 200
    disk_type    = "pd-ssd"

    # Optional: Add GPU for AI workloads
    # guest_accelerator {
    #   type  = "nvidia-tesla-t4"
    #   count = 1
    #   gpu_sharing_config {
    #     gpu_sharing_strategy = "TIME_SHARING"
    #     max_shared_clients_per_gpu = 4
    #   }
    # }

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "node-type"    = "spot"
      "workload"     = "ai"
      "cost-tier"    = "low"
    }

    taint {
      key    = "cloud.google.com/gke-spot"
      value  = "true"
      effect = "NO_SCHEDULE"
    }

    taint {
      key    = "workload"
      value  = "ai"
      effect = "NO_SCHEDULE"
    }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }
}

# =============================================================================
# ON-DEMAND NODE POOL - Critical Workloads (Databases, Payment)
# =============================================================================

resource "google_container_node_pool" "ondemand_critical" {
  name       = "ondemand-critical"
  location   = var.region
  cluster    = google_container_cluster.primary.name

  # Fixed size for critical workloads
  initial_node_count = 3

  autoscaling {
    min_node_count = 3
    max_node_count = 6
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    # On-demand for guaranteed availability
    spot = false

    machine_type = "n2-standard-4"
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    service_account = google_service_account.gke_nodes.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      "node-type"    = "ondemand"
      "workload"     = "critical"
      "cost-tier"    = "standard"
    }

    # No taints - accepts all workloads as fallback

    metadata = {
      disable-legacy-endpoints = "true"
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "spot_node_pools" {
  description = "Spot instance node pools"
  value = {
    general  = google_container_node_pool.spot_general.name
    highmem  = google_container_node_pool.spot_highmem.name
    ai       = google_container_node_pool.spot_ai.name
    critical = google_container_node_pool.ondemand_critical.name
  }
}
