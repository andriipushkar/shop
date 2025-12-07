package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"core/internal/pim"
	transport "core/internal/transport/http"
)

func main() {
	log.Println("Starting Core Service...")

	// Initialize dependencies
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	var db *sql.DB
	var err error

	// Retry connection logic
	for i := 0; i < 10; i++ {
		db, err = sql.Open("postgres", dbURL)
		if err == nil {
			if err = db.Ping(); err == nil {
				break
			}
		}
		log.Printf("Waiting for database... (%d/10)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	repo, err := pim.NewPostgresRepository(db)
	if err != nil {
		log.Fatalf("Failed to initialize repository: %v", err)
	}

	// PostgresRepository implements both Repository and CategoryRepository
	service := pim.NewService(repo, repo)
	handler := transport.NewHandler(service)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Product routes
	mux.HandleFunc("/feed/rozetka", handler.GenerateFeed)
	mux.HandleFunc("/products", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			handler.CreateProduct(w, r)
		case http.MethodGet:
			handler.ListProducts(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/products/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Handle stock endpoints
		if len(path) > len("/products/") {
			if path[len(path)-6:] == "/stock" {
				handler.UpdateStock(w, r)
				return
			}
			if len(path) > 10 && path[len(path)-10:] == "/decrement" {
				handler.DecrementStock(w, r)
				return
			}
		}

		switch r.Method {
		case http.MethodGet:
			handler.GetProduct(w, r)
		case http.MethodPut:
			handler.UpdateProduct(w, r)
		case http.MethodDelete:
			handler.DeleteProduct(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	// Category routes
	mux.HandleFunc("/categories", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			handler.CreateCategory(w, r)
		case http.MethodGet:
			handler.ListCategories(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/categories/", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			handler.GetCategory(w, r)
		case http.MethodDelete:
			handler.DeleteCategory(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	log.Printf("Server listening on port %s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
