package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"analytics-etl/internal/config"
	"analytics-etl/internal/sync"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	log.Info().Msg("Starting Analytics ETL Service")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Create sync manager
	syncManager, err := sync.NewManager(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create sync manager")
	}
	defer syncManager.Close()

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start sync workers
	go func() {
		if err := syncManager.Start(ctx); err != nil {
			log.Error().Err(err).Msg("Sync manager error")
			cancel()
		}
	}()

	log.Info().
		Str("sync_interval", cfg.SyncInterval.String()).
		Int("batch_size", cfg.BatchSize).
		Msg("ETL Service started successfully")

	// Wait for shutdown signal
	<-sigChan
	log.Info().Msg("Shutting down ETL Service...")

	// Give workers time to finish
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := syncManager.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("Error during shutdown")
	}

	log.Info().Msg("ETL Service stopped")
}
