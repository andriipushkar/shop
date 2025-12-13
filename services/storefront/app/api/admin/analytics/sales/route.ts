import { NextRequest, NextResponse } from 'next/server';
import { metricsCalculator } from '@/lib/analytics/metrics';

/**
 * GET /api/admin/analytics/sales
 * Отримання аналітики продажів
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
    const mockOrders = generateMockOrders(dateRange);
    const mockEvents = generateMockEvents(dateRange);

    // Розрахунок метрик продажів
    const revenue = metricsCalculator.calculateRevenue(mockOrders, dateRange);
    const orderMetrics = metricsCalculator.calculateAverageOrderValue(mockOrders);
    const topProducts = metricsCalculator.calculateTopProducts(mockEvents, mockOrders, 20);
    const categoryPerformance = metricsCalculator.calculateCategoryPerformance(mockOrders);
    const dailyMetrics = metricsCalculator.calculateDailyMetrics(
      mockOrders,
      [],
      Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Географічний розподіл (демо дані)
    const geographicDistribution = [
      { country: 'Україна', city: 'Київ', sessions: 1250, revenue: 125000, orders: 85 },
      { country: 'Україна', city: 'Львів', sessions: 850, revenue: 82000, orders: 62 },
      { country: 'Україна', city: 'Одеса', sessions: 620, revenue: 58000, orders: 45 },
      { country: 'Україна', city: 'Харків', sessions: 580, revenue: 54000, orders: 41 },
      { country: 'Україна', city: 'Дніпро', sessions: 450, revenue: 41000, orders: 32 },
    ];

    // Статус замовлень
    const ordersByStatus = mockOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      revenue,
      orderMetrics,
      topProducts,
      categoryPerformance,
      dailyMetrics,
      geographicDistribution,
      ordersByStatus,
      dateRange: {
        startDate: startDate,
        endDate: endDate,
      },
    });
  } catch (error) {
    console.error('Sales analytics API error:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні аналітики продажів' },
      { status: 500 }
    );
  }
}

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
