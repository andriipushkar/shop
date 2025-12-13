import { NextRequest, NextResponse } from 'next/server';
import { metricsCalculator } from '@/lib/analytics/metrics';

/**
 * GET /api/admin/analytics
 * Отримання загальної аналітики
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate та endDate є обов\'язковими параметрами' },
        { status: 400 }
      );
    }

    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    // TODO: Замінити на реальні дані з бази даних
    // Це приклад даних для демонстрації
    const mockOrders = generateMockOrders(dateRange);
    const mockSessions = generateMockSessions(dateRange);
    const mockEvents = generateMockEvents(dateRange);

    // Розрахунок метрик
    const revenue = metricsCalculator.calculateRevenue(mockOrders, dateRange);
    const conversion = metricsCalculator.calculateConversion(mockSessions, mockOrders);
    const orderMetrics = metricsCalculator.calculateAverageOrderValue(mockOrders);
    const cartMetrics = metricsCalculator.calculateCartAbandonment(mockEvents);
    const topProducts = metricsCalculator.calculateTopProducts(mockEvents, mockOrders, 10);
    const trafficSources = metricsCalculator.calculateTrafficSources(mockSessions, mockOrders);
    const dailyMetrics = metricsCalculator.calculateDailyMetrics(mockOrders, mockSessions, 30);
    const categoryPerformance = metricsCalculator.calculateCategoryPerformance(mockOrders);

    return NextResponse.json({
      revenue,
      conversion,
      orderMetrics,
      cartMetrics,
      topProducts,
      trafficSources,
      dailyMetrics,
      categoryPerformance,
      dateRange: {
        startDate: startDate,
        endDate: endDate,
      },
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні аналітики' },
      { status: 500 }
    );
  }
}

// Генерація демо-даних для замовлень
function generateMockOrders(dateRange: { startDate: Date; endDate: Date }) {
  const orders = [];
  const daysDiff = Math.ceil(
    (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  for (let i = 0; i < daysDiff * 5; i++) {
    const randomDate = new Date(
      dateRange.startDate.getTime() +
        Math.random() * (dateRange.endDate.getTime() - dateRange.startDate.getTime())
    );

    orders.push({
      id: `order-${i}`,
      userId: `user-${Math.floor(Math.random() * 100)}`,
      sessionId: `session-${Math.floor(Math.random() * 200)}`,
      total: Math.floor(Math.random() * 5000) + 500,
      status: ['completed', 'pending', 'processing', 'cancelled'][
        Math.floor(Math.random() * 4)
      ],
      createdAt: randomDate.toISOString(),
      items: [
        {
          productId: `product-${Math.floor(Math.random() * 50)}`,
          productName: `Товар ${Math.floor(Math.random() * 50)}`,
          price: Math.floor(Math.random() * 1000) + 100,
          quantity: Math.floor(Math.random() * 3) + 1,
          category: ['Електроніка', 'Одяг', 'Книги', 'Спорт', 'Дім'][
            Math.floor(Math.random() * 5)
          ],
        },
      ],
    });
  }

  return orders;
}

// Генерація демо-даних для сесій
function generateMockSessions(dateRange: { startDate: Date; endDate: Date }) {
  const sessions = [];
  const daysDiff = Math.ceil(
    (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const referrers = [
    'https://google.com',
    'https://facebook.com',
    'https://instagram.com',
    '',
    'https://twitter.com',
  ];

  for (let i = 0; i < daysDiff * 20; i++) {
    const randomDate = new Date(
      dateRange.startDate.getTime() +
        Math.random() * (dateRange.endDate.getTime() - dateRange.startDate.getTime())
    );

    sessions.push({
      sessionId: `session-${i}`,
      userId: Math.random() > 0.3 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
      startTime: randomDate.toISOString(),
      lastActivity: new Date(randomDate.getTime() + Math.random() * 3600000).toISOString(),
      referrer: referrers[Math.floor(Math.random() * referrers.length)],
      landingPage: '/',
    });
  }

  return sessions;
}

// Генерація демо-даних для подій
function generateMockEvents(dateRange: { startDate: Date; endDate: Date }) {
  const events = [];
  const daysDiff = Math.ceil(
    (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const eventTypes = ['product_view', 'add_to_cart', 'remove_from_cart', 'checkout_start'];

  for (let i = 0; i < daysDiff * 50; i++) {
    const randomDate = new Date(
      dateRange.startDate.getTime() +
        Math.random() * (dateRange.endDate.getTime() - dateRange.startDate.getTime())
    );

    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

    events.push({
      eventType,
      sessionId: `session-${Math.floor(Math.random() * 200)}`,
      userId: Math.random() > 0.3 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
      timestamp: randomDate.toISOString(),
      data: {
        productId: `product-${Math.floor(Math.random() * 50)}`,
        productName: `Товар ${Math.floor(Math.random() * 50)}`,
        price: Math.floor(Math.random() * 1000) + 100,
        quantity: Math.floor(Math.random() * 3) + 1,
        category: ['Електроніка', 'Одяг', 'Книги', 'Спорт', 'Дім'][
          Math.floor(Math.random() * 5)
        ],
      },
    });
  }

  return events;
}
