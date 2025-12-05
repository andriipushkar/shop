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
		Token:  token,
		Poller: &tele.LongPoller{Timeout: 10 * time.Second},
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

	handler := bot.NewHandler(b, coreURL, omsURL)
	handler.RegisterRoutes()

	log.Println("Telegram Bot started")
	b.Start()
}
