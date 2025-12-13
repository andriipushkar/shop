/**
 * WebSocket Client для Real-Time чату (клієнтська частина)
 *
 * Функціонал:
 * - Підключення до WebSocket сервера
 * - Автоматичне перепідключення
 * - Обробка подій
 * - Черга повідомлень для offline режиму
 * - Typed events
 * - React hooks готовність
 */

'use client';

import type { WSMessage, ChatMessage } from './ws-server';

// Типи подій
export type WSEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'message'
  | 'user-joined'
  | 'user-left'
  | 'typing'
  | 'read'
  | 'welcome';

export type WSEventHandler = (data: any) => void;

export interface WSClientOptions {
  url?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

export interface SendMessageOptions {
  roomId: string;
  message: string;
  attachments?: string[];
}

/**
 * WebSocket Client
 */
export class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private options: Required<Omit<WSClientOptions, 'url'>>;

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;

  private eventHandlers: Map<WSEventType, Set<WSEventHandler>> = new Map();
  private messageQueue: WSMessage[] = [];
  private isConnected = false;
  private isReconnecting = false;

  private currentRooms: Set<string> = new Set();

  constructor(options: WSClientOptions = {}) {
    this.url = options.url || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001/ws';

    this.options = {
      autoConnect: options.autoConnect ?? false,
      reconnect: options.reconnect ?? true,
      reconnectInterval: options.reconnectInterval || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      pingInterval: options.pingInterval || 30000,
      debug: options.debug ?? false,
    };

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * Встановлює токен для автентифікації
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Підключається до WebSocket сервера
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.ws?.readyState === WebSocket.OPEN) {
        this.log('Already connected');
        resolve();
        return;
      }

      try {
        // Додаємо токен до URL якщо є
        const url = this.token
          ? `${this.url}?token=${encodeURIComponent(this.token)}`
          : this.url;

        this.log(`Connecting to ${url}...`);

        this.ws = new WebSocket(url);

        // Обробка відкриття з'єднання
        this.ws.onopen = () => {
          this.log('Connected');
          this.isConnected = true;
          this.isReconnecting = false;
          this.reconnectAttempts = 0;

          // Запускаємо ping
          this.startPing();

          // Відправляємо накопичені повідомлення
          this.flushMessageQueue();

          // Повторно приєднуємось до кімнат
          this.rejoinRooms();

          // Викликаємо event handlers
          this.emit('connected', {});
          resolve();
        };

        // Обробка повідомлень
        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            this.log('Error parsing message:', error);
          }
        };

        // Обробка закриття з'єднання
        this.ws.onclose = (event) => {
          this.log(`Disconnected: ${event.code} ${event.reason}`);
          this.isConnected = false;
          this.stopPing();

          this.emit('disconnected', {
            code: event.code,
            reason: event.reason,
          });

          // Автоматичне перепідключення
          if (this.options.reconnect && !this.isReconnecting) {
            this.scheduleReconnect();
          }
        };

        // Обробка помилок
        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.emit('error', { error });
          reject(error);
        };

      } catch (error) {
        this.log('Connection error:', error);
        this.emit('error', { error });
        reject(error);
      }
    });
  }

  /**
   * Від'єднується від сервера
   */
  disconnect(): void {
    this.log('Disconnecting...');

    // Скасовуємо reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Зупиняємо ping
    this.stopPing();

    // Закриваємо з'єднання
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.isReconnecting = false;
    this.currentRooms.clear();
  }

  /**
   * Планує перепідключення
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = this.options.reconnectInterval * Math.min(this.reconnectAttempts, 5);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnect attempt ${this.reconnectAttempts}...`);
      this.connect().catch(() => {
        // Помилка - буде наступна спроба
      });
    }, delay);
  }

  /**
   * Обробляє вхідне повідомлення
   */
  private handleMessage(message: WSMessage): void {
    this.log('Received:', message);

    const { type, payload } = message;

    // Обробка спеціальних типів
    switch (type) {
      case 'message':
        if (payload.type) {
          this.emit(payload.type as WSEventType, payload);
        }
        this.emit('message', payload);
        break;

      case 'typing':
        this.emit('typing', payload);
        break;

      case 'read':
        this.emit('read', payload);
        break;

      case 'pong':
        // Отримали відповідь на ping
        break;

      default:
        this.log('Unknown message type:', type);
    }
  }

  /**
   * Відправляє повідомлення
   */
  private send(message: WSMessage): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Додаємо в чергу
      this.log('Not connected, queueing message');
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.log('Sent:', message);
    } catch (error) {
      this.log('Error sending message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Відправляє накопичені повідомлення
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    this.log(`Flushing ${this.messageQueue.length} queued messages`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(message => this.send(message));
  }

  /**
   * Повторно приєднується до кімнат після reconnect
   */
  private rejoinRooms(): void {
    this.currentRooms.forEach(roomId => {
      this.send({
        type: 'join',
        payload: { roomId },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Приєднується до кімнати
   */
  joinRoom(roomId: string): void {
    this.log(`Joining room: ${roomId}`);
    this.currentRooms.add(roomId);

    this.send({
      type: 'join',
      payload: { roomId },
      timestamp: Date.now(),
    });
  }

  /**
   * Залишає кімнату
   */
  leaveRoom(roomId: string): void {
    this.log(`Leaving room: ${roomId}`);
    this.currentRooms.delete(roomId);

    this.send({
      type: 'leave',
      payload: { roomId },
      timestamp: Date.now(),
    });
  }

  /**
   * Відправляє чат повідомлення
   */
  sendMessage(options: SendMessageOptions): void {
    this.send({
      type: 'message',
      payload: {
        roomId: options.roomId,
        message: options.message,
        attachments: options.attachments,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Відправляє індикатор набору
   */
  sendTyping(roomId: string, isTyping: boolean): void {
    this.send({
      type: 'typing',
      payload: { roomId, isTyping },
      timestamp: Date.now(),
    });
  }

  /**
   * Відправляє підтвердження прочитання
   */
  sendReadReceipt(roomId: string, messageId: string): void {
    this.send({
      type: 'read',
      payload: { roomId, messageId },
      timestamp: Date.now(),
    });
  }

  /**
   * Запускає ping таймер
   */
  private startPing(): void {
    this.stopPing();

    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'ping',
          payload: {},
          timestamp: Date.now(),
        });
      }
    }, this.options.pingInterval);
  }

  /**
   * Зупиняє ping таймер
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Підписується на подію
   */
  on(event: WSEventType, handler: WSEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Повертаємо функцію для відписки
    return () => this.off(event, handler);
  }

  /**
   * Відписується від події
   */
  off(event: WSEventType, handler: WSEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Викликає event handlers
   */
  private emit(event: WSEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.log(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Перевіряє чи підключено
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Отримує поточні кімнати
   */
  getRooms(): string[] {
    return Array.from(this.currentRooms);
  }

  /**
   * Логування
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[WS Client]', ...args);
    }
  }

  /**
   * Очищає всі ресурси
   */
  destroy(): void {
    this.disconnect();
    this.eventHandlers.clear();
    this.messageQueue = [];
    this.currentRooms.clear();
  }
}

// Singleton інстанс для використання в додатку
let clientInstance: ChatWebSocketClient | null = null;

export function getWSClient(options?: WSClientOptions): ChatWebSocketClient {
  if (!clientInstance) {
    clientInstance = new ChatWebSocketClient(options);
  }
  return clientInstance;
}

// Hook для використання в React компонентах
export function useWebSocket(options: WSClientOptions = {}) {
  if (typeof window === 'undefined') {
    // Server-side
    return null;
  }

  const client = getWSClient(options);
  return client;
}

export default ChatWebSocketClient;
