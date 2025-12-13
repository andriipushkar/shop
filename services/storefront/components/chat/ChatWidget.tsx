'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat, ChatMessage } from '@/lib/chat/chat-context';
import { useTranslation } from '@/lib/i18n';
import dynamic from 'next/dynamic';

// Динамічний імпорт компонента ChatMessage
const ChatMessageComponent = dynamic(() => import('@/components/ChatMessage'), {
    loading: () => <div className="animate-pulse h-16 bg-gray-100 rounded" />,
});

export function ChatWidget() {
    const {
        chat,
        messages,
        isOpen,
        isConnected,
        operatorTyping,
        unreadCount,
        openChat,
        closeChat,
        startNewChat,
        sendMessage,
        endChat,
        setTyping,
    } = useChat();

    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const [showRating, setShowRating] = useState(false);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Популярні емодзі для швидкого вибору
    const quickEmojis = ['😊', '👍', '❤️', '😂', '😢', '🙏', '👏', '🎉', '🔥', '✅'];

    // Auto scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle typing indicator
    useEffect(() => {
        if (inputValue) {
            setTyping(true);
            const timeout = setTimeout(() => setTyping(false), 2000);
            return () => clearTimeout(timeout);
        }
    }, [inputValue, setTyping]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        await sendMessage(inputValue.trim());
        setInputValue('');
        setShowEmojiPicker(false);
        inputRef.current?.focus();
    };

    const handleEmojiClick = (emoji: string) => {
        setInputValue(prev => prev + emoji);
        inputRef.current?.focus();
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            await sendMessage('', Array.from(files));
        }
        e.target.value = '';
    };

    const handleEndChat = async () => {
        if (rating > 0) {
            await endChat(rating, feedback);
            setShowRating(false);
            setRating(0);
            setFeedback('');
        }
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Floating button
    if (!isOpen) {
        return (
            <button
                onClick={openChat}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
                aria-label="Відкрити чат"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-2xl flex flex-col z-50 border transition-all ${isMinimized ? 'h-14' : 'h-[600px]'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-t-lg flex items-center justify-between cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold">
                            {chat?.operatorName || 'Підтримка'}
                        </h3>
                        <p className="text-xs text-blue-200">
                            {isConnected ? (
                                chat?.status === 'active' ? 'Онлайн' : 'Очікування...'
                            ) : 'Підключення...'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsMinimized(!isMinimized);
                        }}
                        className="p-1 hover:bg-blue-500 rounded transition"
                        aria-label={isMinimized ? 'Розгорнути' : 'Згорнути'}
                    >
                        {isMinimized ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            closeChat();
                        }}
                        className="p-1 hover:bg-blue-500 rounded transition"
                        aria-label="Закрити чат"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {!chat ? (
                    // Start chat view
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">Потрібна допомога?</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            Наші оператори готові відповісти на ваші запитання
                        </p>
                        <button
                            onClick={() => startNewChat()}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                        >
                            Почати чат
                        </button>
                    </div>
                ) : showRating ? (
                    // Rating view
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <h4 className="font-semibold text-gray-900 mb-4">Оцініть якість обслуговування</h4>
                        <div className="flex gap-2 mb-4">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setRating(star)}
                                    className={`text-3xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Ваш відгук (необов'язково)"
                            className="w-full p-2 border rounded-lg mb-4 resize-none"
                            rows={3}
                        />
                        <button
                            onClick={handleEndChat}
                            disabled={rating === 0}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition"
                        >
                            Надіслати
                        </button>
                    </div>
                ) : (
                    // Messages view
                    <>
                        {messages.map((message) => (
                            <MessageBubble key={message.id} message={message} />
                        ))}
                        {operatorTyping && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <span>Оператор друкує...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            {chat && chat.status !== 'closed' && (
                <div className="p-4 border-t bg-white rounded-b-lg">
                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                        <div className="mb-2 p-3 bg-gray-50 rounded-lg border">
                            <div className="flex flex-wrap gap-2">
                                {quickEmojis.map((emoji) => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleEmojiClick(emoji)}
                                        className="text-2xl hover:bg-gray-200 p-1 rounded transition"
                                        type="button"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {/* Emoji Button */}
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-2 rounded transition ${showEmojiPicker ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            aria-label="Додати емодзі"
                            type="button"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>

                        {/* File Attachment Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 text-gray-500 hover:text-gray-700 transition"
                            aria-label="Прикріпити файл"
                            type="button"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                        />

                        {/* Message Input */}
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Введіть повідомлення..."
                            className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
                            rows={1}
                        />

                        {/* Send Button */}
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition self-end"
                            aria-label="Надіслати"
                            type="button"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>

                    {chat.status === 'active' && (
                        <button
                            onClick={() => setShowRating(true)}
                            className="mt-2 text-sm text-gray-500 hover:text-gray-700 transition"
                            type="button"
                        >
                            Завершити чат
                        </button>
                    )}
                </div>
            )}

            {/* Closed chat */}
            {chat?.status === 'closed' && (
                <div className="p-4 border-t bg-white rounded-b-lg text-center">
                    <p className="text-gray-600 mb-2">Чат завершено</p>
                    <button
                        onClick={() => startNewChat()}
                        className="text-blue-600 hover:text-blue-700 transition"
                        type="button"
                    >
                        Почати новий чат
                    </button>
                </div>
            )}
            </>
            )}
        </div>
    );
}

// Message bubble component
function MessageBubble({ message }: { message: ChatMessage }) {
    const isUser = message.senderType === 'user';
    const isSystem = message.senderType === 'system';

    if (isSystem) {
        return (
            <div className="text-center text-sm text-gray-500 py-2">
                {message.content}
            </div>
        );
    }

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
                {!isUser && (
                    <p className="text-xs text-gray-500 mb-1">{message.senderName}</p>
                )}
                <div
                    className={`p-3 rounded-lg ${
                        isUser
                            ? 'bg-blue-600 text-white rounded-br-none'
                            : 'bg-white text-gray-900 border rounded-bl-none'
                    }`}
                >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {message.attachments.map((att) => (
                                <div key={att.id} className="flex items-center gap-2">
                                    {att.type === 'image' ? (
                                        <img src={att.url} alt={att.name} className="max-w-full rounded" />
                                    ) : (
                                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
                                            {att.name}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {new Date(message.createdAt).toLocaleTimeString('uk-UA', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </p>
            </div>
        </div>
    );
}

export default ChatWidget;
