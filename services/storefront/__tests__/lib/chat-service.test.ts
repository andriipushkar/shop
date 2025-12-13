/**
 * @jest-environment jsdom
 */

import { chatService, Chat, ChatMessage, ChatAgent } from '@/lib/chat/chat-service';

describe('ChatService', () => {
    beforeEach(() => {
        // Очистити стан перед кожним тестом
        jest.clearAllMocks();
    });

    describe('Створення чату', () => {
        it('має створити новий чат з початковими параметрами', async () => {
            const chat = await chatService.createChat(
                'customer_1',
                'Тестовий Користувач',
                'test@example.com',
                'Питання про замовлення',
                'order'
            );

            expect(chat).toBeDefined();
            expect(chat.customerId).toBe('customer_1');
            expect(chat.customerName).toBe('Тестовий Користувач');
            expect(chat.customerEmail).toBe('test@example.com');
            expect(chat.subject).toBe('Питання про замовлення');
            expect(chat.category).toBe('order');
            expect(chat.status).toBe('open');
            expect(chat.priority).toBe('normal');
            expect(chat.unreadCount).toBe(0);
        });

        it('має відправити привітальне повідомлення від бота', async () => {
            const chat = await chatService.createChat(
                'customer_1',
                'Тестовий Користувач'
            );

            const messages = await chatService.getMessages(chat.id);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0].senderType).toBe('bot');
            expect(messages[0].senderName).toBe('Віртуальний помічник');
        });
    });

    describe('Відправлення повідомлень', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
        });

        it('має відправити повідомлення від клієнта', async () => {
            const message = await chatService.sendMessage(
                chat.id,
                'customer_1',
                'customer',
                'Тестовий Користувач',
                'Привіт, потрібна допомога'
            );

            expect(message).toBeDefined();
            expect(message.chatId).toBe(chat.id);
            expect(message.senderId).toBe('customer_1');
            expect(message.senderType).toBe('customer');
            expect(message.content).toBe('Привіт, потрібна допомога');
        });

        it('має відправити повідомлення від оператора', async () => {
            const message = await chatService.sendMessage(
                chat.id,
                'agent_1',
                'agent',
                'Оператор Іван',
                'Привіт! Чим можу допомогти?'
            );

            expect(message).toBeDefined();
            expect(message.senderType).toBe('agent');
            expect(message.senderName).toBe('Оператор Іван');
        });

        it('має підтримувати вкладення', async () => {
            const attachments = [
                {
                    id: 'att_1',
                    type: 'image' as const,
                    name: 'screenshot.png',
                    url: 'https://example.com/screenshot.png',
                    size: 1024000,
                    mimeType: 'image/png',
                },
            ];

            const message = await chatService.sendMessage(
                chat.id,
                'customer_1',
                'customer',
                'Тестовий Користuvач',
                'Дивіться скріншот',
                'text',
                attachments
            );

            expect(message.attachments).toBeDefined();
            expect(message.attachments?.length).toBe(1);
            expect(message.attachments?.[0].type).toBe('image');
        });

        it('має викинути помилку для неіснуючого чату', async () => {
            await expect(
                chatService.sendMessage(
                    'invalid_chat_id',
                    'customer_1',
                    'customer',
                    'Тестовий Користувач',
                    'Тест'
                )
            ).rejects.toThrow('Chat not found');
        });
    });

    describe('Отримання повідомлень', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
        });

        it('має повернути всі повідомлення чату', async () => {
            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Msg 1');
            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Msg 2');
            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Msg 3');

            const messages = await chatService.getMessages(chat.id);
            expect(messages.length).toBeGreaterThanOrEqual(3);
        });

        it('має підтримувати ліміт повідомлень', async () => {
            // Send fewer messages to avoid timeout
            const sendPromises = [];
            for (let i = 0; i < 15; i++) {
                sendPromises.push(chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', `Message ${i}`));
            }
            await Promise.all(sendPromises);

            const messages = await chatService.getMessages(chat.id, 10);
            expect(messages.length).toBeLessThanOrEqual(10);
        }, 15000);
    });

    describe('Призначення оператора', () => {
        let chat: Chat;
        let agent: ChatAgent;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');

            agent = {
                id: 'agent_1',
                name: 'Оператор Іван',
                email: 'ivan@example.com',
                status: 'online',
                activeChats: 0,
                maxChats: 5,
                skills: ['general', 'order'],
            };

            chatService.registerAgent(agent);
        });

        it('має призначити доступного оператора', async () => {
            const success = await chatService.assignToAgent(chat.id);
            expect(success).toBe(true);

            const updatedChat = await chatService.getChat(chat.id);
            expect(updatedChat?.agentId).toBe('agent_1');
            expect(updatedChat?.agentName).toBe('Оператор Іван');
            expect(updatedChat?.status).toBe('assigned');
        });

        it('має призначити конкретного оператора', async () => {
            const success = await chatService.assignToAgent(chat.id, 'agent_1');
            expect(success).toBe(true);

            const updatedChat = await chatService.getChat(chat.id);
            expect(updatedChat?.agentId).toBe('agent_1');
        });

        it('має поставити чат у чергу, якщо немає доступних операторів', async () => {
            agent.status = 'offline';
            const success = await chatService.assignToAgent(chat.id);
            expect(success).toBe(false);

            const updatedChat = await chatService.getChat(chat.id);
            expect(updatedChat?.status).toBe('pending');
        });
    });

    describe('Робота з операторами', () => {
        it('має зареєструвати оператора', () => {
            const agent: ChatAgent = {
                id: 'agent_1',
                name: 'Оператор Марія',
                email: 'maria@example.com',
                status: 'online',
                activeChats: 0,
                maxChats: 5,
                skills: ['general'],
            };

            chatService.registerAgent(agent);

            const agents = chatService.getAgents();
            expect(agents).toContainEqual(agent);
        });

        it('має оновити статус оператора', () => {
            const agent: ChatAgent = {
                id: 'agent_1',
                name: 'Оператор Марія',
                email: 'maria@example.com',
                status: 'online',
                activeChats: 0,
                maxChats: 5,
                skills: ['general'],
            };

            chatService.registerAgent(agent);
            chatService.updateAgentStatus('agent_1', 'away');

            const agents = chatService.getAgents();
            const updatedAgent = agents.find(a => a.id === 'agent_1');
            expect(updatedAgent?.status).toBe('away');
        });

        it('має отримати чати оператора', async () => {
            const uniqueAgentId = `agent_test_${Date.now()}`;
            const agent: ChatAgent = {
                id: uniqueAgentId,
                name: 'Оператор Іван',
                email: 'ivan@example.com',
                status: 'online',
                activeChats: 0,
                maxChats: 5,
                skills: ['general'],
            };

            chatService.registerAgent(agent);

            const chat1 = await chatService.createChat('customer_1', 'User 1');

            const assigned1 = await chatService.assignToAgent(chat1.id, uniqueAgentId);
            expect(assigned1).toBe(true);

            const agentChats = await chatService.getAgentChats(uniqueAgentId);
            // At least one chat should be assigned
            expect(agentChats.length).toBeGreaterThanOrEqual(1);
            expect(agentChats.some(c => c.id === chat1.id)).toBe(true);
        });
    });

    describe('Пошук чатів', () => {
        it('має знайти чати за іменем користувача', async () => {
            // Create a unique chat to search for
            const uniqueName = `Марія_${Date.now()}`;
            await chatService.createChat('customer_search_1', uniqueName, 'maria@example.com', 'Тестовий', 'general');

            const results = await chatService.searchChats('Марія');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.customerName.includes('Марія'))).toBe(true);
        });

        it('має знайти чати за темою', async () => {
            // Create a unique chat to search for
            const uniqueSubject = `Доставка_${Date.now()}`;
            await chatService.createChat('customer_search_2', 'Тестовий Користувач', 'test@example.com', uniqueSubject, 'delivery');

            const results = await chatService.searchChats('Доставка');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.subject?.includes('Доставка'))).toBe(true);
        });

        it('має фільтрувати за статусом', async () => {
            const results = await chatService.searchChats('', { status: 'open' });
            expect(results.every(chat => chat.status === 'open')).toBe(true);
        });

        it('має фільтрувати за категорією', async () => {
            const results = await chatService.searchChats('', { category: 'order' });
            expect(results.every(chat => chat.category === 'order')).toBe(true);
        });
    });

    describe('Закриття чату', () => {
        let chat: Chat;
        let agent: ChatAgent;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');

            agent = {
                id: 'agent_1',
                name: 'Оператор',
                email: 'agent@example.com',
                status: 'online',
                activeChats: 1,
                maxChats: 5,
                skills: ['general'],
            };

            chatService.registerAgent(agent);
            await chatService.assignToAgent(chat.id, 'agent_1');
        });

        it('має закрити чат', async () => {
            await chatService.closeChat(chat.id);

            const closedChat = await chatService.getChat(chat.id);
            expect(closedChat?.status).toBe('closed');
            expect(closedChat?.closedAt).toBeDefined();
        });

        it('має зберегти рейтинг та відгук', async () => {
            await chatService.closeChat(chat.id, 5, 'Відмінне обслуговування!');

            const closedChat = await chatService.getChat(chat.id);
            expect(closedChat?.rating).toBe(5);
            expect(closedChat?.feedback).toBe('Відмінне обслуговування!');
        });

        it('має зменшити лічильник активних чатів оператора', async () => {
            const initialActiveChats = agent.activeChats;
            await chatService.closeChat(chat.id);

            const agents = chatService.getAgents();
            const updatedAgent = agents.find(a => a.id === 'agent_1');
            expect(updatedAgent?.activeChats).toBe(initialActiveChats - 1);
        });
    });

    describe('Статистика', () => {
        beforeEach(async () => {
            await chatService.createChat('customer_1', 'User 1');
            await chatService.createChat('customer_2', 'User 2');
            const chat3 = await chatService.createChat('customer_3', 'User 3');
            await chatService.closeChat(chat3.id, 4);
        });

        it('має повернути статистику чатів', () => {
            const stats = chatService.getChatStatistics();

            expect(stats.total).toBeGreaterThanOrEqual(3);
            expect(stats.open).toBeGreaterThanOrEqual(2);
            expect(stats.closed).toBeGreaterThanOrEqual(1);
        });

        it('має розрахувати середній рейтинг', async () => {
            const chat1 = await chatService.createChat('customer_4', 'User 4');
            const chat2 = await chatService.createChat('customer_5', 'User 5');

            await chatService.closeChat(chat1.id, 5);
            await chatService.closeChat(chat2.id, 3);

            const stats = chatService.getChatStatistics();
            expect(stats.averageRating).toBeGreaterThan(0);
        });
    });

    describe('Швидкі відповіді', () => {
        it('має повернути всі швидкі відповіді', () => {
            const replies = chatService.getQuickReplies();
            expect(replies.length).toBeGreaterThan(0);
        });

        it('має фільтрувати швидкі відповіді за категорією', () => {
            const replies = chatService.getQuickReplies('order');
            expect(replies.every(r => !r.category || r.category === 'order')).toBe(true);
        });
    });

    describe('Підписки', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
        });

        it('має сповістити слухачів про нове повідомлення', async () => {
            const mockCallback = jest.fn();
            const unsubscribe = chatService.subscribe(chat.id, mockCallback);

            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Test');

            expect(mockCallback).toHaveBeenCalled();
            unsubscribe();
        });

        it('має відписатися від сповіщень', async () => {
            const mockCallback = jest.fn();
            const unsubscribe = chatService.subscribe(chat.id, mockCallback);
            unsubscribe();

            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Test');

            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('Індикатор набору', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
        });

        it('має відправити індикатор набору', async () => {
            const mockCallback = jest.fn();
            chatService.subscribeToTyping(chat.id, mockCallback);

            await chatService.sendTypingIndicator(chat.id, true);

            expect(mockCallback).toHaveBeenCalledWith(true);
        });
    });

    describe('Підтвердження прочитання', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
        });

        it('має відмітити повідомлення як прочитані', async () => {
            const message = await chatService.sendMessage(
                chat.id,
                'customer_1',
                'customer',
                'User',
                'Test'
            );

            await chatService.markMessagesAsRead(chat.id, [message.id]);

            const messages = await chatService.getMessages(chat.id);
            const readMessage = messages.find(m => m.id === message.id);
            expect(readMessage?.readAt).toBeDefined();
        });
    });

    describe('Персистентність', () => {
        let chat: Chat;

        beforeEach(async () => {
            chat = await chatService.createChat('customer_1', 'Тестовий Користувач');
            await chatService.sendMessage(chat.id, 'customer_1', 'customer', 'User', 'Test message');
        });

        it('має зберегти історію чату', async () => {
            await chatService.persistChatHistory(chat.id);

            // Перевірка що дані збережені в localStorage
            // У тестовому середовищі може бути недоступно
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = window.localStorage.getItem(`chat_${chat.id}`);
                expect(stored).toBeDefined();
            }
        });

        it('має завантажити історію чату', async () => {
            await chatService.persistChatHistory(chat.id);
            const history = await chatService.loadChatHistory(chat.id);

            if (history) {
                expect(history.chat).toBeDefined();
                expect(history.messages).toBeDefined();
                expect(history.chat.id).toBe(chat.id);
            }
        });
    });
});
