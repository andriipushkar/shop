'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';

// Types
export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    senderType: 'user' | 'operator' | 'system';
    content: string;
    attachments?: ChatAttachment[];
    createdAt: string;
    readAt?: string;
}

export interface ChatAttachment {
    id: string;
    type: 'image' | 'file';
    url: string;
    name: string;
    size: number;
}

export interface Chat {
    id: string;
    userId: string;
    operatorId?: string;
    operatorName?: string;
    status: 'waiting' | 'active' | 'closed';
    subject?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
    rating?: number;
    feedback?: string;
}

export interface Operator {
    id: string;
    name: string;
    avatar?: string;
    status: 'online' | 'busy' | 'offline';
    department: string;
}

interface ChatContextType {
    chat: Chat | null;
    messages: ChatMessage[];
    isOpen: boolean;
    isConnected: boolean;
    isTyping: boolean;
    operatorTyping: boolean;
    unreadCount: number;
    operators: Operator[];

    openChat: () => void;
    closeChat: () => void;
    startNewChat: (subject?: string) => Promise<void>;
    sendMessage: (content: string, attachments?: File[]) => Promise<void>;
    endChat: (rating?: number, feedback?: string) => Promise<void>;
    setTyping: (typing: boolean) => void;
    markAsRead: () => void;
    uploadAttachment: (file: File) => Promise<ChatAttachment>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// WebSocket connection manager
class ChatWebSocket {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

    constructor(url: string) {
        this.url = url;
    }

    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`${this.url}?token=${token}`);

                this.ws.onopen = () => {
                    this.reconnectAttempts = 0;
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.emit(data.type, data.payload);
                    } catch (e) {
                        console.error('Failed to parse message:', e);
                    }
                };

                this.ws.onclose = () => {
                    this.emit('disconnected', null);
                    this.attemptReconnect(token);
                };

                this.ws.onerror = (error) => {
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    private attemptReconnect(token: string) {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.connect(token).catch(() => {});
            }, this.reconnectDelay * this.reconnectAttempts);
        }
    }

    send(type: string, payload: unknown) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }

    on(event: string, callback: (data: unknown) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
    }

    off(event: string, callback: (data: unknown) => void) {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, data: unknown) {
        this.listeners.get(event)?.forEach((cb) => cb(data));
    }

    disconnect() {
        this.ws?.close();
        this.ws = null;
    }

    get connected() {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Mock data for development
const mockOperators: Operator[] = [
    { id: '1', name: 'Олена Петренко', status: 'online', department: 'Підтримка' },
    { id: '2', name: 'Іван Коваленко', status: 'online', department: 'Продажі' },
    { id: '3', name: 'Марія Шевченко', status: 'busy', department: 'Технічна підтримка' },
];

const generateMockResponse = (userMessage: string): string => {
    const responses = [
        'Дякую за ваше звернення! Як я можу вам допомогти?',
        'Я переглянув вашу інформацію. Дозвольте уточнити деталі.',
        'Зачекайте, будь ласка, я перевіряю цю інформацію.',
        'Так, я можу допомогти з цим питанням.',
        'Чудово! Є ще щось, чим я можу допомогти?',
    ];

    if (userMessage.toLowerCase().includes('замовлення')) {
        return 'Я бачу ваше замовлення. Яке саме питання у вас виникло?';
    }
    if (userMessage.toLowerCase().includes('доставка')) {
        return 'Доставка зазвичай займає 1-3 робочих дні. Хочете уточнити статус конкретного замовлення?';
    }
    if (userMessage.toLowerCase().includes('повернення')) {
        return 'Ви можете повернути товар протягом 14 днів. Потрібна допомога з оформленням повернення?';
    }

    return responses[Math.floor(Math.random() * responses.length)];
};

interface ChatProviderProps {
    children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
    const { user } = useAuth();
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [operatorTyping, setOperatorTyping] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [operators] = useState<Operator[]>(mockOperators);
    const [ws, setWs] = useState<ChatWebSocket | null>(null);

    // Initialize WebSocket
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/chat';
        const socket = new ChatWebSocket(wsUrl);
        setWs(socket);

        return () => {
            socket.disconnect();
        };
    }, []);

    // Connect when user logs in
    useEffect(() => {
        if (user && ws) {
            // In production, use real token
            ws.connect('mock-token').then(() => {
                setIsConnected(true);
            }).catch(() => {
                // Fallback to mock mode
                setIsConnected(true);
            });

            ws.on('message', (data) => {
                const message = data as ChatMessage;
                setMessages((prev) => [...prev, message]);
                if (!isOpen) {
                    setUnreadCount((prev) => prev + 1);
                }
            });

            ws.on('operator_typing', () => {
                setOperatorTyping(true);
                setTimeout(() => setOperatorTyping(false), 3000);
            });

            ws.on('chat_closed', () => {
                setChat((prev) => prev ? { ...prev, status: 'closed' } : null);
            });
        }
    }, [user, ws, isOpen]);

    const openChat = useCallback(() => {
        setIsOpen(true);
        setUnreadCount(0);
    }, []);

    const closeChat = useCallback(() => {
        setIsOpen(false);
    }, []);

    const startNewChat = useCallback(async (subject?: string) => {
        const newChat: Chat = {
            id: Date.now().toString(),
            userId: user?.id || 'guest',
            status: 'waiting',
            subject,
            priority: 'normal',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        setChat(newChat);
        setMessages([]);

        // Simulate operator assignment
        setTimeout(() => {
            const operator = operators.find((op) => op.status === 'online');
            if (operator) {
                setChat((prev) => prev ? {
                    ...prev,
                    status: 'active',
                    operatorId: operator.id,
                    operatorName: operator.name,
                } : null);

                const systemMessage: ChatMessage = {
                    id: Date.now().toString(),
                    chatId: newChat.id,
                    senderId: 'system',
                    senderName: 'Система',
                    senderType: 'system',
                    content: `${operator.name} приєднався до чату. Як можу допомогти?`,
                    createdAt: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, systemMessage]);
            }
        }, 2000);

        if (ws?.connected) {
            ws.send('start_chat', { subject });
        }
    }, [user, operators, ws]);

    const sendMessage = useCallback(async (content: string, attachments?: File[]) => {
        if (!chat) return;

        const uploadedAttachments: ChatAttachment[] = [];
        if (attachments) {
            for (const file of attachments) {
                const attachment = await uploadAttachment(file);
                uploadedAttachments.push(attachment);
            }
        }

        const message: ChatMessage = {
            id: Date.now().toString(),
            chatId: chat.id,
            senderId: user?.id || 'guest',
            senderName: user?.name || 'Гість',
            senderType: 'user',
            content,
            attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
            createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, message]);

        if (ws?.connected) {
            ws.send('message', { chatId: chat.id, content, attachments: uploadedAttachments });
        }

        // Mock operator response
        setTimeout(() => {
            setOperatorTyping(true);
        }, 500);

        setTimeout(() => {
            setOperatorTyping(false);
            const response: ChatMessage = {
                id: (Date.now() + 1).toString(),
                chatId: chat.id,
                senderId: chat.operatorId || '1',
                senderName: chat.operatorName || 'Оператор',
                senderType: 'operator',
                content: generateMockResponse(content),
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, response]);
        }, 2000 + Math.random() * 2000);
    }, [chat, user, ws]);

    const endChat = useCallback(async (rating?: number, feedback?: string) => {
        if (!chat) return;

        setChat((prev) => prev ? {
            ...prev,
            status: 'closed',
            closedAt: new Date().toISOString(),
            rating,
            feedback,
        } : null);

        const systemMessage: ChatMessage = {
            id: Date.now().toString(),
            chatId: chat.id,
            senderId: 'system',
            senderName: 'Система',
            senderType: 'system',
            content: 'Чат завершено. Дякуємо за звернення!',
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);

        if (ws?.connected) {
            ws.send('end_chat', { chatId: chat.id, rating, feedback });
        }
    }, [chat, ws]);

    const setTyping = useCallback((typing: boolean) => {
        setIsTyping(typing);
        if (ws?.connected && chat) {
            ws.send('typing', { chatId: chat.id, typing });
        }
    }, [chat, ws]);

    const markAsRead = useCallback(() => {
        setUnreadCount(0);
        if (ws?.connected && chat) {
            ws.send('read', { chatId: chat.id });
        }
    }, [chat, ws]);

    const uploadAttachment = useCallback(async (file: File): Promise<ChatAttachment> => {
        // In production, upload to storage
        return {
            id: Date.now().toString(),
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
        };
    }, []);

    return (
        <ChatContext.Provider value={{
            chat,
            messages,
            isOpen,
            isConnected,
            isTyping,
            operatorTyping,
            unreadCount,
            operators,
            openChat,
            closeChat,
            startNewChat,
            sendMessage,
            endChat,
            setTyping,
            markAsRead,
            uploadAttachment,
        }}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within ChatProvider');
    }
    return context;
}
