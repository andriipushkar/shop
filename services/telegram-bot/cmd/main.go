package main

import (
	"log"
	"os"
	"time"

	"telegram-bot/internal/bot"

	tele "gopkg.in/telebot.v3"
)

func main() {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		log.Fatal("TELEGRAM_BOT_TOKEN is not set")
	}

	pref := tele.Settings{
		Token:   token,
		Poller:  &tele.LongPoller{Timeout: 10 * time.Second},
		Verbose: true, // Debugging
	}

	b, err := tele.NewBot(pref)
	if err != nil {
		log.Fatalf("Failed to create bot: %v", err)
	}

	coreURL := os.Getenv("CORE_SERVICE_URL")
	if coreURL == "" {
		coreURL = "http://localhost:8080"
	}

	omsURL := os.Getenv("OMS_SERVICE_URL")
	if omsURL == "" {
		omsURL = "http://localhost:8081"
	}

	crmURL := os.Getenv("CRM_SERVICE_URL")
	if crmURL == "" {
		crmURL = "http://localhost:8082"
	}

	// Remove any existing webhook to ensure long polling works
	if err := b.RemoveWebhook(); err != nil {
		log.Printf("Warning: could not remove webhook: %v", err)
	}

	handler := bot.NewHandler(b, coreURL, omsURL, crmURL)
	handler.RegisterRoutes()

	log.Println("Telegram Bot started")
	b.Start()
}
