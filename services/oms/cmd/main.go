package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/streadway/amqp"
)

type Order struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	Quantity  int       `json:"quantity"`
	Status    string    `json:"status"`
	UserID    int64     `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

func main() {
	log.Println("Starting OMS Service...")

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

	// Init DB
	if err := initDB(db); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	// Connect to RabbitMQ
	rabbitURL := os.Getenv("RABBITMQ_URL")
	var rabbitConn *amqp.Connection
	var rabbitCh *amqp.Channel
	
	if rabbitURL != "" {
		for i := 0; i < 10; i++ {
			rabbitConn, err = amqp.Dial(rabbitURL)
			if err == nil {
				break
			}
			log.Printf("Waiting for RabbitMQ... (%d/10)", i+1)
			time.Sleep(2 * time.Second)
		}
		if err != nil {
			log.Printf("Warning: Failed to connect to RabbitMQ: %v", err)
		} else {
			rabbitCh, err = rabbitConn.Channel()
			if err != nil {
				log.Printf("Warning: Failed to open channel: %v", err)
			} else {
				_, err = rabbitCh.QueueDeclare("order.created", true, false, false, false, nil)
				if err != nil {
					log.Printf("Warning: Failed to declare queue: %v", err)
				} else {
					log.Println("Connected to RabbitMQ")
				}
			}
		}
	}

	http.HandleFunc("/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		createOrder(w, r, db, rabbitCh)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("OMS listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initDB(db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS orders (
		id TEXT PRIMARY KEY,
		product_id TEXT NOT NULL,
		quantity INT NOT NULL,
		status TEXT NOT NULL,
		user_id BIGINT,
		created_at TIMESTAMP NOT NULL
	);`
	_, err := db.Exec(query)
	return err
}

func createOrder(w http.ResponseWriter, r *http.Request, db *sql.DB, rabbitCh *amqp.Channel) {
	var o Order
	if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	o.ID = fmt.Sprintf("ORD-%d", time.Now().UnixNano())
	o.Status = "NEW"
	o.CreatedAt = time.Now()

	query := `INSERT INTO orders (id, product_id, quantity, status, user_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := db.Exec(query, o.ID, o.ProductID, o.Quantity, o.Status, o.UserID, o.CreatedAt)
	if err != nil {
		http.Error(w, "Failed to save order: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Publish event to RabbitMQ
	if rabbitCh != nil {
		eventData, _ := json.Marshal(o)
		err := rabbitCh.Publish("", "order.created", false, false, amqp.Publishing{
			ContentType: "application/json",
			Body:        eventData,
		})
		if err != nil {
			log.Printf("Failed to publish event: %v", err)
		} else {
			log.Printf("Published order.created event for %s", o.ID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(o)
}
