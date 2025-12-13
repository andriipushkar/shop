/**
 * Support Chat Service
 * Система чату підтримки з WebSocket підтримкою
 */

// WebSocket Mock для розробки (замінити на справжній WebSocket у продакшені)
class MockWebSocket {
    private listeners: Map<string, Set<Function>> = new Map();
    private isConnected = false;
    private reconnectTimer?: NodeJS.Timeout;

    constructor(private url: string) {}

    connect(): Promise<boolean> {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.isConnected = true;
                this.emit('connected', {});
                resolve(true);
            }, 500);
        });
    }

    disconnect() {
        this.isConnected = false;
        this.emit('disconnected', {});
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
    }

    send(event: string, data: unknown) {
        if (!this.isConnected) {
            console.warn('WebSocket не підключено');
            return;
        }
        // У реальному WebSocket - відправка даних на сервер
        console.log(`WS Send: ${event}`, data);
    }

    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: string, callback: Function) {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, data: unknown) {
        this.listeners.get(event)?.forEach(callback => callback(data));
    }

    get connected() {
        return this.isConnected;
    }

    // Симуляція отримання повідомлення від сервера
    simulateMessage(message: ChatMessage) {
        if (this.isConnected) {
            this.emit('message', message);
        }
    }

    simulateTyping(chatId: string, isTyping: boolean) {
        if (this.isConnected) {
            this.emit('typing', { chatId, isTyping });
        }
    }

    simulateReadReceipt(chatId: string, messageId: string) {
        if (this.isConnected) {
            this.emit('read', { chatId, messageId });
        }
    }
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderType: 'customer' | 'agent' | 'bot';
    senderName: string;
    content: string;
    contentType: 'text' | 'image' | 'file' | 'order' | 'product';
    attachments?: ChatAttachment[];
    metadata?: Record<string, unknown>;
    readAt?: string;
    deliveredAt?: string;
    createdAt: string;
}

export interface ChatAttachment {
    id: string;
    type: 'image' | 'file';
    name: string;
    url: string;
    size: number;
    mimeType: string;
}

export interface Chat {
    id: string;
    customerId: string;
    customerName: string;
    customerEmail?: string;
    agentId?: string;
    agentName?: string;
    status: ChatStatus;
    priority: ChatPriority;
    category?: ChatCategory;
    subject?: string;
    tags: string[];
    unreadCount: number;
    lastMessage?: ChatMessage;
    metadata?: Record<string, unknown>;
    rating?: number;
    feedback?: string;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
}

export type ChatStatus = 'open' | 'pending' | 'assigned' | 'resolved' | 'closed';
export type ChatPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ChatCategory = 'general' | 'order' | 'product' | 'delivery' | 'return' | 'payment' | 'technical';

export interface ChatAgent {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    activeChats: number;
    maxChats: number;
    skills: ChatCategory[];
}

export interface QuickReply {
    id: string;
    title: string;
    content: string;
    category?: ChatCategory;
    shortcut?: string;
}

export interface ChatBotResponse {
    message: string;
    suggestions?: string[];
    actions?: ChatBotAction[];
    transferToAgent?: boolean;
}

export interface ChatBotAction {
    type: 'link' | 'order_status' | 'track_delivery' | 'contact_agent';
    label: string;
    data?: Record<string, unknown>;
}

// Швидкі відповіді бота
const BOT_RESPONSES: Record<string, ChatBotResponse> = {
    greeting: {
        message: 'Вітаю! Я віртуальний помічник TechShop. Чим можу допомогти?',
        suggestions: [
            'Статус замовлення',
            'Відстежити доставку',
            'Повернення товару',
            "Зв'язатися з оператором",
        ],
    },
    order_status: {
        message: 'Щоб перевірити статус замовлення, будь ласка, введіть номер замовлення або авторизуйтесь в особистому кабінеті.',
        actions: [
            { type: 'link', label: 'Мої замовлення', data: { url: '/profile/orders' } },
        ],
    },
    delivery: {
        message: 'Для відстеження доставки вам знадобиться номер ТТН. Введіть його, і я покажу статус.',
        actions: [
            { type: 'track_delivery', label: 'Відстежити посилку' },
        ],
    },
    return: {
        message: 'Для повернення товару:\n1. Заповніть заявку на повернення\n2. Надішліть товар на наш склад\n3. Отримайте кошти протягом 3-5 днів\n\nТермін повернення: 14 днів з моменту отримання.',
        actions: [
            { type: 'link', label: 'Оформити повернення', data: { url: '/returns' } },
        ],
    },
    payment: {
        message: 'Ми приймаємо оплату:\n• Карткою Visa/MasterCard\n• LiqPay\n• Monobank\n• Накладений платіж\n• Безготівковий розрахунок для юридичних осіб',
    },
    contact_agent: {
        message: "Зараз з'єдную вас з оператором. Будь ласка, зачекайте...",
        transferToAgent: true,
    },
    unknown: {
        message: "Вибачте, я не зовсім зрозумів ваше питання. Спробуйте переформулювати або зв'яжіться з оператором.",
        suggestions: [
            'Статус замовлення',
            'Допомога з доставкою',
            "Зв'язатися з оператором",
        ],
    },
};

// Швидкі відповіді для операторів
export const QUICK_REPLIES: QuickReply[] = [
    {
        id: '1',
        title: 'Вітання',
        content: 'Доброго дня! Дякуємо, що звернулися до TechShop. Чим можу допомогти?',
        shortcut: '/hello',
    },
    {
        id: '2',
        title: 'Статус замовлення',
        content: 'Ваше замовлення #{orderId} знаходиться у статусі: {status}. Очікуваний час доставки: {deliveryDate}.',
        category: 'order',
        shortcut: '/status',
    },
    {
        id: '3',
        title: 'Доставка',
        content: 'Доставка здійснюється Новою Поштою протягом 1-3 днів. Безкоштовна доставка при замовленні від 1000 грн.',
        category: 'delivery',
        shortcut: '/delivery',
    },
    {
        id: '4',
        title: 'Повернення',
        content: 'Ви можете повернути товар протягом 14 днів з моменту отримання. Для цього заповніть форму повернення на сайті.',
        category: 'return',
        shortcut: '/return',
    },
    {
        id: '5',
        title: 'Подяка',
        content: 'Дякуємо за звернення! Якщо виникнуть додаткові питання, звертайтесь. Гарного дня!',
        shortcut: '/thanks',
    },
];

class ChatService {
    private chats: Map<string, Chat> = new Map();
    private messages: Map<string, ChatMessage[]> = new Map();
    private agents: Map<string, ChatAgent> = new Map();
    private listeners: Map<string, ((message: ChatMessage) => void)[]> = new Map();
    private typingListeners: Map<string, ((isTyping: boolean) => void)[]> = new Map();
    private readReceiptListeners: Map<string, ((messageId: string) => void)[]> = new Map();
    private ws: MockWebSocket | null = null;
    private wsUrl: string = typeof window !== 'undefined'
        ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/chat')
        : 'ws://localhost:3001/chat';

    /**
     * Створення нового чату
     */
    async createChat(
        customerId: string,
        customerName: string,
        customerEmail?: string,
        subject?: string,
        category?: ChatCategory
    ): Promise<Chat> {
        const chatId = `chat_${Date.now()}`;

        const chat: Chat = {
            id: chatId,
            customerId,
            customerName,
            customerEmail,
            status: 'open',
            priority: 'normal',
            category,
            subject,
            tags: [],
            unreadCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        this.chats.set(chatId, chat);
        this.messages.set(chatId, []);

        // Відправити привітання від бота
        await this.sendBotMessage(chatId, BOT_RESPONSES.greeting);

        return chat;
    }

    /**
     * Отримання чату
     */
    async getChat(chatId: string): Promise<Chat | null> {
        return this.chats.get(chatId) || null;
    }

    /**
     * Отримання чатів користувача
     */
    async getCustomerChats(customerId: string): Promise<Chat[]> {
        return Array.from(this.chats.values())
            .filter(chat => chat.customerId === customerId)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    /**
     * Відправлення повідомлення
     */
    async sendMessage(
        chatId: string,
        senderId: string,
        senderType: 'customer' | 'agent',
        senderName: string,
        content: string,
        contentType: ChatMessage['contentType'] = 'text',
        attachments?: ChatAttachment[]
    ): Promise<ChatMessage> {
        const chat = await this.getChat(chatId);
        if (!chat) {
            throw new Error('Chat not found');
        }

        const message: ChatMessage = {
            id: `msg_${Date.now()}`,
            chatId,
            senderId,
            senderType,
            senderName,
            content,
            contentType,
            attachments,
            createdAt: new Date().toISOString(),
        };

        // Збереження повідомлення
        const chatMessages = this.messages.get(chatId) || [];
        chatMessages.push(message);
        this.messages.set(chatId, chatMessages);

        // Оновлення чату
        chat.lastMessage = message;
        chat.updatedAt = new Date().toISOString();
        if (senderType === 'customer') {
            chat.unreadCount++;
        }

        // Сповіщення слухачів
        const chatListeners = this.listeners.get(chatId) || [];
        chatListeners.forEach(listener => listener(message));

        // Обробка ботом (якщо немає оператора)
        if (senderType === 'customer' && !chat.agentId) {
            await this.processBotResponse(chatId, content);
        }

        return message;
    }

    /**
     * Відправлення повідомлення від бота
     */
    private async sendBotMessage(chatId: string, response: ChatBotResponse): Promise<ChatMessage> {
        const message: ChatMessage = {
            id: `msg_${Date.now()}`,
            chatId,
            senderId: 'bot',
            senderType: 'bot',
            senderName: 'Віртуальний помічник',
            content: response.message,
            contentType: 'text',
            metadata: {
                suggestions: response.suggestions,
                actions: response.actions,
            },
            createdAt: new Date().toISOString(),
        };

        const chatMessages = this.messages.get(chatId) || [];
        chatMessages.push(message);
        this.messages.set(chatId, chatMessages);

        const chat = await this.getChat(chatId);
        if (chat) {
            chat.lastMessage = message;
            chat.updatedAt = new Date().toISOString();
        }

        // Сповіщення слухачів
        const chatListeners = this.listeners.get(chatId) || [];
        chatListeners.forEach(listener => listener(message));

        // Передача оператору
        if (response.transferToAgent) {
            await this.assignToAgent(chatId);
        }

        return message;
    }

    /**
     * Обробка відповіді бота
     */
    private async processBotResponse(chatId: string, userMessage: string): Promise<void> {
        const lowerMessage = userMessage.toLowerCase();
        let response: ChatBotResponse;

        if (lowerMessage.includes('замовлення') || lowerMessage.includes('статус')) {
            response = BOT_RESPONSES.order_status;
        } else if (lowerMessage.includes('доставк') || lowerMessage.includes('посилк') || lowerMessage.includes('ттн')) {
            response = BOT_RESPONSES.delivery;
        } else if (lowerMessage.includes('поверн') || lowerMessage.includes('обмін')) {
            response = BOT_RESPONSES.return;
        } else if (lowerMessage.includes('оплат') || lowerMessage.includes('картк')) {
            response = BOT_RESPONSES.payment;
        } else if (lowerMessage.includes('оператор') || lowerMessage.includes("зв'язат") || lowerMessage.includes('людин')) {
            response = BOT_RESPONSES.contact_agent;
        } else {
            response = BOT_RESPONSES.unknown;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.sendBotMessage(chatId, response);
    }

    /**
     * Призначення оператора
     */
    async assignToAgent(chatId: string, agentId?: string): Promise<boolean> {
        const chat = await this.getChat(chatId);
        if (!chat) return false;

        let agent: ChatAgent | undefined;
        if (agentId) {
            agent = this.agents.get(agentId);
        } else {
            agent = this.findAvailableAgent(chat.category);
        }

        if (agent) {
            chat.agentId = agent.id;
            chat.agentName = agent.name;
            chat.status = 'assigned';
            agent.activeChats++;

            await this.sendBotMessage(chatId, {
                message: `Оператор ${agent.name} приєднався до чату.`,
            });

            return true;
        }

        chat.status = 'pending';
        await this.sendBotMessage(chatId, {
            message: 'Всі оператори зараз зайняті. Середній час очікування: 5 хвилин.',
        });

        return false;
    }

    /**
     * Пошук доступного оператора
     */
    private findAvailableAgent(category?: ChatCategory): ChatAgent | undefined {
        return Array.from(this.agents.values())
            .filter(agent => {
                if (agent.status !== 'online') return false;
                if (agent.activeChats >= agent.maxChats) return false;
                if (category && !agent.skills.includes(category)) return false;
                return true;
            })
            .sort((a, b) => a.activeChats - b.activeChats)[0];
    }

    /**
     * Отримання повідомлень чату
     */
    async getMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
        const messages = this.messages.get(chatId) || [];
        return messages.slice(-limit);
    }

    /**
     * Закриття чату
     */
    async closeChat(chatId: string, rating?: number, feedback?: string): Promise<void> {
        const chat = await this.getChat(chatId);
        if (!chat) return;

        chat.status = 'closed';
        chat.closedAt = new Date().toISOString();
        chat.rating = rating;
        chat.feedback = feedback;

        if (chat.agentId) {
            const agent = this.agents.get(chat.agentId);
            if (agent) {
                agent.activeChats = Math.max(0, agent.activeChats - 1);
            }
        }
    }

    /**
     * Підписка на повідомлення
     */
    subscribe(chatId: string, callback: (message: ChatMessage) => void): () => void {
        const listeners = this.listeners.get(chatId) || [];
        listeners.push(callback);
        this.listeners.set(chatId, listeners);

        return () => {
            const currentListeners = this.listeners.get(chatId) || [];
            this.listeners.set(chatId, currentListeners.filter(l => l !== callback));
        };
    }

    /**
     * Підписка на індикатор набору
     */
    subscribeToTyping(chatId: string, callback: (isTyping: boolean) => void): () => void {
        const listeners = this.typingListeners.get(chatId) || [];
        listeners.push(callback);
        this.typingListeners.set(chatId, listeners);

        return () => {
            const currentListeners = this.typingListeners.get(chatId) || [];
            this.typingListeners.set(chatId, currentListeners.filter(l => l !== callback));
        };
    }

    /**
     * Підписка на підтвердження прочитання
     */
    subscribeToReadReceipts(chatId: string, callback: (messageId: string) => void): () => void {
        const listeners = this.readReceiptListeners.get(chatId) || [];
        listeners.push(callback);
        this.readReceiptListeners.set(chatId, listeners);

        return () => {
            const currentListeners = this.readReceiptListeners.get(chatId) || [];
            this.readReceiptListeners.set(chatId, currentListeners.filter(l => l !== callback));
        };
    }

    /**
     * Відправка індикатора набору
     */
    async sendTypingIndicator(chatId: string, isTyping: boolean): Promise<void> {
        if (this.ws?.connected) {
            this.ws.send('typing', { chatId, isTyping });
        }

        // Сповіщення локальних слухачів
        const listeners = this.typingListeners.get(chatId) || [];
        listeners.forEach(listener => listener(isTyping));
    }

    /**
     * Відмітка повідомлень як прочитаних
     */
    async markMessagesAsRead(chatId: string, messageIds: string[]): Promise<void> {
        const chatMessages = this.messages.get(chatId) || [];
        const now = new Date().toISOString();

        messageIds.forEach(messageId => {
            const message = chatMessages.find(m => m.id === messageId);
            if (message && !message.readAt) {
                message.readAt = now;
            }
        });

        if (this.ws?.connected) {
            this.ws.send('read_receipt', { chatId, messageIds });
        }

        // Сповіщення слухачів
        const listeners = this.readReceiptListeners.get(chatId) || [];
        messageIds.forEach(messageId => {
            listeners.forEach(listener => listener(messageId));
        });
    }

    /**
     * Підключення до WebSocket
     */
    async connectWebSocket(userId: string): Promise<boolean> {
        if (this.ws?.connected) {
            return true;
        }

        this.ws = new MockWebSocket(this.wsUrl);

        // Підписка на події WebSocket
        this.ws.on('message', (data: unknown) => {
            const message = data as ChatMessage;
            const chatMessages = this.messages.get(message.chatId) || [];
            chatMessages.push(message);
            this.messages.set(message.chatId, chatMessages);

            // Оновлення чату
            const chat = this.chats.get(message.chatId);
            if (chat) {
                chat.lastMessage = message;
                chat.updatedAt = new Date().toISOString();
                if (message.senderType === 'customer') {
                    chat.unreadCount++;
                }
            }

            // Сповіщення слухачів
            const listeners = this.listeners.get(message.chatId) || [];
            listeners.forEach(listener => listener(message));
        });

        this.ws.on('typing', (data: unknown) => {
            const { chatId, isTyping } = data as { chatId: string; isTyping: boolean };
            const listeners = this.typingListeners.get(chatId) || [];
            listeners.forEach(listener => listener(isTyping));
        });

        this.ws.on('read', (data: unknown) => {
            const { chatId, messageId } = data as { chatId: string; messageId: string };
            const listeners = this.readReceiptListeners.get(chatId) || [];
            listeners.forEach(listener => listener(messageId));
        });

        return await this.ws.connect();
    }

    /**
     * Відключення від WebSocket
     */
    disconnectWebSocket(): void {
        if (this.ws) {
            this.ws.disconnect();
            this.ws = null;
        }
    }

    /**
     * Перевірка підключення WebSocket
     */
    isWebSocketConnected(): boolean {
        return this.ws?.connected || false;
    }

    /**
     * Реєстрація оператора
     */
    registerAgent(agent: ChatAgent): void {
        this.agents.set(agent.id, agent);
    }

    /**
     * Отримання списку операторів
     */
    getAgents(): ChatAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Оновлення статусу оператора
     */
    updateAgentStatus(agentId: string, status: ChatAgent['status']): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.status = status;
        }
    }

    /**
     * Отримання активних чатів оператора
     */
    async getAgentChats(agentId: string): Promise<Chat[]> {
        return Array.from(this.chats.values())
            .filter(chat => chat.agentId === agentId && chat.status !== 'closed')
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    /**
     * Отримання всіх активних чатів (для адміністраторів)
     */
    async getAllActiveChats(): Promise<Chat[]> {
        return Array.from(this.chats.values())
            .filter(chat => chat.status !== 'closed')
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    /**
     * Пошук чатів
     */
    async searchChats(query: string, filters?: {
        status?: ChatStatus;
        priority?: ChatPriority;
        category?: ChatCategory;
        agentId?: string;
    }): Promise<Chat[]> {
        let chats = Array.from(this.chats.values());

        // Фільтрація
        if (filters?.status) {
            chats = chats.filter(chat => chat.status === filters.status);
        }
        if (filters?.priority) {
            chats = chats.filter(chat => chat.priority === filters.priority);
        }
        if (filters?.category) {
            chats = chats.filter(chat => chat.category === filters.category);
        }
        if (filters?.agentId) {
            chats = chats.filter(chat => chat.agentId === filters.agentId);
        }

        // Пошук
        if (query) {
            const lowerQuery = query.toLowerCase();
            chats = chats.filter(chat =>
                chat.customerName.toLowerCase().includes(lowerQuery) ||
                chat.subject?.toLowerCase().includes(lowerQuery) ||
                chat.lastMessage?.content.toLowerCase().includes(lowerQuery)
            );
        }

        return chats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    /**
     * Отримання статистики чатів
     */
    getChatStatistics() {
        const chats = Array.from(this.chats.values());
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return {
            total: chats.length,
            open: chats.filter(c => c.status === 'open').length,
            pending: chats.filter(c => c.status === 'pending').length,
            assigned: chats.filter(c => c.status === 'assigned').length,
            resolved: chats.filter(c => c.status === 'resolved').length,
            closed: chats.filter(c => c.status === 'closed').length,
            today: chats.filter(c => new Date(c.createdAt) >= today).length,
            averageRating: this.calculateAverageRating(chats),
            averageResponseTime: this.calculateAverageResponseTime(chats),
        };
    }

    private calculateAverageRating(chats: Chat[]): number {
        const ratedChats = chats.filter(c => c.rating !== undefined);
        if (ratedChats.length === 0) return 0;
        const sum = ratedChats.reduce((acc, chat) => acc + (chat.rating || 0), 0);
        return Math.round((sum / ratedChats.length) * 10) / 10;
    }

    private calculateAverageResponseTime(chats: Chat[]): number {
        // Спрощена версія - в реальному проекті потрібна більш складна логіка
        return 0;
    }

    /**
     * Отримання швидких відповідей
     */
    getQuickReplies(category?: ChatCategory): QuickReply[] {
        if (category) {
            return QUICK_REPLIES.filter(r => !r.category || r.category === category);
        }
        return QUICK_REPLIES;
    }

    /**
     * Збереження історії чату (персистентність)
     */
    async persistChatHistory(chatId: string): Promise<void> {
        const chat = this.chats.get(chatId);
        const messages = this.messages.get(chatId);

        if (chat && messages && typeof window !== 'undefined') {
            localStorage.setItem(`chat_${chatId}`, JSON.stringify({
                chat,
                messages,
            }));
        }
    }

    /**
     * Завантаження історії чату
     */
    async loadChatHistory(chatId: string): Promise<{ chat: Chat; messages: ChatMessage[] } | null> {
        if (typeof window === 'undefined') return null;

        const stored = localStorage.getItem(`chat_${chatId}`);
        if (stored) {
            const data = JSON.parse(stored);
            this.chats.set(chatId, data.chat);
            this.messages.set(chatId, data.messages);
            return data;
        }

        return null;
    }

    /**
     * Очищення старих чатів
     */
    async cleanupOldChats(daysOld: number = 30): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        let cleaned = 0;
        for (const [chatId, chat] of this.chats.entries()) {
            if (chat.status === 'closed' && new Date(chat.closedAt!) < cutoffDate) {
                this.chats.delete(chatId);
                this.messages.delete(chatId);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem(`chat_${chatId}`);
                }
                cleaned++;
            }
        }

        return cleaned;
    }
}

// Singleton instance
export const chatService = new ChatService();

// React hook
export function useChatService() {
    return chatService;
}
