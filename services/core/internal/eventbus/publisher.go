package eventbus

import "context"

// Event represents a generic system event
type Event struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Publisher defines the interface for publishing events
type Publisher interface {
	Publish(ctx context.Context, routingKey string, event Event) error
}

// NoOpPublisher is a placeholder for testing
type NoOpPublisher struct{}

func (p *NoOpPublisher) Publish(ctx context.Context, routingKey string, event Event) error {
	// Log event or do nothing
	return nil
}
