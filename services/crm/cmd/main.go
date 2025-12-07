package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"shop/services/crm/internal/customer"

	_ "github.com/lib/pq"
)

func main() {
	log.Println("Starting CRM Service...")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	var db *sql.DB
	var err error

	// Retry connection
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

	repo := customer.NewRepository(db)
	if err := repo.InitDB(); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	svc := customer.NewService(repo)

	http.HandleFunc("/customers", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			createCustomer(w, r, svc)
		} else {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("CRM listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

type CreateCustomerRequest struct {
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	TelegramID int64  `json:"telegram_id"`
}

func createCustomer(w http.ResponseWriter, r *http.Request, svc *customer.Service) {
	var req CreateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	c, err := svc.UpsertCustomerFromTelegram(req.TelegramID, req.FirstName, req.LastName, "")
	if err != nil {
		http.Error(w, "Failed to upsert customer: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}
