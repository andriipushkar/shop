.PHONY: run-core run-bot

run-core:
	cd services/core && go run cmd/main.go

run-bot:
	cd services/telegram-bot && go run cmd/main.go
