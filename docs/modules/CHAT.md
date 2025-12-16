# Live Chat Support

Система живого чату для підтримки клієнтів.

## Overview

Модуль chat забезпечує:
- Real-time чат з підтримкою
- Автоматичні відповіді (chatbot)
- Історія розмов
- Файли та зображення
- Інтеграція з CRM
- Черга операторів

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CHAT SYSTEM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Customer   │◄────WebSocket─────▶│   Chat Server         │  │
│  │   Widget     │                    │                       │  │
│  └──────────────┘                    │  - Message routing    │  │
│                                      │  - Presence           │  │
│  ┌──────────────┐                    │  - Typing indicator   │  │
│  │   Operator   │◄────WebSocket─────▶│  - File upload        │  │
│  │   Dashboard  │                    │                       │  │
│  └──────────────┘                    └───────────┬───────────┘  │
│                                                   │              │
│         ┌─────────────────────────────────────────┤              │
│         │                                         │              │
│         ▼                                         ▼              │
│  ┌──────────────┐                    ┌───────────────────────┐  │
│  │   Chatbot    │                    │   Database            │  │
│  │   (Auto)     │                    │   (History)           │  │
│  └──────────────┘                    └───────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```typescript
interface Conversation {
  id: string;
  visitorId: string;
  customerId?: string;
  operatorId?: string;
  status: 'waiting' | 'active' | 'closed';
  channel: 'widget' | 'telegram' | 'viber' | 'facebook';
  metadata: {
    visitorName?: string;
    visitorEmail?: string;
    pageUrl?: string;
    userAgent?: string;
    ip?: string;
  };
  tags: string[];
  rating?: number;
  createdAt: Date;
  closedAt?: Date;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'visitor' | 'operator' | 'bot';
  type: 'text' | 'image' | 'file' | 'system';
  content: string;
  attachments?: Attachment[];
  isRead: boolean;
  createdAt: Date;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface Operator {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  activeChats: number;
  maxChats: number;
}
```

## Usage

### Customer Widget

```typescript
import { chatWidget } from '@/lib/chat';

// Initialize widget
chatWidget.init({
  apiKey: 'your_api_key',
  position: 'bottom-right',
  primaryColor: '#0d9488',
  welcomeMessage: 'Вітаємо! Чим можемо допомогти?',
  offlineMessage: 'Зараз ми офлайн. Залиште повідомлення.',
});

// Open chat
chatWidget.open();

// Send message
chatWidget.send('Привіт, потрібна допомога');

// Set visitor info
chatWidget.setVisitor({
  name: 'Іван',
  email: 'ivan@example.com',
  customData: {
    orderId: 'order-123',
  },
});
```

### Operator Dashboard

```typescript
import { chatService } from '@/lib/chat';

// Get waiting conversations
const waiting = await chatService.getConversations({
  status: 'waiting',
  limit: 10,
});

// Accept conversation
await chatService.acceptConversation(conversationId, operatorId);

// Send message
await chatService.sendMessage({
  conversationId,
  senderId: operator.id,
  senderType: 'operator',
  type: 'text',
  content: 'Вітаю! Як можу допомогти?',
});

// Close conversation
await chatService.closeConversation(conversationId);

// Transfer to another operator
await chatService.transferConversation(conversationId, newOperatorId);
```

### WebSocket Connection

```typescript
// Customer side
const ws = new WebSocket('wss://chat.shop.ua/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'join',
    conversationId: 'conv-123',
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'message':
      displayMessage(message.data);
      break;
    case 'typing':
      showTypingIndicator(message.data.isTyping);
      break;
    case 'operator_joined':
      displaySystemMessage(`${message.data.operatorName} приєднався`);
      break;
  }
};

// Send message
ws.send(JSON.stringify({
  type: 'message',
  content: 'Моє питання...',
}));

// Typing indicator
ws.send(JSON.stringify({
  type: 'typing',
  isTyping: true,
}));
```

## Chatbot (Auto-responses)

```typescript
const chatbotRules = [
  {
    triggers: ['години роботи', 'графік', 'working hours'],
    response: 'Ми працюємо з 9:00 до 21:00 без вихідних.',
  },
  {
    triggers: ['доставка', 'delivery', 'скільки чекати'],
    response: 'Доставка Новою Поштою займає 1-2 дні. Детальніше: /delivery',
  },
  {
    triggers: ['повернення', 'return', 'обмін'],
    response: 'Ви можете повернути товар протягом 14 днів. Детальніше: /returns',
  },
  {
    triggers: ['статус замовлення', 'де моє замовлення'],
    response: 'Введіть номер замовлення, і я перевірю статус.',
    action: 'await_order_id',
  },
];

// Process message with chatbot
const botResponse = await chatbot.process(message.content, context);
if (botResponse) {
  await chatService.sendMessage({
    conversationId,
    senderId: 'bot',
    senderType: 'bot',
    content: botResponse,
  });
}
```

## API Endpoints

```
POST /api/v1/chat/conversations         # Start conversation
GET  /api/v1/chat/conversations/:id     # Get conversation
GET  /api/v1/chat/conversations/:id/messages  # Get messages
POST /api/v1/chat/conversations/:id/messages  # Send message
POST /api/v1/chat/conversations/:id/close     # Close conversation
POST /api/v1/chat/conversations/:id/rate      # Rate conversation

# Operator
GET  /api/v1/chat/operator/conversations      # Operator's conversations
POST /api/v1/chat/operator/accept/:id         # Accept conversation
POST /api/v1/chat/operator/transfer/:id       # Transfer conversation
PUT  /api/v1/chat/operator/status             # Update status

# WebSocket
WS   /api/v1/chat/ws                          # WebSocket connection
```

## Chat Widget

```tsx
function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-teal-600 rounded-full shadow-lg"
      >
        <ChatIcon className="w-6 h-6 text-white mx-auto" />
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="bg-teal-600 text-white p-4 rounded-t-lg flex justify-between">
            <div>
              <h3 className="font-medium">Підтримка</h3>
              <p className="text-sm opacity-80">Зазвичай відповідаємо за 2 хв</p>
            </div>
            <button onClick={() => setIsOpen(false)}>×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Напишіть повідомлення..."
                className="flex-1 border rounded px-3 py-2"
              />
              <button
                onClick={() => sendMessage(input)}
                className="bg-teal-600 text-white px-4 rounded"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

## Configuration

```bash
# Chat settings
CHAT_ENABLED=true
CHAT_WEBSOCKET_URL=wss://chat.shop.ua
CHAT_MAX_OPERATORS=10
CHAT_MAX_CHATS_PER_OPERATOR=5
CHAT_OFFLINE_HOURS=22-9

# Chatbot
CHATBOT_ENABLED=true
CHATBOT_HANDOFF_KEYWORDS=оператор,людина,agent
```

## See Also

- [Telegram Bot](../services/TELEGRAM_BOT.md)
- [CRM](../services/CRM.md)
- [Inbox](./INBOX.md)
