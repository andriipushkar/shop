import { NextRequest, NextResponse } from 'next/server';
import { chatService } from '@/lib/chat/chat-service';

/**
 * GET /api/admin/chat
 * Отримання всіх чатів для адміністраторів
 */
export async function GET(request: NextRequest) {
    try {
        // У продакшені тут має бути перевірка прав адміністратора
        // const session = await getServerSession();
        // if (!session?.user?.isAdmin) {
        //     return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
        // }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // Статистика
        if (action === 'statistics') {
            const stats = chatService.getChatStatistics();
            return NextResponse.json({
                success: true,
                statistics: stats,
            });
        }

        // Список операторів
        if (action === 'agents') {
            const agents = chatService.getAgents();
            return NextResponse.json({
                success: true,
                agents,
            });
        }

        // Швидкі відповіді
        if (action === 'quick-replies') {
            const category = searchParams.get('category') as any;
            const quickReplies = chatService.getQuickReplies(category);
            return NextResponse.json({
                success: true,
                quickReplies,
            });
        }

        // Активні чати
        if (action === 'active') {
            const chats = await chatService.getAllActiveChats();
            return NextResponse.json({
                success: true,
                chats,
                total: chats.length,
            });
        }

        // Чати конкретного оператора
        const agentId = searchParams.get('agentId');
        if (agentId) {
            const chats = await chatService.getAgentChats(agentId);
            return NextResponse.json({
                success: true,
                chats,
                total: chats.length,
            });
        }

        // Пошук чатів
        const query = searchParams.get('query') || '';
        const status = searchParams.get('status') as any;
        const priority = searchParams.get('priority') as any;
        const category = searchParams.get('category') as any;

        const chats = await chatService.searchChats(query, {
            status,
            priority,
            category,
            agentId: searchParams.get('agentId') || undefined,
        });

        return NextResponse.json({
            success: true,
            chats,
            total: chats.length,
        });
    } catch (error) {
        console.error('Помилка отримання даних чату:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/chat
 * Адміністративні дії з чатами
 */
export async function POST(request: NextRequest) {
    try {
        // Перевірка прав адміністратора
        // const session = await getServerSession();
        // if (!session?.user?.isAdmin) {
        //     return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
        // }

        const body = await request.json();
        const { action, chatId, agentId, data } = body;

        // Призначення оператора
        if (action === 'assign') {
            if (!chatId) {
                return NextResponse.json(
                    { error: 'Не вказано chatId' },
                    { status: 400 }
                );
            }

            const success = await chatService.assignToAgent(chatId, agentId);

            return NextResponse.json({
                success,
                message: success
                    ? 'Оператор призначений'
                    : 'Не вдалося призначити оператора',
            });
        }

        // Закриття чату
        if (action === 'close') {
            if (!chatId) {
                return NextResponse.json(
                    { error: 'Не вказано chatId' },
                    { status: 400 }
                );
            }

            await chatService.closeChat(chatId, data?.rating, data?.feedback);

            return NextResponse.json({
                success: true,
                message: 'Чат закрито',
            });
        }

        // Реєстрація оператора
        if (action === 'register-agent') {
            if (!data) {
                return NextResponse.json(
                    { error: 'Не вказано дані оператора' },
                    { status: 400 }
                );
            }

            chatService.registerAgent(data);

            return NextResponse.json({
                success: true,
                message: 'Оператор зареєстрований',
            });
        }

        // Оновлення статусу оператора
        if (action === 'update-agent-status') {
            if (!agentId || !data?.status) {
                return NextResponse.json(
                    { error: 'Не вказано agentId або status' },
                    { status: 400 }
                );
            }

            chatService.updateAgentStatus(agentId, data.status);

            return NextResponse.json({
                success: true,
                message: 'Статус оператора оновлено',
            });
        }

        // Відправка індикатора набору
        if (action === 'typing') {
            if (!chatId || typeof data?.isTyping !== 'boolean') {
                return NextResponse.json(
                    { error: 'Невірні параметри' },
                    { status: 400 }
                );
            }

            await chatService.sendTypingIndicator(chatId, data.isTyping);

            return NextResponse.json({
                success: true,
            });
        }

        return NextResponse.json(
            { error: 'Невідома дія' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Помилка виконання дії:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/admin/chat
 * Оновлення чату
 */
export async function PATCH(request: NextRequest) {
    try {
        // Перевірка прав адміністратора
        // const session = await getServerSession();
        // if (!session?.user?.isAdmin) {
        //     return NextResponse.json({ error: 'Доступ заборонено' }, { status: 403 });
        // }

        const body = await request.json();
        const { chatId, updates } = body;

        if (!chatId || !updates) {
            return NextResponse.json(
                { error: 'Відсутні обов\'язкові поля' },
                { status: 400 }
            );
        }

        const chat = await chatService.getChat(chatId);
        if (!chat) {
            return NextResponse.json(
                { error: 'Чат не знайдено' },
                { status: 404 }
            );
        }

        // Оновлення полів чату
        Object.assign(chat, updates);
        chat.updatedAt = new Date().toISOString();

        // Збереження
        await chatService.persistChatHistory(chatId);

        return NextResponse.json({
            success: true,
            chat,
        });
    } catch (error) {
        console.error('Помилка оновлення чату:', error);
        return NextResponse.json(
            { error: 'Помилка сервера' },
            { status: 500 }
        );
    }
}
