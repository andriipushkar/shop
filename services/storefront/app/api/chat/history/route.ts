import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '@/lib/chat/chat-service';

/**
 * GET /api/chat/history
 * Отримання історії чатів користувача
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const chatId = searchParams.get('chatId');

        if (!customerId && !chatId) {
            return NextResponse.json(
                { error: 'Потрібен customerId або chatId' },
                { status: 400 }
            );
        }

        // Якщо запитується конкретний чат
        if (chatId) {
            const history = await chatService.loadChatHistory(chatId);

            if (!history) {
                return NextResponse.json(
                    { error: 'Історію чату не знайдено' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                chat: history.chat,
                messages: history.messages,
            });
        }

        // Якщо запитуються всі чати користувача
        if (customerId) {
            const chats = await chatService.getCustomerChats(customerId);

            return NextResponse.json({
                success: true,
                chats,
                total: chats.length,
            });
        }

        return NextResponse.json(
            { error: 'Невірні параметри' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Помилка отримання історії:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/chat/history
 * Створення нового чату
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            customerId,
            customerName,
            customerEmail,
            subject,
            category,
        } = body;

        // Валідація
        if (!customerId || !customerName) {
            return NextResponse.json(
                { error: 'Відсутні обов\'язкові поля (customerId, customerName)' },
                { status: 400 }
            );
        }

        // Створення чату
        const chat = await chatService.createChat(
            customerId,
            customerName,
            customerEmail,
            subject,
            category
        );

        // Збереження історії
        await chatService.persistChatHistory(chat.id);

        return NextResponse.json({
            success: true,
            chat,
        });
    } catch (error) {
        console.error('Помилка створення чату:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/chat/history
 * Очищення старої історії чатів
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const daysOld = parseInt(searchParams.get('daysOld') || '30');

        if (daysOld < 1) {
            return NextResponse.json(
                { error: 'Некоректна кількість днів' },
                { status: 400 }
            );
        }

        const cleaned = await chatService.cleanupOldChats(daysOld);

        return NextResponse.json({
            success: true,
            message: `Очищено ${cleaned} старих чатів`,
            cleaned,
        });
    } catch (error) {
        console.error('Помилка очищення історії:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}
