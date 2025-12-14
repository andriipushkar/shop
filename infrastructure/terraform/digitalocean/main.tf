# ============================================================
# Shop Platform - DigitalOcean Infrastructure
# ============================================================
# Alternative to AWS for smaller deployments or cost optimization
# ============================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.30"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }

  backend "s3" {
    endpoint                    = "fra1.digitaloceanspaces.com"
    bucket                      = "shop-platform-terraform"
    key                         = "infrastructure/terraform.tfstate"
    region                      = "us-east-1" # Required but ignored for DO Spaces
    skip_credentials_validation = true
    skip_metadata_api_check     = true
  }
}

provider "digitalocean" {
  token = var.do_token
}

# ============================================================
# VPC
# ============================================================

resource "digitalocean_vpc" "main" {
  name     = "${var.project_name}-${var.environment}"
  region   = var.region
  ip_range = var.vpc_ip_range
}

# ============================================================
# DOKS (DigitalOcean Kubernetes Service)
# ============================================================

resource "digitalocean_kubernetes_cluster" "main" {
  name    = "${var.project_name}-${var.environment}"
  region  = var.region
  version = var.kubernetes_version
  vpc_uuid = digitalocean_vpc.main.id

  # System node pool
  node_pool {
    name       = "system"
    size       = var.system_node_size
    node_count = var.system_node_count
    auto_scale = true
    min_nodes  = 2
    max_nodes  = 4

    labels = {
      role = "system"
    }
  }

  maintenance_policy {
    start_time = "04:00"
    day        = "sunday"
  }
}

# Application node pool
resource "digitalocean_kubernetes_node_pool" "application" {
  cluster_id = digitalocean_kubernetes_cluster.main.id

  name       = "application"
  size       = var.app_node_size
  auto_scale = true
  min_nodes  = var.app_node_min
  max_nodes  = var.app_node_max

  labels = {
    role = "application"
  }
}

# ============================================================
# Managed PostgreSQL
# ============================================================

resource "digitalocean_database_cluster" "postgres" {
  name       = "${var.project_name}-db-${var.environment}"
  engine     = "pg"
  version    = "15"
  size       = var.db_size
  region     = var.region
  node_count = var.environment == "production" ? 2 : 1

  private_network_uuid = digitalocean_vpc.main.id

  maintenance_window {
    day  = "sunday"
    hour = "02:00:00"
  }
}

# Database
resource "digitalocean_database_db" "shop" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "shop"
}

# Database user
resource "digitalocean_database_user" "shop" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "shop_admin"
}

# Firewall - allow only from K8s cluster
resource "digitalocean_database_firewall" "postgres" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "k8s"
    value = digitalocean_kubernetes_cluster.main.id
  }
}

# ============================================================
# Managed Redis
# ============================================================

resource "digitalocean_database_cluster" "redis" {
  name       = "${var.project_name}-redis-${var.environment}"
  engine     = "redis"
  version    = "7"
  size       = var.redis_size
  region     = var.region
  node_count = var.environment == "production" ? 2 : 1

  private_network_uuid = digitalocean_vpc.main.id
}

resource "digitalocean_database_firewall" "redis" {
  cluster_id = digitalocean_database_cluster.redis.id

  rule {
    type  = "k8s"
    value = digitalocean_kubernetes_cluster.main.id
  }
}

# ============================================================
# Spaces (Object Storage - S3 Compatible)
# ============================================================

resource "digitalocean_spaces_bucket" "images" {
  name   = "${var.project_name}-images-${var.environment}"
  region = var.spaces_region

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*.${var.domain}"]
    max_age_seconds = 3000
  }
}

resource "digitalocean_spaces_bucket" "backups" {
  name   = "${var.project_name}-backups-${var.environment}"
  region = var.spaces_region
}

resource "digitalocean_spaces_bucket" "static" {
  name   = "${var.project_name}-static-${var.environment}"
  region = var.spaces_region

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 86400
  }
}

# CDN for static assets
resource "digitalocean_cdn" "static" {
  origin           = digitalocean_spaces_bucket.static.bucket_domain_name
  custom_domain    = "cdn.${var.domain}"
  certificate_name = digitalocean_certificate.cdn.name
}

# ============================================================
# Load Balancer
# ============================================================

resource "digitalocean_loadbalancer" "main" {
  name   = "${var.project_name}-lb-${var.environment}"
  region = var.region

  vpc_uuid = digitalocean_vpc.main.id

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 80
    target_protocol = "http"
  }

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"

    target_port     = 80
    target_protocol = "http"

    certificate_name = digitalocean_certificate.main.name
  }

  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/health"
  }

  redirect_http_to_https = true
  enable_proxy_protocol  = true

  droplet_tag = "k8s:${digitalocean_kubernetes_cluster.main.id}"
}

# ============================================================
# Certificates
# ============================================================

resource "digitalocean_certificate" "main" {
  name    = "${var.project_name}-cert-${var.environment}"
  type    = "lets_encrypt"
  domains = ["*.${var.domain}", var.domain]
}

resource "digitalocean_certificate" "cdn" {
  name    = "${var.project_name}-cdn-cert-${var.environment}"
  type    = "lets_encrypt"
  domains = ["cdn.${var.domain}"]
}

# ============================================================
# DNS (if using DO DNS)
# ============================================================

resource "digitalocean_domain" "main" {
  count = var.use_do_dns ? 1 : 0
  name  = var.domain
}

resource "digitalocean_record" "wildcard" {
  count  = var.use_do_dns ? 1 : 0
  domain = digitalocean_domain.main[0].id
  type   = "A"
  name   = "*"
  value  = digitalocean_loadbalancer.main.ip
}

resource "digitalocean_record" "root" {
  count  = var.use_do_dns ? 1 : 0
  domain = digitalocean_domain.main[0].id
  type   = "A"
  name   = "@"
  value  = digitalocean_loadbalancer.main.ip
}

resource "digitalocean_record" "cdn" {
  count  = var.use_do_dns ? 1 : 0
  domain = digitalocean_domain.main[0].id
  type   = "CNAME"
  name   = "cdn"
  value  = "${digitalocean_cdn.static.endpoint}."
}

# ============================================================
# Project (for resource grouping)
# ============================================================

resource "digitalocean_project" "main" {
  name        = "${var.project_name}-${var.environment}"
  description = "Shop Platform ${var.environment} environment"
  purpose     = "Service or API"
  environment = var.environment == "production" ? "Production" : "Development"

  resources = [
    digitalocean_kubernetes_cluster.main.urn,
    digitalocean_database_cluster.postgres.urn,
    digitalocean_database_cluster.redis.urn,
    digitalocean_loadbalancer.main.urn,
    digitalocean_spaces_bucket.images.urn,
    digitalocean_spaces_bucket.static.urn,
  ]
}

# ============================================================
# Outputs
# ============================================================

output "kubernetes_cluster_id" {
  value = digitalocean_kubernetes_cluster.main.id
}

output "kubernetes_endpoint" {
  value     = digitalocean_kubernetes_cluster.main.endpoint
  sensitive = true
}

output "kubeconfig" {
  value     = digitalocean_kubernetes_cluster.main.kube_config[0].raw_config
  sensitive = true
}

output "database_host" {
  value = digitalocean_database_cluster.postgres.private_host
}

output "database_port" {
  value = digitalocean_database_cluster.postgres.port
}

output "database_name" {
  value = digitalocean_database_db.shop.name
}

output "database_user" {
  value = digitalocean_database_user.shop.name
}

output "database_password" {
  value     = digitalocean_database_user.shop.password
  sensitive = true
}

output "redis_host" {
  value = digitalocean_database_cluster.redis.private_host
}

output "redis_port" {
  value = digitalocean_database_cluster.redis.port
}

output "spaces_images_endpoint" {
  value = digitalocean_spaces_bucket.images.bucket_domain_name
}

output "spaces_static_endpoint" {
  value = digitalocean_spaces_bucket.static.bucket_domain_name
}

output "cdn_endpoint" {
  value = digitalocean_cdn.static.endpoint
}

output "loadbalancer_ip" {
  value = digitalocean_loadbalancer.main.ip
}
