import { NextRequest, NextResponse } from 'next/server';
import { metricsCalculator } from '@/lib/analytics/metrics';

/**
 * GET /api/admin/analytics/customers
 * Отримання аналітики клієнтів
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
    const mockUsers = generateMockUsers();

    // Розрахунок метрик клієнтів
    const customerLifetimeValue = metricsCalculator.calculateCustomerLifetimeValue(mockOrders);
    const cohortAnalysis = metricsCalculator.calculateCohortAnalysis(mockUsers, mockOrders);
    const rfmSegmentation = metricsCalculator.calculateRFMSegmentation(mockOrders);
    const retention = metricsCalculator.calculateRetention(mockUsers, 'month');

    // Нові vs повторні клієнти
    const newVsReturning = calculateNewVsReturning(mockOrders);

    return NextResponse.json({
      customerLifetimeValue: customerLifetimeValue.slice(0, 100), // топ 100
      cohortAnalysis,
      rfmSegmentation,
      retention,
      newVsReturning,
      dateRange: {
        startDate: startDate,
        endDate: endDate,
      },
    });
  } catch (error) {
    console.error('Customer analytics API error:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні аналітики клієнтів' },
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
      total: Math.floor(Math.random() * 5000) + 500,
      createdAt: randomDate.toISOString(),
      items: [
        {
          productId: `product-${Math.floor(Math.random() * 50)}`,
          productName: `Товар ${Math.floor(Math.random() * 50)}`,
          price: Math.floor(Math.random() * 1000) + 100,
          quantity: Math.floor(Math.random() * 3) + 1,
        },
      ],
    });
  }

  return orders;
}

function generateMockUsers() {
  const users = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const createdDate = new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000);
    const lastSeen = new Date(
      createdDate.getTime() + Math.random() * (now.getTime() - createdDate.getTime())
    );

    users.push({
      id: `user-${i}`,
      email: `user${i}@example.com`,
      createdAt: createdDate.toISOString(),
      lastSeenAt: lastSeen.toISOString(),
    });
  }

  return users;
}

function calculateNewVsReturning(orders: any[]) {
  const userFirstOrder = new Map<string, Date>();
  let newCustomers = 0;
  let returningCustomers = 0;

  orders.forEach((order) => {
    const userId = order.userId;
    const orderDate = new Date(order.createdAt);

    if (!userFirstOrder.has(userId)) {
      userFirstOrder.set(userId, orderDate);
      newCustomers++;
    } else {
      const firstOrderDate = userFirstOrder.get(userId)!;
      if (orderDate > firstOrderDate) {
        returningCustomers++;
      }
    }
  });

  const total = newCustomers + returningCustomers;
  return {
    new: newCustomers,
    returning: returningCustomers,
    newPercentage: total > 0 ? (newCustomers / total) * 100 : 0,
    returningPercentage: total > 0 ? (returningCustomers / total) * 100 : 0,
  };
}
