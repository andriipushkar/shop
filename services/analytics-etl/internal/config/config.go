package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds ETL service configuration
type Config struct {
	// PostgreSQL settings
	PostgresURL string

	// ClickHouse settings
	ClickHouseHost     string
	ClickHousePort     int
	ClickHouseDB       string
	ClickHouseUser     string
	ClickHousePassword string

	// Sync settings
	SyncInterval time.Duration
	BatchSize    int
	Workers      int

	// Feature flags
	SyncOrders      bool
	SyncEvents      bool
	SyncProducts    bool
	SyncInventory   bool
	RealTimeMode    bool
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	cfg := &Config{
		// PostgreSQL defaults
		PostgresURL: getEnv("POSTGRES_URL", "postgres://user:password@localhost:5432/shop?sslmode=disable"),

		// ClickHouse defaults
		ClickHouseHost:     getEnv("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:     getEnvInt("CLICKHOUSE_PORT", 9000),
		ClickHouseDB:       getEnv("CLICKHOUSE_DB", "shop_analytics"),
		ClickHouseUser:     getEnv("CLICKHOUSE_USER", "analytics"),
		ClickHousePassword: getEnv("CLICKHOUSE_PASSWORD", "analytics_password"),

		// Sync defaults
		SyncInterval: getEnvDuration("SYNC_INTERVAL", 5*time.Minute),
		BatchSize:    getEnvInt("BATCH_SIZE", 1000),
		Workers:      getEnvInt("WORKERS", 4),

		// Feature flags
		SyncOrders:    getEnvBool("SYNC_ORDERS", true),
		SyncEvents:    getEnvBool("SYNC_EVENTS", true),
		SyncProducts:  getEnvBool("SYNC_PRODUCTS", true),
		SyncInventory: getEnvBool("SYNC_INVENTORY", true),
		RealTimeMode:  getEnvBool("REAL_TIME_MODE", false),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.PostgresURL == "" {
		return fmt.Errorf("POSTGRES_URL is required")
	}
	if c.ClickHouseHost == "" {
		return fmt.Errorf("CLICKHOUSE_HOST is required")
	}
	if c.BatchSize < 1 {
		return fmt.Errorf("BATCH_SIZE must be at least 1")
	}
	if c.SyncInterval < time.Second {
		return fmt.Errorf("SYNC_INTERVAL must be at least 1 second")
	}
	return nil
}

// ClickHouseDSN returns the ClickHouse connection string
func (c *Config) ClickHouseDSN() string {
	return fmt.Sprintf("clickhouse://%s:%s@%s:%d/%s?dial_timeout=10s&max_execution_time=60",
		c.ClickHouseUser, c.ClickHousePassword, c.ClickHouseHost, c.ClickHousePort, c.ClickHouseDB)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}
