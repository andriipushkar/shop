'use client';

import React, { useState, useEffect, useRef } from 'react';
import { chatService, Chat, ChatMessage, ChatAgent, QuickReply } from '@/lib/chat/chat-service';
import { ChatMessage as ChatMessageComponent } from '@/components/ChatMessage';

export function ChatDashboard() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<Chat['status'] | 'all'>('all');
    const [filterPriority, setFilterPriority] = useState<Chat['priority'] | 'all'>('all');
    const [agents, setAgents] = useState<ChatAgent[]>([]);
    const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
    const [showQuickReplies, setShowQuickReplies] = useState(false);
    const [statistics, setStatistics] = useState({
        total: 0,
        open: 0,
        pending: 0,
        assigned: 0,
        resolved: 0,
        closed: 0,
        today: 0,
        averageRating: 0,
        averageResponseTime: 0,
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Завантаження даних
    useEffect(() => {
        loadChats();
        loadAgents();
        loadQuickReplies();
        loadStatistics();

        // Оновлення даних кожні 5 секунд
        const interval = setInterval(() => {
            loadChats();
            loadStatistics();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Підписка на оновлення вибраного чату
    useEffect(() => {
        if (selectedChat) {
            loadMessages(selectedChat.id);

            const unsubscribe = chatService.subscribe(selectedChat.id, (message) => {
                setMessages(prev => [...prev, message]);
                loadChats(); // Оновити список чатів
            });

            return () => unsubscribe();
        }
    }, [selectedChat?.id]);

    // Автоскрол до нових повідомлень
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadChats = async () => {
        const allChats = await chatService.getAllActiveChats();
        setChats(allChats);
    };

    const loadMessages = async (chatId: string) => {
        const chatMessages = await chatService.getMessages(chatId);
        setMessages(chatMessages);
    };

    const loadAgents = async () => {
        const agentsList = chatService.getAgents();
        setAgents(agentsList);
    };

    const loadQuickReplies = () => {
        const replies = chatService.getQuickReplies();
        setQuickReplies(replies);
    };

    const loadStatistics = () => {
        const stats = chatService.getChatStatistics();
        setStatistics(stats);
    };

    const handleSendMessage = async () => {
        if (!selectedChat || !inputValue.trim()) return;

        const currentUser = { id: 'agent_1', name: 'Оператор' }; // Отримати з контексту

        await chatService.sendMessage(
            selectedChat.id,
            currentUser.id,
            'agent',
            currentUser.name,
            inputValue.trim()
        );

        setInputValue('');
        inputRef.current?.focus();
    };

    const handleQuickReply = async (reply: QuickReply) => {
        if (!selectedChat) return;

        const currentUser = { id: 'agent_1', name: 'Оператор' };

        await chatService.sendMessage(
            selectedChat.id,
            currentUser.id,
            'agent',
            currentUser.name,
            reply.content
        );

        setShowQuickReplies(false);
    };

    const handleAssignToAgent = async (chatId: string, agentId: string) => {
        await chatService.assignToAgent(chatId, agentId);
        loadChats();
    };

    const handleCloseChat = async (chatId: string) => {
        await chatService.closeChat(chatId);
        loadChats();
        if (selectedChat?.id === chatId) {
            setSelectedChat(null);
            setMessages([]);
        }
    };

    const handleSearch = async () => {
        const results = await chatService.searchChats(searchQuery, {
            status: filterStatus !== 'all' ? filterStatus : undefined,
            priority: filterPriority !== 'all' ? filterPriority : undefined,
        });
        setChats(results);
    };

    useEffect(() => {
        handleSearch();
    }, [searchQuery, filterStatus, filterPriority]);

    const getPriorityColor = (priority: Chat['priority']) => {
        switch (priority) {
            case 'urgent': return 'text-red-600 bg-red-50';
            case 'high': return 'text-orange-600 bg-orange-50';
            case 'normal': return 'text-blue-600 bg-blue-50';
            case 'low': return 'text-gray-600 bg-gray-50';
        }
    };

    const getStatusColor = (status: Chat['status']) => {
        switch (status) {
            case 'open': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'assigned': return 'bg-blue-100 text-blue-800';
            case 'resolved': return 'bg-purple-100 text-purple-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: Chat['status']) => {
        switch (status) {
            case 'open': return 'Відкритий';
            case 'pending': return 'Очікує';
            case 'assigned': return 'Призначений';
            case 'resolved': return 'Вирішений';
            case 'closed': return 'Закритий';
        }
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar - Список чатів */}
            <div className="w-96 bg-white border-r flex flex-col">
                {/* Статистика */}
                <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <h2 className="text-xl font-bold mb-4">Підтримка чату</h2>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="bg-white/10 rounded p-2">
                            <div className="text-2xl font-bold">{statistics.open}</div>
                            <div className="text-xs">Активні</div>
                        </div>
                        <div className="bg-white/10 rounded p-2">
                            <div className="text-2xl font-bold">{statistics.pending}</div>
                            <div className="text-xs">Очікують</div>
                        </div>
                        <div className="bg-white/10 rounded p-2">
                            <div className="text-2xl font-bold">{statistics.today}</div>
                            <div className="text-xs">Сьогодні</div>
                        </div>
                    </div>
                </div>

                {/* Пошук та фільтри */}
                <div className="p-4 border-b space-y-2">
                    <input
                        type="text"
                        placeholder="Пошук чатів..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                        >
                            <option value="all">Всі статуси</option>
                            <option value="open">Відкриті</option>
                            <option value="pending">Очікують</option>
                            <option value="assigned">Призначені</option>
                            <option value="resolved">Вирішені</option>
                        </select>
                        <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value as any)}
                            className="flex-1 px-2 py-1 border rounded text-sm"
                        >
                            <option value="all">Всі пріоритети</option>
                            <option value="urgent">Термінові</option>
                            <option value="high">Високі</option>
                            <option value="normal">Нормальні</option>
                            <option value="low">Низькі</option>
                        </select>
                    </div>
                </div>

                {/* Список чатів */}
                <div className="flex-1 overflow-y-auto">
                    {chats.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p>Немає активних чатів</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {chats.map((chat) => (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                                        selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                                                {chat.customerName.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-sm">{chat.customerName}</h3>
                                                {chat.agentName && (
                                                    <p className="text-xs text-gray-500">→ {chat.agentName}</p>
                                                )}
                                            </div>
                                        </div>
                                        {chat.unreadCount > 0 && (
                                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                                {chat.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(chat.status)}`}>
                                            {getStatusLabel(chat.status)}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${getPriorityColor(chat.priority)}`}>
                                            {chat.priority}
                                        </span>
                                    </div>
                                    {chat.lastMessage && (
                                        <p className="text-sm text-gray-600 truncate">
                                            {chat.lastMessage.content}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(chat.updatedAt).toLocaleString('uk-UA')}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main - Вікно чату */}
            <div className="flex-1 flex flex-col">
                {selectedChat ? (
                    <>
                        {/* Header чату */}
                        <div className="bg-white border-b p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    {selectedChat.customerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg">{selectedChat.customerName}</h2>
                                    {selectedChat.customerEmail && (
                                        <p className="text-sm text-gray-500">{selectedChat.customerEmail}</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <span className={`text-xs px-3 py-1 rounded ${getStatusColor(selectedChat.status)}`}>
                                        {getStatusLabel(selectedChat.status)}
                                    </span>
                                    <span className={`text-xs px-3 py-1 rounded ${getPriorityColor(selectedChat.priority)}`}>
                                        {selectedChat.priority}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedChat.agentId || ''}
                                    onChange={(e) => handleAssignToAgent(selectedChat.id, e.target.value)}
                                    className="px-3 py-2 border rounded"
                                >
                                    <option value="">Призначити оператора</option>
                                    {agents.map((agent) => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.name} ({agent.status})
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => handleCloseChat(selectedChat.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition"
                                >
                                    Закрити чат
                                </button>
                            </div>
                        </div>

                        {/* Повідомлення */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                            {messages.map((message) => (
                                <ChatMessageComponent
                                    key={message.id}
                                    message={message}
                                    showSender={true}
                                    showTimestamp={true}
                                    showReadStatus={true}
                                    isCurrentUser={message.senderType === 'agent'}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Швидкі відповіді */}
                        {showQuickReplies && (
                            <div className="bg-white border-t p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold">Швидкі відповіді</h3>
                                    <button
                                        onClick={() => setShowQuickReplies(false)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                    {quickReplies.map((reply) => (
                                        <button
                                            key={reply.id}
                                            onClick={() => handleQuickReply(reply)}
                                            className="p-3 text-left border rounded hover:bg-gray-50 transition"
                                        >
                                            <div className="font-medium text-sm mb-1">{reply.title}</div>
                                            <div className="text-xs text-gray-600 truncate">{reply.content}</div>
                                            {reply.shortcut && (
                                                <div className="text-xs text-blue-600 mt-1">{reply.shortcut}</div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Поле введення */}
                        <div className="bg-white border-t p-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                                    className={`p-2 rounded transition ${
                                        showQuickReplies ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title="Швидкі відповіді"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </button>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Введіть повідомлення..."
                                    className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!inputValue.trim()}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition"
                                >
                                    Надіслати
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <p className="text-lg">Виберіть чат для початку</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar - Інформація про клієнта */}
            {selectedChat && (
                <div className="w-80 bg-white border-l p-4 overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4">Інформація про клієнта</h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-600">Ім'я</label>
                            <p className="font-medium">{selectedChat.customerName}</p>
                        </div>

                        {selectedChat.customerEmail && (
                            <div>
                                <label className="text-sm text-gray-600">Email</label>
                                <p className="font-medium">{selectedChat.customerEmail}</p>
                            </div>
                        )}

                        {selectedChat.subject && (
                            <div>
                                <label className="text-sm text-gray-600">Тема</label>
                                <p className="font-medium">{selectedChat.subject}</p>
                            </div>
                        )}

                        {selectedChat.category && (
                            <div>
                                <label className="text-sm text-gray-600">Категорія</label>
                                <p className="font-medium">{selectedChat.category}</p>
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-gray-600">Створено</label>
                            <p className="font-medium">
                                {new Date(selectedChat.createdAt).toLocaleString('uk-UA')}
                            </p>
                        </div>

                        {selectedChat.tags && selectedChat.tags.length > 0 && (
                            <div>
                                <label className="text-sm text-gray-600 block mb-2">Теги</label>
                                <div className="flex flex-wrap gap-2">
                                    {selectedChat.tags.map((tag, index) => (
                                        <span key={index} className="px-2 py-1 bg-gray-100 text-sm rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedChat.rating && (
                            <div>
                                <label className="text-sm text-gray-600">Оцінка</label>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span key={star} className={`text-2xl ${star <= selectedChat.rating! ? 'text-yellow-400' : 'text-gray-300'}`}>
                                            ★
                                        </span>
                                    ))}
                                </div>
                                {selectedChat.feedback && (
                                    <p className="text-sm text-gray-600 mt-2">{selectedChat.feedback}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatDashboard;
