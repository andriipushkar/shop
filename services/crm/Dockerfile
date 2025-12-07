FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN go build -o crm-service cmd/main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/crm-service .

CMD ["./crm-service"]
