# Multi-Region Networking Module

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# VPC Network
resource "google_compute_network" "main" {
  name                    = var.network_name
  project                 = var.project_id
  auto_create_subnetworks = false
  routing_mode            = "GLOBAL"
}

# Primary Region Subnetwork
resource "google_compute_subnetwork" "primary" {
  name          = "${var.network_name}-primary"
  project       = var.project_id
  region        = var.primary_region
  network       = google_compute_network.main.id
  ip_cidr_range = var.primary_cidr

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.primary_pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.primary_services_cidr
  }

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Secondary Region Subnetwork (DR)
resource "google_compute_subnetwork" "secondary" {
  name          = "${var.network_name}-secondary"
  project       = var.project_id
  region        = var.secondary_region
  network       = google_compute_network.main.id
  ip_cidr_range = var.secondary_cidr

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.secondary_pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.secondary_services_cidr
  }

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Cloud NAT - Primary Region
resource "google_compute_router" "primary" {
  name    = "${var.network_name}-router-primary"
  project = var.project_id
  region  = var.primary_region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "primary" {
  name                               = "${var.network_name}-nat-primary"
  project                            = var.project_id
  router                             = google_compute_router.primary.name
  region                             = var.primary_region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Cloud NAT - Secondary Region
resource "google_compute_router" "secondary" {
  name    = "${var.network_name}-router-secondary"
  project = var.project_id
  region  = var.secondary_region
  network = google_compute_network.main.id
}

resource "google_compute_router_nat" "secondary" {
  name                               = "${var.network_name}-nat-secondary"
  project                            = var.project_id
  router                             = google_compute_router.secondary.name
  region                             = var.secondary_region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall Rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.network_name}-allow-internal"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.primary_cidr,
    var.secondary_cidr,
    var.primary_pods_cidr,
    var.secondary_pods_cidr
  ]
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.network_name}-allow-health-checks"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
  }

  # Google health check IPs
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22"
  ]

  target_tags = ["gke-node"]
}

resource "google_compute_firewall" "allow_master" {
  name    = "${var.network_name}-allow-master"
  project = var.project_id
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["443", "10250", "8443"]
  }

  # Master network CIDR
  source_ranges = [var.master_cidr_primary, var.master_cidr_secondary]

  target_tags = ["gke-node"]
}

# Global Load Balancer IP
resource "google_compute_global_address" "lb_ip" {
  name    = "${var.network_name}-lb-ip"
  project = var.project_id
}

# SSL Certificate (Managed)
resource "google_compute_managed_ssl_certificate" "main" {
  name    = "${var.network_name}-ssl-cert"
  project = var.project_id

  managed {
    domains = var.ssl_domains
  }
}

# Outputs
output "network_id" {
  value = google_compute_network.main.id
}

output "network_name" {
  value = google_compute_network.main.name
}

output "primary_subnetwork" {
  value = google_compute_subnetwork.primary.name
}

output "secondary_subnetwork" {
  value = google_compute_subnetwork.secondary.name
}

output "lb_ip_address" {
  value = google_compute_global_address.lb_ip.address
}

output "ssl_certificate" {
  value = google_compute_managed_ssl_certificate.main.id
}
