import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '@/lib/chat/chat-service';

/**
 * GET /api/chat/messages
 * Отримання повідомлень чату
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const chatId = searchParams.get('chatId');
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!chatId) {
            return NextResponse.json(
                { error: 'Не вказано chatId' },
                { status: 400 }
            );
        }

        // Перевірка доступу до чату (спрощена версія)
        // У продакшені потрібна повна автентифікація та авторизація
        const chat = await chatService.getChat(chatId);
        if (!chat) {
            return NextResponse.json(
                { error: 'Чат не знайдено' },
                { status: 404 }
            );
        }

        const messages = await chatService.getMessages(chatId, limit);

        return NextResponse.json({
            success: true,
            messages,
            total: messages.length,
        });
    } catch (error) {
        console.error('Помилка отримання повідомлень:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chat/messages
 * Відправлення нового повідомлення
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            chatId,
            senderId,
            senderType,
            senderName,
            content,
            contentType = 'text',
            attachments = [],
        } = body;

        // Валідація
        if (!chatId || !senderId || !senderType || !senderName || !content) {
            return NextResponse.json(
                { error: 'Відсутні обов\'язкові поля' },
                { status: 400 }
            );
        }

        if (!['customer', 'agent', 'bot'].includes(senderType)) {
            return NextResponse.json(
                { error: 'Невірний тип відправника' },
                { status: 400 }
            );
        }

        // Перевірка існування чату
        const chat = await chatService.getChat(chatId);
        if (!chat) {
            return NextResponse.json(
                { error: 'Чат не знайдено' },
                { status: 404 }
            );
        }

        // Відправлення повідомлення
        const message = await chatService.sendMessage(
            chatId,
            senderId,
            senderType,
            senderName,
            content,
            contentType,
            attachments
        );

        // Збереження історії
        await chatService.persistChatHistory(chatId);

        return NextResponse.json({
            success: true,
            message,
        });
    } catch (error) {
        console.error('Помилка відправлення повідомлення:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/chat/messages
 * Відмітка повідомлень як прочитаних
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { chatId, messageIds } = body;

        if (!chatId || !messageIds || !Array.isArray(messageIds)) {
            return NextResponse.json(
                { error: 'Невірні параметри' },
                { status: 400 }
            );
        }

        await chatService.markMessagesAsRead(chatId, messageIds);

        return NextResponse.json({
            success: true,
            message: 'Повідомлення відмічено як прочитані',
        });
    } catch (error) {
        console.error('Помилка відмітки повідомлень:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}
