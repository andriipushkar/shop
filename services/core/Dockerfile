FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o core-service cmd/main.go

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/core-service .
EXPOSE 8080
CMD ["./core-service"]
