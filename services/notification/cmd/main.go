package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/streadway/amqp"
)

type OrderEvent struct {
	ID        string `json:"id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	Status    string `json:"status"`
	UserID    int64  `json:"user_id"`
}

func main() {
	log.Println("Starting Notification Service...")

	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		log.Fatal("RABBITMQ_URL is not set")
	}

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		log.Fatal("TELEGRAM_BOT_TOKEN is not set")
	}

	var conn *amqp.Connection
	var err error

	// Retry connection
	for i := 0; i < 15; i++ {
		conn, err = amqp.Dial(rabbitURL)
		if err == nil {
			break
		}
		log.Printf("Waiting for RabbitMQ... (%d/15)", i+1)
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open channel: %v", err)
	}
	defer ch.Close()

	q, err := ch.QueueDeclare("order.created", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare queue: %v", err)
	}

	qStatus, err := ch.QueueDeclare("order.status.updated", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to declare status queue: %v", err)
	}

	msgs, err := ch.Consume(q.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to consume: %v", err)
	}

	statusMessages, err := ch.Consume(qStatus.Name, "", true, false, false, false, nil)
	if err != nil {
		log.Fatalf("Failed to consume status: %v", err)
	}

	log.Println("Notification Service listening for events...")

	// Handle order.created
	go func() {
		for msg := range msgs {
			var order OrderEvent
			if err := json.Unmarshal(msg.Body, &order); err != nil {
				log.Printf("Failed to parse event: %v", err)
				continue
			}

			log.Printf("Received order.created: %s", order.ID)

			if order.UserID > 0 {
				text := fmt.Sprintf("✅ Ваше замовлення *%s* прийнято!\n\n📦 Товар: %s\n📊 Кількість: %d",
					order.ID, order.ProductID, order.Quantity)
				
				if err := sendTelegramMessage(botToken, order.UserID, text); err != nil {
					log.Printf("Failed to send message: %v", err)
				} else {
					log.Printf("Notification sent to user %d", order.UserID)
				}
			}
		}
	}()

	// Handle order.status.updated
	for msg := range statusMessages {
		var order OrderEvent
		if err := json.Unmarshal(msg.Body, &order); err != nil {
			log.Printf("Failed to parse status event: %v", err)
			continue
		}

		log.Printf("Received order.status.updated: %s -> %s", order.ID, order.Status)

		if order.UserID > 0 {
			statusEmoji := map[string]string{
				"NEW":        "🆕",
				"PROCESSING": "⏳",
				"DELIVERED":  "✅",
			}
			emoji := statusEmoji[order.Status]
			if emoji == "" {
				emoji = "📦"
			}

			text := fmt.Sprintf("%s Статус замовлення *%s* змінено на: *%s*",
				emoji, order.ID, order.Status)
			
			if err := sendTelegramMessage(botToken, order.UserID, text); err != nil {
				log.Printf("Failed to send status message: %v", err)
			} else {
				log.Printf("Status notification sent to user %d", order.UserID)
			}
		}
	}
}

func sendTelegramMessage(token string, chatID int64, text string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	
	resp, err := http.PostForm(apiURL, url.Values{
		"chat_id":    {fmt.Sprintf("%d", chatID)},
		"text":       {text},
		"parse_mode": {"Markdown"},
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API returned status %d", resp.StatusCode)
	}

	return nil
}
