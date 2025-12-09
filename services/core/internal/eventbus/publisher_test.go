package eventbus

import (
	"context"
	"testing"
)

func TestEvent_Fields(t *testing.T) {
	event := Event{
		Type:    "order.created",
		Payload: map[string]interface{}{"id": "123", "total": 99.99},
	}

	if event.Type != "order.created" {
		t.Errorf("expected type 'order.created', got '%s'", event.Type)
	}

	payload, ok := event.Payload.(map[string]interface{})
	if !ok {
		t.Fatal("expected payload to be map[string]interface{}")
	}
	if payload["id"] != "123" {
		t.Errorf("expected id '123', got '%v'", payload["id"])
	}
}

func TestNoOpPublisher_Publish(t *testing.T) {
	publisher := &NoOpPublisher{}

	event := Event{
		Type:    "test.event",
		Payload: "test payload",
	}

	err := publisher.Publish(context.Background(), "test.routing.key", event)
	if err != nil {
		t.Errorf("NoOpPublisher.Publish() should return nil, got %v", err)
	}
}

func TestNoOpPublisher_Publish_MultipleEvents(t *testing.T) {
	publisher := &NoOpPublisher{}

	events := []Event{
		{Type: "event1", Payload: nil},
		{Type: "event2", Payload: "data"},
		{Type: "event3", Payload: map[string]int{"count": 42}},
	}

	for _, event := range events {
		err := publisher.Publish(context.Background(), "routing.key", event)
		if err != nil {
			t.Errorf("NoOpPublisher.Publish() should return nil for all events, got %v", err)
		}
	}
}

func TestNoOpPublisher_ImplementsInterface(t *testing.T) {
	var _ Publisher = (*NoOpPublisher)(nil)
}

func TestEvent_EmptyPayload(t *testing.T) {
	event := Event{
		Type:    "notification.sent",
		Payload: nil,
	}

	if event.Type != "notification.sent" {
		t.Errorf("expected type 'notification.sent', got '%s'", event.Type)
	}
	if event.Payload != nil {
		t.Error("expected nil payload")
	}
}

func TestEvent_StringPayload(t *testing.T) {
	event := Event{
		Type:    "message",
		Payload: "Hello, World!",
	}

	payload, ok := event.Payload.(string)
	if !ok {
		t.Fatal("expected string payload")
	}
	if payload != "Hello, World!" {
		t.Errorf("expected 'Hello, World!', got '%s'", payload)
	}
}

func TestEvent_StructPayload(t *testing.T) {
	type OrderPayload struct {
		ID       string
		Amount   float64
		Customer string
	}

	event := Event{
		Type: "order.completed",
		Payload: OrderPayload{
			ID:       "ORD-123",
			Amount:   199.99,
			Customer: "John Doe",
		},
	}

	payload, ok := event.Payload.(OrderPayload)
	if !ok {
		t.Fatal("expected OrderPayload")
	}
	if payload.ID != "ORD-123" {
		t.Errorf("expected ID 'ORD-123', got '%s'", payload.ID)
	}
	if payload.Amount != 199.99 {
		t.Errorf("expected Amount 199.99, got %f", payload.Amount)
	}
}

func TestNoOpPublisher_CanceledContext(t *testing.T) {
	publisher := &NoOpPublisher{}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	event := Event{
		Type:    "test.event",
		Payload: nil,
	}

	// NoOpPublisher ignores context, so this should still succeed
	err := publisher.Publish(ctx, "key", event)
	if err != nil {
		t.Errorf("NoOpPublisher should not fail with canceled context, got %v", err)
	}
}
