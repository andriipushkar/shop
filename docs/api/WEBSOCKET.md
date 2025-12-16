# WebSocket API

Real-time комунікація в Shop Platform.

## Огляд

WebSocket API забезпечує:
- Real-time оновлення замовлень
- Live notifications
- Оновлення кошика
- Inventory alerts
- Chat support

## Підключення

### Endpoint

```
wss://api.shop.example.com/ws
```

### Автентифікація

```javascript
// Варіант 1: Query parameter
const ws = new WebSocket('wss://api.shop.example.com/ws?token=<jwt_token>');

// Варіант 2: Після підключення
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    payload: {
      token: '<jwt_token>'
    }
  }));
};
```

## Протокол повідомлень

### Формат

```typescript
interface WebSocketMessage {
  type: string;           // Тип повідомлення
  payload: object;        // Дані
  id?: string;            // ID повідомлення (для request-response)
  timestamp?: string;     // ISO 8601
}
```

### Типи повідомлень

| Type | Напрямок | Опис |
|------|----------|------|
| `auth` | Client → Server | Автентифікація |
| `auth_success` | Server → Client | Успішна автентифікація |
| `auth_error` | Server → Client | Помилка автентифікації |
| `subscribe` | Client → Server | Підписка на канал |
| `unsubscribe` | Client → Server | Відписка |
| `ping` | Client → Server | Heartbeat |
| `pong` | Server → Client | Heartbeat response |
| `notification` | Server → Client | Сповіщення |
| `order_update` | Server → Client | Оновлення замовлення |
| `cart_update` | Server → Client | Оновлення кошика |
| `inventory_alert` | Server → Client | Alert по залишках |
| `chat_message` | Bidirectional | Повідомлення чату |
| `error` | Server → Client | Помилка |

## Server Implementation (Go)

```go
// internal/websocket/hub.go
package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	clients    map[*Client]bool
	channels   map[string]map[*Client]bool
	broadcast  chan *Message
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string
	tenantID string
	channels map[string]bool
}

type Message struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	ID        string          `json:"id,omitempty"`
	Timestamp string          `json:"timestamp,omitempty"`
	Channel   string          `json:"-"` // Internal use
	UserID    string          `json:"-"` // Target user (optional)
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		channels:   make(map[string]map[*Client]bool),
		broadcast:  make(chan *Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				// Remove from all channels
				for channel := range client.channels {
					if clients, ok := h.channels[channel]; ok {
						delete(clients, client)
					}
				}
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.broadcastMessage(message)
		}
	}
}

func (h *Hub) broadcastMessage(msg *Message) {
	data, _ := json.Marshal(msg)

	h.mu.RLock()
	defer h.mu.RUnlock()

	// Broadcast to specific user
	if msg.UserID != "" {
		for client := range h.clients {
			if client.userID == msg.UserID {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
		return
	}

	// Broadcast to channel
	if msg.Channel != "" {
		if clients, ok := h.channels[msg.Channel]; ok {
			for client := range clients {
				select {
				case client.send <- data:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
		return
	}

	// Broadcast to all
	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}

func (h *Hub) Subscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.channels[channel]; !ok {
		h.channels[channel] = make(map[*Client]bool)
	}
	h.channels[channel][client] = true
	client.channels[channel] = true
}

func (h *Hub) Unsubscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if clients, ok := h.channels[channel]; ok {
		delete(clients, client)
	}
	delete(client.channels, channel)
}

// SendToUser sends a message to a specific user
func (h *Hub) SendToUser(userID string, msg *Message) {
	msg.UserID = userID
	msg.Timestamp = time.Now().UTC().Format(time.RFC3339)
	h.broadcast <- msg
}

// SendToChannel sends a message to all subscribers of a channel
func (h *Hub) SendToChannel(channel string, msg *Message) {
	msg.Channel = channel
	msg.Timestamp = time.Now().UTC().Format(time.RFC3339)
	h.broadcast <- msg
}
```

### Client Handler

```go
// internal/websocket/client.go
package websocket

import (
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg Message
		if err := json.Unmarshal(data, &msg); err != nil {
			c.sendError("invalid_message", "Invalid JSON format")
			continue
		}

		c.handleMessage(&msg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg *Message) {
	switch msg.Type {
	case "auth":
		c.handleAuth(msg)
	case "subscribe":
		c.handleSubscribe(msg)
	case "unsubscribe":
		c.handleUnsubscribe(msg)
	case "ping":
		c.sendPong()
	case "chat_message":
		c.handleChatMessage(msg)
	default:
		c.sendError("unknown_type", "Unknown message type")
	}
}

func (c *Client) handleAuth(msg *Message) {
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		c.sendError("invalid_payload", "Invalid auth payload")
		return
	}

	// Validate JWT token
	claims, err := validateToken(payload.Token)
	if err != nil {
		c.send <- mustMarshal(&Message{
			Type: "auth_error",
			Payload: mustMarshalRaw(map[string]string{
				"error": "Invalid or expired token",
			}),
		})
		return
	}

	c.userID = claims.UserID
	c.tenantID = claims.TenantID

	// Auto-subscribe to user channel
	c.hub.Subscribe(c, "user:"+c.userID)

	c.send <- mustMarshal(&Message{
		Type: "auth_success",
		Payload: mustMarshalRaw(map[string]interface{}{
			"user_id": c.userID,
		}),
	})
}

func (c *Client) handleSubscribe(msg *Message) {
	var payload struct {
		Channel string `json:"channel"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	// Validate channel access
	if !c.canAccessChannel(payload.Channel) {
		c.sendError("forbidden", "Cannot access this channel")
		return
	}

	c.hub.Subscribe(c, payload.Channel)
	c.send <- mustMarshal(&Message{
		Type: "subscribed",
		Payload: mustMarshalRaw(map[string]string{
			"channel": payload.Channel,
		}),
	})
}

func (c *Client) handleUnsubscribe(msg *Message) {
	var payload struct {
		Channel string `json:"channel"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	c.hub.Unsubscribe(c, payload.Channel)
	c.send <- mustMarshal(&Message{
		Type: "unsubscribed",
		Payload: mustMarshalRaw(map[string]string{
			"channel": payload.Channel,
		}),
	})
}

func (c *Client) sendError(code, message string) {
	c.send <- mustMarshal(&Message{
		Type: "error",
		Payload: mustMarshalRaw(map[string]string{
			"code":    code,
			"message": message,
		}),
	})
}

func (c *Client) sendPong() {
	c.send <- mustMarshal(&Message{
		Type:      "pong",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func (c *Client) canAccessChannel(channel string) bool {
	// User can only access their own channels or public channels
	// Format: "type:id" e.g., "order:123", "user:456"
	parts := strings.SplitN(channel, ":", 2)
	if len(parts) != 2 {
		return false
	}

	switch parts[0] {
	case "user":
		return parts[1] == c.userID
	case "order":
		// Check if user owns this order
		return c.ownsOrder(parts[1])
	case "tenant":
		return parts[1] == c.tenantID
	case "public":
		return true
	default:
		return false
	}
}
```

### HTTP Handler

```go
// internal/websocket/handler.go
package websocket

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Implement proper origin checking
		return true
	},
}

func HandleWebSocket(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}

		client := &Client{
			hub:      hub,
			conn:     conn,
			send:     make(chan []byte, 256),
			channels: make(map[string]bool),
		}

		// Check for token in query string for initial auth
		if token := c.Query("token"); token != "" {
			if claims, err := validateToken(token); err == nil {
				client.userID = claims.UserID
				client.tenantID = claims.TenantID
				hub.Subscribe(client, "user:"+client.userID)
			}
		}

		hub.register <- client

		go client.writePump()
		go client.readPump()
	}
}
```

## Client Implementation (TypeScript)

```typescript
// lib/websocket.ts
type MessageHandler = (payload: any) => void;

interface WebSocketOptions {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

class ShopWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketOptions>;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private isConnected = false;
  private messageQueue: string[] = [];

  constructor(options: WebSocketOptions) {
    this.options = {
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      token: '',
      ...options,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.options.token
        ? `${this.options.url}?token=${this.options.token}`
        : this.options.url;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        resolve();
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  disconnect(): void {
    this.options.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type: string, payload: any, id?: string): void {
    const message = JSON.stringify({
      type,
      payload,
      id,
      timestamp: new Date().toISOString(),
    });

    if (this.isConnected && this.ws) {
      this.ws.send(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  subscribe(channel: string): void {
    this.send('subscribe', { channel });
  }

  unsubscribe(channel: string): void {
    this.send('unsubscribe', { channel });
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  off(type: string, handler?: MessageHandler): void {
    if (handler) {
      this.handlers.get(type)?.delete(handler);
    } else {
      this.handlers.delete(type);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      const handlers = this.handlers.get(message.type);

      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message.payload);
          } catch (error) {
            console.error('Handler error:', error);
          }
        });
      }

      // Also emit to wildcard handlers
      const wildcardHandlers = this.handlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private handleReconnect(): void {
    if (!this.options.reconnect) return;
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, this.options.reconnectInterval);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message && this.ws) {
        this.ws.send(message);
      }
    }
  }
}

// Singleton instance
let wsInstance: ShopWebSocket | null = null;

export function getWebSocket(token?: string): ShopWebSocket {
  if (!wsInstance) {
    wsInstance = new ShopWebSocket({
      url: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.shop.example.com/ws',
      token,
    });
  }
  return wsInstance;
}

export { ShopWebSocket };
```

### React Hook

```tsx
// hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { getWebSocket, ShopWebSocket } from '@/lib/websocket';
import { useAuth } from '@/hooks/useAuth';

export function useWebSocket() {
  const { accessToken } = useAuth();
  const wsRef = useRef<ShopWebSocket | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const ws = getWebSocket(accessToken);
    wsRef.current = ws;

    ws.connect().catch(console.error);

    return () => {
      // Don't disconnect on unmount - keep connection alive
    };
  }, [accessToken]);

  const subscribe = useCallback((channel: string) => {
    wsRef.current?.subscribe(channel);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    wsRef.current?.unsubscribe(channel);
  }, []);

  const on = useCallback((type: string, handler: (payload: any) => void) => {
    return wsRef.current?.on(type, handler) ?? (() => {});
  }, []);

  const send = useCallback((type: string, payload: any) => {
    wsRef.current?.send(type, payload);
  }, []);

  return { subscribe, unsubscribe, on, send };
}

// Usage example
export function useOrderUpdates(orderId: string) {
  const { subscribe, unsubscribe, on } = useWebSocket();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const channel = `order:${orderId}`;
    subscribe(channel);

    const unsubscribeHandler = on('order_update', (payload) => {
      if (payload.order_id === orderId) {
        setOrder(payload.order);
      }
    });

    return () => {
      unsubscribe(channel);
      unsubscribeHandler();
    };
  }, [orderId, subscribe, unsubscribe, on]);

  return order;
}
```

## Канали

### User Channel

```
user:{user_id}
```

Персональні сповіщення користувача:
- Оновлення замовлень
- Сповіщення
- Зміни в кошику

### Order Channel

```
order:{order_id}
```

Оновлення конкретного замовлення:
- Зміна статусу
- Tracking updates
- Payment updates

### Tenant Channel (Admin)

```
tenant:{tenant_id}
```

Для адмінів магазину:
- Нові замовлення
- Low stock alerts
- Customer activity

### Public Channel

```
public:announcements
```

Публічні оголошення для всіх.

## Події

### order_update

```json
{
  "type": "order_update",
  "payload": {
    "order_id": "ord_123",
    "status": "shipped",
    "previous_status": "processing",
    "tracking_number": "UA123456789",
    "tracking_url": "https://novaposhta.ua/track/UA123456789",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### notification

```json
{
  "type": "notification",
  "payload": {
    "id": "notif_123",
    "title": "Замовлення відправлено",
    "body": "Ваше замовлення #ORD-001 відправлено",
    "action_url": "/orders/ord_123",
    "icon": "truck",
    "priority": "normal",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### cart_update

```json
{
  "type": "cart_update",
  "payload": {
    "action": "item_added",
    "cart": {
      "id": "cart_123",
      "item_count": 3,
      "total": 1500.00
    },
    "item": {
      "product_id": "prod_456",
      "name": "iPhone 15",
      "quantity": 1
    }
  }
}
```

### inventory_alert

```json
{
  "type": "inventory_alert",
  "payload": {
    "product_id": "prod_123",
    "product_name": "iPhone 15",
    "sku": "IPH15-BLK-128",
    "current_quantity": 5,
    "threshold": 10,
    "alert_type": "low_stock",
    "location": "warehouse_main"
  }
}
```

### chat_message

```json
{
  "type": "chat_message",
  "payload": {
    "conversation_id": "conv_123",
    "message": {
      "id": "msg_456",
      "sender_id": "user_789",
      "sender_name": "Support Agent",
      "content": "Чим можу допомогти?",
      "created_at": "2024-01-15T10:30:00Z"
    }
  }
}
```

## Приклади використання

### Real-time Order Tracking

```tsx
// components/OrderTracker.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function OrderTracker({ orderId }: { orderId: string }) {
  const { subscribe, unsubscribe, on } = useWebSocket();
  const [status, setStatus] = useState<string>('pending');
  const [tracking, setTracking] = useState<string | null>(null);

  useEffect(() => {
    subscribe(`order:${orderId}`);

    const unsubscribeHandler = on('order_update', (payload) => {
      if (payload.order_id === orderId) {
        setStatus(payload.status);
        if (payload.tracking_number) {
          setTracking(payload.tracking_number);
        }
      }
    });

    return () => {
      unsubscribe(`order:${orderId}`);
      unsubscribeHandler();
    };
  }, [orderId]);

  return (
    <div>
      <p>Status: {status}</p>
      {tracking && <p>Tracking: {tracking}</p>}
    </div>
  );
}
```

### Notifications

```tsx
// hooks/useNotifications.ts
import { useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'sonner';

export function useNotifications() {
  const { on } = useWebSocket();

  useEffect(() => {
    const unsubscribe = on('notification', (payload) => {
      toast(payload.title, {
        description: payload.body,
        action: payload.action_url ? {
          label: 'View',
          onClick: () => window.location.href = payload.action_url,
        } : undefined,
      });
    });

    return unsubscribe;
  }, [on]);
}
```

### Admin Dashboard Updates

```tsx
// components/admin/LiveOrderFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

export function LiveOrderFeed({ tenantId }: { tenantId: string }) {
  const { subscribe, on } = useWebSocket();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    subscribe(`tenant:${tenantId}`);

    const unsubscribe = on('new_order', (payload) => {
      setOrders((prev) => [payload.order, ...prev].slice(0, 10));
    });

    return unsubscribe;
  }, [tenantId]);

  return (
    <div className="space-y-2">
      <h3>Recent Orders</h3>
      {orders.map((order) => (
        <div key={order.id} className="p-2 border rounded animate-fade-in">
          <p>#{order.number} - {order.total} UAH</p>
        </div>
      ))}
    </div>
  );
}
```

## Масштабування

### Redis Pub/Sub для кластера

```go
// internal/websocket/redis_hub.go
package websocket

import (
	"context"
	"encoding/json"

	"github.com/redis/go-redis/v9"
)

type RedisHub struct {
	*Hub
	redis   *redis.Client
	channel string
}

func NewRedisHub(redisClient *redis.Client, channel string) *RedisHub {
	hub := &RedisHub{
		Hub:     NewHub(),
		redis:   redisClient,
		channel: channel,
	}

	go hub.subscribeToRedis()

	return hub
}

func (h *RedisHub) subscribeToRedis() {
	ctx := context.Background()
	pubsub := h.redis.Subscribe(ctx, h.channel)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		var message Message
		if err := json.Unmarshal([]byte(msg.Payload), &message); err != nil {
			continue
		}

		h.broadcast <- &message
	}
}

func (h *RedisHub) Publish(ctx context.Context, msg *Message) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return h.redis.Publish(ctx, h.channel, data).Err()
}

// Usage in services
func (s *OrderService) UpdateStatus(ctx context.Context, orderID, status string) error {
	// Update order in DB
	// ...

	// Broadcast via WebSocket
	s.wsHub.Publish(ctx, &Message{
		Type: "order_update",
		Payload: mustMarshalRaw(map[string]interface{}{
			"order_id": orderID,
			"status":   status,
		}),
		Channel: "order:" + orderID,
	})

	return nil
}
```

## Див. також

- [OpenAPI](./OPENAPI.md)
- [Real-time Architecture](../architecture/REALTIME.md)
- [Notifications](../modules/NOTIFICATIONS.md)
