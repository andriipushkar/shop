/**
 * WebSocket Server для Real-Time чату
 *
 * Функціонал:
 * - Управління підключеннями
 * - Room-based messaging (кімнати чату)
 * - Heartbeat/ping-pong для підтримки з'єднання
 * - Автентифікація користувачів
 * - Broadcast повідомлень
 * - Типізовані події
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { verify } from 'jsonwebtoken';

// Типи для WebSocket подій
export interface WSMessage {
  type: 'message' | 'join' | 'leave' | 'typing' | 'read' | 'ping' | 'pong';
  payload: any;
  timestamp: number;
  userId?: string;
  roomId?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  attachments?: string[];
}

export interface WSClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  rooms: Set<string>;
  isAlive: boolean;
  lastActivity: number;
}

export interface WSServerOptions {
  port?: number;
  path?: string;
  pingInterval?: number;
  pongTimeout?: number;
  maxConnections?: number;
  authRequired?: boolean;
}

/**
 * WebSocket Server Manager
 */
export class ChatWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WSClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  private options: Required<WSServerOptions>;

  constructor(options: WSServerOptions = {}) {
    this.options = {
      port: options.port || parseInt(process.env.WS_SERVER_PORT || '3001'),
      path: options.path || '/ws',
      pingInterval: options.pingInterval || 30000, // 30 секунд
      pongTimeout: options.pongTimeout || 5000, // 5 секунд
      maxConnections: options.maxConnections || 1000,
      authRequired: options.authRequired ?? true,
    };
  }

  /**
   * Запускає WebSocket сервер
   */
  start(): void {
    if (this.wss) {
      console.log('[WS Server] Already running');
      return;
    }

    this.wss = new WebSocketServer({
      port: this.options.port,
      path: this.options.path,
    });

    console.log(`[WS Server] Starting on port ${this.options.port}, path ${this.options.path}`);

    // Обробка нових підключень
    this.wss.on('connection', this.handleConnection.bind(this));

    // Обробка помилок сервера
    this.wss.on('error', (error) => {
      console.error('[WS Server] Error:', error);
    });

    // Запускаємо heartbeat
    this.startHeartbeat();

    console.log('[WS Server] Started successfully');
  }

  /**
   * Зупиняє WebSocket сервер
   */
  stop(): void {
    console.log('[WS Server] Stopping...');

    // Зупиняємо heartbeat
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Закриваємо всі з'єднання
    this.clients.forEach((client, userId) => {
      client.ws.close(1000, 'Server shutting down');
      this.clients.delete(userId);
    });

    // Очищаємо кімнати
    this.rooms.clear();

    // Закриваємо сервер
    if (this.wss) {
      this.wss.close(() => {
        console.log('[WS Server] Stopped');
      });
      this.wss = null;
    }
  }

  /**
   * Обробляє нове підключення
   */
  private async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    console.log('[WS Server] New connection attempt');

    // Перевіряємо ліміт підключень
    if (this.clients.size >= this.options.maxConnections) {
      console.log('[WS Server] Max connections reached');
      ws.close(1008, 'Server is full');
      return;
    }

    try {
      // Парсимо URL для отримання query параметрів
      const { query } = parse(req.url || '', true);
      const token = query.token as string;

      // Автентифікація якщо потрібна
      let userId: string;
      let userName: string;

      if (this.options.authRequired) {
        if (!token) {
          ws.close(1008, 'Authentication required');
          return;
        }

        // Верифікуємо токен
        const decoded = await this.verifyToken(token);
        userId = decoded.userId;
        userName = decoded.userName;
      } else {
        // Для development - генеруємо ID
        userId = `user_${Date.now()}`;
        userName = `Guest ${Math.floor(Math.random() * 1000)}`;
      }

      // Створюємо клієнта
      const client: WSClient = {
        ws,
        userId,
        userName,
        rooms: new Set(),
        isAlive: true,
        lastActivity: Date.now(),
      };

      this.clients.set(userId, client);
      console.log(`[WS Server] Client connected: ${userId} (${userName})`);

      // Обробка повідомлень
      ws.on('message', (data) => this.handleMessage(userId, data));

      // Обробка pong відповідей
      ws.on('pong', () => {
        const client = this.clients.get(userId);
        if (client) {
          client.isAlive = true;
          client.lastActivity = Date.now();
        }
      });

      // Обробка закриття з'єднання
      ws.on('close', () => this.handleDisconnect(userId));

      // Обробка помилок
      ws.on('error', (error) => {
        console.error(`[WS Server] Client error (${userId}):`, error);
      });

      // Відправляємо привітання
      this.sendToClient(userId, {
        type: 'message',
        payload: {
          type: 'welcome',
          userId,
          userName,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error('[WS Server] Connection error:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  /**
   * Верифікує JWT токен
   */
  private async verifyToken(token: string): Promise<{ userId: string; userName: string }> {
    try {
      const secret = process.env.NEXTAUTH_SECRET || 'your-secret-key';
      const decoded = verify(token, secret) as any;

      return {
        userId: decoded.sub || decoded.userId,
        userName: decoded.name || decoded.userName || 'Unknown',
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Обробляє вхідне повідомлення
   */
  private handleMessage(userId: string, data: any): void {
    const client = this.clients.get(userId);
    if (!client) return;

    client.lastActivity = Date.now();

    try {
      const message: WSMessage = JSON.parse(data.toString());

      console.log(`[WS Server] Message from ${userId}:`, message.type);

      switch (message.type) {
        case 'join':
          this.handleJoinRoom(userId, message.payload.roomId);
          break;

        case 'leave':
          this.handleLeaveRoom(userId, message.payload.roomId);
          break;

        case 'message':
          this.handleChatMessage(userId, message.payload);
          break;

        case 'typing':
          this.handleTyping(userId, message.payload.roomId, message.payload.isTyping);
          break;

        case 'read':
          this.handleReadReceipt(userId, message.payload.roomId, message.payload.messageId);
          break;

        case 'ping':
          this.sendToClient(userId, {
            type: 'pong',
            payload: {},
            timestamp: Date.now(),
          });
          break;

        default:
          console.log(`[WS Server] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WS Server] Error handling message:', error);
    }
  }

  /**
   * Приєднує користувача до кімнати
   */
  private handleJoinRoom(userId: string, roomId: string): void {
    const client = this.clients.get(userId);
    if (!client) return;

    // Додаємо користувача до кімнати
    client.rooms.add(roomId);

    // Додаємо кімнату до списку
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(userId);

    console.log(`[WS Server] User ${userId} joined room ${roomId}`);

    // Повідомляємо інших користувачів
    this.broadcastToRoom(roomId, {
      type: 'message',
      payload: {
        type: 'user-joined',
        userId,
        userName: client.userName,
        roomId,
      },
      timestamp: Date.now(),
    }, userId);

    // Підтверджуємо приєднання
    this.sendToClient(userId, {
      type: 'message',
      payload: {
        type: 'joined',
        roomId,
        users: Array.from(this.rooms.get(roomId)!).map(id => {
          const c = this.clients.get(id);
          return { userId: id, userName: c?.userName };
        }),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Видаляє користувача з кімнати
   */
  private handleLeaveRoom(userId: string, roomId: string): void {
    const client = this.clients.get(userId);
    if (!client) return;

    client.rooms.delete(roomId);
    this.rooms.get(roomId)?.delete(userId);

    console.log(`[WS Server] User ${userId} left room ${roomId}`);

    // Повідомляємо інших
    this.broadcastToRoom(roomId, {
      type: 'message',
      payload: {
        type: 'user-left',
        userId,
        userName: client.userName,
        roomId,
      },
      timestamp: Date.now(),
    });

    // Видаляємо порожню кімнату
    if (this.rooms.get(roomId)?.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  /**
   * Обробляє чат повідомлення
   */
  private handleChatMessage(userId: string, payload: any): void {
    const client = this.clients.get(userId);
    if (!client) return;

    const { roomId, message, attachments } = payload;

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId,
      userName: client.userName,
      message,
      timestamp: Date.now(),
      attachments,
    };

    console.log(`[WS Server] Chat message in room ${roomId} from ${userId}`);

    // Відправляємо всім в кімнаті
    this.broadcastToRoom(roomId, {
      type: 'message',
      payload: {
        type: 'chat',
        ...chatMessage,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Обробляє індикатор набору
   */
  private handleTyping(userId: string, roomId: string, isTyping: boolean): void {
    const client = this.clients.get(userId);
    if (!client) return;

    // Відправляємо іншим в кімнаті
    this.broadcastToRoom(roomId, {
      type: 'typing',
      payload: {
        userId,
        userName: client.userName,
        roomId,
        isTyping,
      },
      timestamp: Date.now(),
    }, userId);
  }

  /**
   * Обробляє підтвердження прочитання
   */
  private handleReadReceipt(userId: string, roomId: string, messageId: string): void {
    this.broadcastToRoom(roomId, {
      type: 'read',
      payload: {
        userId,
        roomId,
        messageId,
      },
      timestamp: Date.now(),
    }, userId);
  }

  /**
   * Обробляє від'єднання клієнта
   */
  private handleDisconnect(userId: string): void {
    const client = this.clients.get(userId);
    if (!client) return;

    console.log(`[WS Server] Client disconnected: ${userId}`);

    // Видаляємо з усіх кімнат
    client.rooms.forEach(roomId => {
      this.handleLeaveRoom(userId, roomId);
    });

    // Видаляємо клієнта
    this.clients.delete(userId);
  }

  /**
   * Відправляє повідомлення клієнту
   */
  private sendToClient(userId: string, message: WSMessage): void {
    const client = this.clients.get(userId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[WS Server] Error sending to ${userId}:`, error);
    }
  }

  /**
   * Broadcast повідомлення в кімнату
   */
  private broadcastToRoom(roomId: string, message: WSMessage, excludeUserId?: string): void {
    const userIds = this.rooms.get(roomId);
    if (!userIds) return;

    userIds.forEach(userId => {
      if (userId !== excludeUserId) {
        this.sendToClient(userId, message);
      }
    });
  }

  /**
   * Broadcast всім підключеним клієнтам
   */
  public broadcastToAll(message: WSMessage): void {
    this.clients.forEach((client, userId) => {
      this.sendToClient(userId, message);
    });
  }

  /**
   * Запускає heartbeat перевірку
   */
  private startHeartbeat(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, userId) => {
        // Перевіряємо чи клієнт відповів на попередній ping
        if (!client.isAlive) {
          console.log(`[WS Server] Client ${userId} timeout - terminating`);
          client.ws.terminate();
          this.handleDisconnect(userId);
          return;
        }

        // Позначаємо що чекаємо pong
        client.isAlive = false;

        // Відправляємо ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.options.pingInterval);
  }

  /**
   * Отримує статистику сервера
   */
  public getStats(): {
    connections: number;
    rooms: number;
    uptime: number;
  } {
    return {
      connections: this.clients.size,
      rooms: this.rooms.size,
      uptime: process.uptime(),
    };
  }

  /**
   * Отримує список користувачів в кімнаті
   */
  public getRoomUsers(roomId: string): Array<{ userId: string; userName: string }> {
    const userIds = this.rooms.get(roomId);
    if (!userIds) return [];

    return Array.from(userIds).map(userId => {
      const client = this.clients.get(userId);
      return {
        userId,
        userName: client?.userName || 'Unknown',
      };
    });
  }
}

// Експортуємо singleton інстанс
let serverInstance: ChatWebSocketServer | null = null;

export function getWSServer(options?: WSServerOptions): ChatWebSocketServer {
  if (!serverInstance) {
    serverInstance = new ChatWebSocketServer(options);
  }
  return serverInstance;
}

export default getWSServer;
