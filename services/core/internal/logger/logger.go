package logger

import (
	"io"
	"os"
	"time"

	"github.com/rs/zerolog"
)

var log zerolog.Logger

// Config holds logger configuration
type Config struct {
	Level      string // debug, info, warn, error
	Pretty     bool   // Use console writer for development
	TimeFormat string // Time format
}

// DefaultConfig returns default logger configuration
func DefaultConfig() Config {
	return Config{
		Level:      "info",
		Pretty:     false,
		TimeFormat: time.RFC3339,
	}
}

// Init initializes the global logger
func Init(cfg Config) {
	var output io.Writer = os.Stdout

	if cfg.Pretty {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: cfg.TimeFormat,
		}
	}

	level := parseLevel(cfg.Level)
	zerolog.TimeFieldFormat = cfg.TimeFormat

	log = zerolog.New(output).
		Level(level).
		With().
		Timestamp().
		Caller().
		Logger()
}

// InitFromEnv initializes logger from environment variables
func InitFromEnv() {
	cfg := DefaultConfig()

	if level := os.Getenv("LOG_LEVEL"); level != "" {
		cfg.Level = level
	}

	if os.Getenv("LOG_PRETTY") == "true" {
		cfg.Pretty = true
	}

	Init(cfg)
}

func parseLevel(level string) zerolog.Level {
	switch level {
	case "debug":
		return zerolog.DebugLevel
	case "info":
		return zerolog.InfoLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}

// Get returns the global logger
func Get() zerolog.Logger {
	return log
}

// Debug logs a debug message
func Debug() *zerolog.Event {
	return log.Debug()
}

// Info logs an info message
func Info() *zerolog.Event {
	return log.Info()
}

// Warn logs a warning message
func Warn() *zerolog.Event {
	return log.Warn()
}

// Error logs an error message
func Error() *zerolog.Event {
	return log.Error()
}

// Fatal logs a fatal message and exits
func Fatal() *zerolog.Event {
	return log.Fatal()
}

// WithService returns a logger with service name
func WithService(name string) zerolog.Logger {
	return log.With().Str("service", name).Logger()
}

// WithRequestID returns a logger with request ID
func WithRequestID(requestID string) zerolog.Logger {
	return log.With().Str("request_id", requestID).Logger()
}

// WithUserID returns a logger with user ID
func WithUserID(userID int64) zerolog.Logger {
	return log.With().Int64("user_id", userID).Logger()
}

// HTTPRequest logs an HTTP request
func HTTPRequest(method, path string, statusCode int, duration time.Duration) {
	log.Info().
		Str("method", method).
		Str("path", path).
		Int("status", statusCode).
		Dur("duration", duration).
		Msg("HTTP request")
}

// DBQuery logs a database query
func DBQuery(query string, duration time.Duration, err error) {
	event := log.Debug().
		Str("query", truncate(query, 200)).
		Dur("duration", duration)

	if err != nil {
		event.Err(err).Msg("DB query failed")
	} else {
		event.Msg("DB query")
	}
}

// CacheHit logs a cache hit
func CacheHit(key string) {
	log.Debug().Str("key", key).Msg("Cache hit")
}

// CacheMiss logs a cache miss
func CacheMiss(key string) {
	log.Debug().Str("key", key).Msg("Cache miss")
}

// CacheInvalidate logs cache invalidation
func CacheInvalidate(keys ...string) {
	log.Debug().Strs("keys", keys).Msg("Cache invalidated")
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
