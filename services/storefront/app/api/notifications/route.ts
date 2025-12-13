import { NextRequest, NextResponse } from 'next/server';

// This is a mock implementation. In production, you would:
// 1. Verify the user's session/authentication
// 2. Store notifications in your database
// 3. Fetch user-specific notifications

interface Notification {
    id: string;
    type: 'order_status' | 'price_drop' | 'back_in_stock' | 'promotion';
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
    data?: {
        orderId?: string;
        productId?: string;
        promoCode?: string;
        actionUrl?: string;
    };
    icon?: string;
}

// In-memory storage for demo purposes
// In production, use a database
const userNotifications = new Map<string, Notification[]>();

// Mock notifications for demo
const generateMockNotifications = (): Notification[] => [
    {
        id: '1',
        type: 'order_status',
        title: 'Замовлення #12345 відправлено',
        message: 'Ваше замовлення було відправлено та буде доставлено протягом 2-3 днів',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
        data: { orderId: '12345' },
    },
    {
        id: '2',
        type: 'price_drop',
        title: 'Ціна знизилась на 15%!',
        message: 'Товар "Смартфон Samsung Galaxy S23" тепер коштує 18999 ₴',
        read: false,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        data: { productId: 'samsung-s23' },
    },
    {
        id: '3',
        type: 'back_in_stock',
        title: 'Товар знову в наявності!',
        message: 'Навушники Sony WH-1000XM5 знову доступні для замовлення',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        data: { productId: 'sony-wh1000xm5' },
    },
    {
        id: '4',
        type: 'promotion',
        title: 'Спеціальна пропозиція!',
        message: 'Знижка 20% на всю електроніку. Промокод: TECH20',
        read: true,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        data: { promoCode: 'TECH20', actionUrl: '/sale' },
    },
];

export async function GET(request: NextRequest) {
    try {
        // TODO: Get user ID from session
        // const session = await getServerSession();
        // const userId = session?.user?.id;
        const userId = 'mock-user-id'; // Mock for now

        // Fetch notifications from database
        // In production:
        // const notifications = await db.notification.findMany({
        //     where: { userId },
        //     orderBy: { createdAt: 'desc' },
        // });

        // For demo, return mock notifications
        let notifications = userNotifications.get(userId);
        if (!notifications) {
            notifications = generateMockNotifications();
            userNotifications.set(userId, notifications);
        }

        return NextResponse.json({
            notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            { error: 'Помилка при завантаженні сповіщень' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { notificationId, read } = await request.json();

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        // TODO: Get user ID from session
        // const session = await getServerSession();
        // const userId = session?.user?.id;
        const userId = 'mock-user-id'; // Mock for now

        // Update notification in database
        // In production:
        // await db.notification.update({
        //     where: { id: notificationId, userId },
        //     data: { read },
        // });

        // For demo, update in memory
        const notifications = userNotifications.get(userId);
        if (notifications) {
            const notification = notifications.find((n) => n.id === notificationId);
            if (notification) {
                notification.read = read;
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Статус сповіщення оновлено',
        });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json(
            { error: 'Помилка при оновленні сповіщення' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const notificationId = searchParams.get('id');

        if (!notificationId) {
            return NextResponse.json(
                { error: 'Notification ID is required' },
                { status: 400 }
            );
        }

        // TODO: Get user ID from session
        // const session = await getServerSession();
        // const userId = session?.user?.id;
        const userId = 'mock-user-id'; // Mock for now

        // Delete notification from database
        // In production:
        // await db.notification.delete({
        //     where: { id: notificationId, userId },
        // });

        // For demo, delete from memory
        const notifications = userNotifications.get(userId);
        if (notifications) {
            const index = notifications.findIndex((n) => n.id === notificationId);
            if (index !== -1) {
                notifications.splice(index, 1);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Сповіщення видалено',
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json(
            { error: 'Помилка при видаленні сповіщення' },
            { status: 500 }
        );
    }
}
