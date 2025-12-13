'use client';

import React from 'react';
import { ChatMessage as ChatMessageType, ChatAttachment } from '@/lib/chat/chat-service';

interface ChatMessageProps {
    message: ChatMessageType;
    showSender?: boolean;
    showTimestamp?: boolean;
    showReadStatus?: boolean;
    isCurrentUser?: boolean;
}

export function ChatMessage({
    message,
    showSender = true,
    showTimestamp = true,
    showReadStatus = false,
    isCurrentUser = false,
}: ChatMessageProps) {
    const isBot = message.senderType === 'bot';
    const isAgent = message.senderType === 'agent';
    const isCustomer = message.senderType === 'customer';

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Сьогодні';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Вчора';
        } else {
            return date.toLocaleDateString('uk-UA', {
                day: 'numeric',
                month: 'long',
            });
        }
    };

    // Відображення вкладень
    const renderAttachment = (attachment: ChatAttachment) => {
        if (attachment.type === 'image') {
            return (
                <div key={attachment.id} className="mt-2">
                    <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="max-w-full rounded-lg max-h-64 object-cover cursor-pointer hover:opacity-90 transition"
                        onClick={() => window.open(attachment.url, '_blank')}
                    />
                    <p className="text-xs text-gray-500 mt-1">{attachment.name}</p>
                </div>
            );
        }

        // Файлове вкладення
        const sizeInKB = Math.round(attachment.size / 1024);
        const sizeInMB = (attachment.size / 1024 / 1024).toFixed(2);
        const displaySize = sizeInKB > 1024 ? `${sizeInMB} МБ` : `${sizeInKB} КБ`;

        return (
            <a
                key={attachment.id}
                href={attachment.url}
                download={attachment.name}
                className="flex items-center gap-2 mt-2 p-2 border rounded-lg hover:bg-gray-50 transition"
            >
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <p className="text-xs text-gray-500">{displaySize}</p>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            </a>
        );
    };

    // Відображення дій бота (кнопки, посилання)
    const renderBotActions = () => {
        if (!isBot || !message.metadata?.actions) return null;

        const actions = message.metadata.actions as Array<{
            type: string;
            label: string;
            data?: Record<string, unknown>;
        }>;

        return (
            <div className="mt-2 space-y-1">
                {actions.map((action, index) => (
                    <button
                        key={index}
                        onClick={() => handleBotAction(action)}
                        className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition"
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        );
    };

    const handleBotAction = (action: { type: string; label: string; data?: Record<string, unknown> }) => {
        if (action.type === 'link' && action.data?.url) {
            window.location.href = action.data.url as string;
        }
        // Інші типи дій можна додати тут
    };

    // Відображення пропозицій бота
    const renderBotSuggestions = () => {
        if (!isBot || !message.metadata?.suggestions) return null;

        const suggestions = message.metadata.suggestions as string[];

        return (
            <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        className="px-3 py-1 text-sm bg-white border border-blue-300 text-blue-700 rounded-full hover:bg-blue-50 transition"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`flex gap-2 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Аватар */}
                {!isCurrentUser && (
                    <div className="flex-shrink-0">
                        {isBot ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                                {message.senderName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                )}

                {/* Повідомлення */}
                <div className="flex flex-col">
                    {/* Ім'я відправника */}
                    {showSender && !isCurrentUser && (
                        <div className="mb-1 flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">
                                {message.senderName}
                            </span>
                            {isBot && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                    Бот
                                </span>
                            )}
                            {isAgent && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    Оператор
                                </span>
                            )}
                        </div>
                    )}

                    {/* Бульбашка повідомлення */}
                    <div
                        className={`px-4 py-2 rounded-2xl ${
                            isCurrentUser
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : isBot
                                ? 'bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 text-gray-800 rounded-bl-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                    >
                        {/* Контент */}
                        <p className="text-sm whitespace-pre-wrap break-words">
                            {message.content}
                        </p>

                        {/* Вкладення */}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className="space-y-2">
                                {message.attachments.map(renderAttachment)}
                            </div>
                        )}

                        {/* Дії бота */}
                        {renderBotActions()}

                        {/* Пропозиції бота */}
                        {renderBotSuggestions()}
                    </div>

                    {/* Мета інформація */}
                    <div className={`mt-1 flex items-center gap-2 text-xs text-gray-500 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                        {showTimestamp && (
                            <span>{formatTime(message.createdAt)}</span>
                        )}

                        {/* Статус прочитання */}
                        {showReadStatus && isCurrentUser && (
                            <div className="flex items-center gap-1">
                                {message.readAt ? (
                                    <>
                                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <svg className="w-4 h-4 text-blue-500 -ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs text-blue-500">Прочитано</span>
                                    </>
                                ) : message.deliveredAt ? (
                                    <>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <svg className="w-4 h-4 text-gray-400 -ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs text-gray-400">Доставлено</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs text-gray-400">Надіслано</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ChatMessage;
