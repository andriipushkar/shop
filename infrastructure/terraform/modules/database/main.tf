# Multi-Region Database Module (Cloud SQL)

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

# Random suffix for unique naming
resource "random_id" "db_suffix" {
  byte_length = 4
}

# Primary Database Instance
resource "google_sql_database_instance" "primary" {
  name                = "${var.instance_name}-primary-${random_id.db_suffix.hex}"
  project             = var.project_id
  region              = var.primary_region
  database_version    = var.database_version
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.primary_tier
    availability_type = "REGIONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size
    disk_autoresize   = true

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.backup_location
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # IP configuration
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
      require_ssl     = true
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 2
      update_track = "stable"
    }

    # Insights
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # Database flags
    database_flags {
      name  = "max_connections"
      value = "500"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000"  # Log queries > 1 second
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    user_labels = var.labels
  }

  lifecycle {
    prevent_destroy = true
  }
}

# Read Replica in Secondary Region
resource "google_sql_database_instance" "replica" {
  count = var.create_replica ? 1 : 0

  name                 = "${var.instance_name}-replica-${random_id.db_suffix.hex}"
  project              = var.project_id
  region               = var.secondary_region
  database_version     = var.database_version
  master_instance_name = google_sql_database_instance.primary.name
  deletion_protection  = var.deletion_protection

  replica_configuration {
    failover_target = true
  }

  settings {
    tier              = var.replica_tier
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = var.disk_size
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
      require_ssl     = true
    }

    user_labels = var.labels
  }
}

# Databases
resource "google_sql_database" "main" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.primary.name
  charset  = "UTF8"
}

resource "google_sql_database" "analytics" {
  name     = "${var.database_name}_analytics"
  project  = var.project_id
  instance = google_sql_database_instance.primary.name
  charset  = "UTF8"
}

# Database User
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_user" "main" {
  name     = var.database_user
  project  = var.project_id
  instance = google_sql_database_instance.primary.name
  password = random_password.db_password.result
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.instance_name}-db-password"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Outputs
output "primary_connection_name" {
  value = google_sql_database_instance.primary.connection_name
}

output "primary_private_ip" {
  value = google_sql_database_instance.primary.private_ip_address
}

output "replica_connection_name" {
  value = var.create_replica ? google_sql_database_instance.replica[0].connection_name : null
}

output "replica_private_ip" {
  value = var.create_replica ? google_sql_database_instance.replica[0].private_ip_address : null
}

output "database_name" {
  value = google_sql_database.main.name
}

output "database_user" {
  value = google_sql_user.main.name
}

output "password_secret_id" {
  value = google_secret_manager_secret.db_password.secret_id
}
