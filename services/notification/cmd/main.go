package main

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/streadway/amqp"
)

// Email configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     string
	Username     string
	Password     string
	FromEmail    string
	FromName     string
	Enabled      bool
}

func NewEmailConfig() *EmailConfig {
	config := &EmailConfig{
		SMTPHost:  os.Getenv("SMTP_HOST"),
		SMTPPort:  os.Getenv("SMTP_PORT"),
		Username:  os.Getenv("SMTP_USERNAME"),
		Password:  os.Getenv("SMTP_PASSWORD"),
		FromEmail: os.Getenv("SMTP_FROM_EMAIL"),
		FromName:  os.Getenv("SMTP_FROM_NAME"),
	}

	if config.FromName == "" {
		config.FromName = "Shop Notifications"
	}

	config.Enabled = config.SMTPHost != "" && config.Username != "" && config.Password != ""

	return config
}

type OrderEvent struct {
	ID          string  `json:"id"`
	ProductID   string  `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	Status      string  `json:"status"`
	UserID      int64   `json:"user_id"`
	Email       string  `json:"email,omitempty"`
	Phone       string  `json:"phone,omitempty"`
	Address     string  `json:"address,omitempty"`
	Type        string  `json:"type,omitempty"` // event type: order_created, status_updated, etc.
}

func main() {
	log.Println("Starting Notification Service...")

	rabbitURL := os.Getenv("RABBITMQ_URL")
	if rabbitURL == "" {
		log.Fatal("RABBITMQ_URL is not set")
	}

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		log.Println("Warning: TELEGRAM_BOT_TOKEN is not set, Telegram notifications disabled")
	}

	// Initialize email config
	emailConfig := NewEmailConfig()
	if emailConfig.Enabled {
		log.Printf("Email notifications enabled (SMTP: %s)", emailConfig.SMTPHost)
	} else {
		log.Println("Email notifications disabled (SMTP not configured)")
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

			productDisplay := order.ProductName
			if productDisplay == "" {
				productDisplay = order.ProductID
			}

			// Send Telegram notification
			if order.UserID > 0 && botToken != "" {
				text := fmt.Sprintf("✅ Ваше замовлення *%s* прийнято!\n\n📦 Товар: %s\n📊 Кількість: %d",
					order.ID, productDisplay, order.Quantity)

				if err := sendTelegramMessage(botToken, order.UserID, text); err != nil {
					log.Printf("Failed to send Telegram message: %v", err)
				} else {
					log.Printf("Telegram notification sent to user %d", order.UserID)
				}
			}

			// Send Email notification
			if order.Email != "" && emailConfig.Enabled {
				subject := fmt.Sprintf("Замовлення %s прийнято", order.ID)
				body := buildOrderCreatedEmailHTML(order)

				if err := sendEmail(emailConfig, order.Email, subject, body); err != nil {
					log.Printf("Failed to send email to %s: %v", order.Email, err)
				} else {
					log.Printf("Email notification sent to %s", order.Email)
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

		statusEmoji := map[string]string{
			"NEW":        "🆕",
			"PROCESSING": "⏳",
			"DELIVERED":  "✅",
			"CANCELLED":  "❌",
		}
		emoji := statusEmoji[order.Status]
		if emoji == "" {
			emoji = "📦"
		}

		productDisplay := order.ProductName
		if productDisplay == "" {
			productDisplay = order.ProductID
		}

		// Send Telegram notification
		if order.UserID > 0 && botToken != "" {
			text := fmt.Sprintf("%s Статус замовлення *%s* змінено на: *%s*\n\n📦 Товар: %s",
				emoji, order.ID, order.Status, productDisplay)

			if err := sendTelegramMessage(botToken, order.UserID, text); err != nil {
				log.Printf("Failed to send Telegram status message: %v", err)
			} else {
				log.Printf("Telegram status notification sent to user %d", order.UserID)
			}
		}

		// Send Email notification
		if order.Email != "" && emailConfig.Enabled {
			statusUkr := map[string]string{
				"NEW":        "Нове",
				"PROCESSING": "В обробці",
				"DELIVERED":  "Доставлено",
				"CANCELLED":  "Скасовано",
			}
			status := statusUkr[order.Status]
			if status == "" {
				status = order.Status
			}

			subject := fmt.Sprintf("Замовлення %s - %s", order.ID, status)
			body := buildStatusUpdateEmailHTML(order)

			if err := sendEmail(emailConfig, order.Email, subject, body); err != nil {
				log.Printf("Failed to send email to %s: %v", order.Email, err)
			} else {
				log.Printf("Email status notification sent to %s", order.Email)
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

func sendEmail(config *EmailConfig, to, subject, body string) error {
	if !config.Enabled {
		return fmt.Errorf("email not configured")
	}

	if to == "" {
		return fmt.Errorf("recipient email is empty")
	}

	// Build the email message
	from := fmt.Sprintf("%s <%s>", config.FromName, config.FromEmail)
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	var message strings.Builder
	for k, v := range headers {
		message.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	message.WriteString("\r\n")
	message.WriteString(body)

	// Connect to SMTP server
	addr := fmt.Sprintf("%s:%s", config.SMTPHost, config.SMTPPort)
	auth := smtp.PlainAuth("", config.Username, config.Password, config.SMTPHost)

	// Try TLS connection first
	tlsConfig := &tls.Config{
		ServerName: config.SMTPHost,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		// Fall back to regular SMTP
		return smtp.SendMail(addr, auth, config.FromEmail, []string{to}, []byte(message.String()))
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, config.SMTPHost)
	if err != nil {
		return err
	}
	defer client.Close()

	if err = client.Auth(auth); err != nil {
		return err
	}

	if err = client.Mail(config.FromEmail); err != nil {
		return err
	}

	if err = client.Rcpt(to); err != nil {
		return err
	}

	w, err := client.Data()
	if err != nil {
		return err
	}

	_, err = w.Write([]byte(message.String()))
	if err != nil {
		return err
	}

	err = w.Close()
	if err != nil {
		return err
	}

	return client.Quit()
}

func buildOrderCreatedEmailHTML(order OrderEvent) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .order-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Замовлення прийнято!</h1>
        </div>
        <div class="content">
            <p>Дякуємо за ваше замовлення!</p>
            <div class="order-details">
                <p><strong>Номер замовлення:</strong> %s</p>
                <p><strong>Товар:</strong> %s</p>
                <p><strong>Кількість:</strong> %d</p>
            </div>
            <p>Ми повідомимо вас, коли статус замовлення зміниться.</p>
        </div>
        <div class="footer">
            <p>Це автоматичне повідомлення. Будь ласка, не відповідайте на нього.</p>
        </div>
    </div>
</body>
</html>
`, order.ID, order.ProductName, order.Quantity)
}

func buildStatusUpdateEmailHTML(order OrderEvent) string {
	statusUkr := map[string]string{
		"NEW":        "Нове",
		"PROCESSING": "В обробці",
		"DELIVERED":  "Доставлено",
		"CANCELLED":  "Скасовано",
	}

	statusColor := map[string]string{
		"NEW":        "#2196F3",
		"PROCESSING": "#FF9800",
		"DELIVERED":  "#4CAF50",
		"CANCELLED":  "#f44336",
	}

	status := statusUkr[order.Status]
	if status == "" {
		status = order.Status
	}

	color := statusColor[order.Status]
	if color == "" {
		color = "#333"
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: %s; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .order-details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Статус замовлення оновлено</h1>
        </div>
        <div class="content">
            <div class="order-details">
                <p><strong>Номер замовлення:</strong> %s</p>
                <p><strong>Товар:</strong> %s</p>
                <p><strong>Новий статус:</strong> <span style="color: %s; font-weight: bold;">%s</span></p>
            </div>
        </div>
        <div class="footer">
            <p>Це автоматичне повідомлення. Будь ласка, не відповідайте на нього.</p>
        </div>
    </div>
</body>
</html>
`, color, order.ID, order.ProductName, color, status)
}
