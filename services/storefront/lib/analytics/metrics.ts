/**
 * Розрахунок метрик для аналітики
 */

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface RevenueMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  total: number;
  trend: number; // відсоток зміни порівняно з попереднім періодом
}

export interface ConversionMetrics {
  rate: number; // відсоток конверсії
  sessions: number; // всього сесій
  conversions: number; // всього конверсій (покупок)
}

export interface OrderMetrics {
  total: number; // всього замовлень
  averageValue: number; // середня вартість замовлення (AOV)
  totalRevenue: number; // загальний дохід
}

export interface CartMetrics {
  abandonment: number; // відсоток покинутих кошиків
  cartsCreated: number; // всього створено кошиків
  cartsCompleted: number; // всього завершено покупок
}

export interface ProductMetrics {
  productId: string;
  productName: string;
  views: number;
  addedToCart: number;
  purchased: number;
  revenue: number;
  conversionRate: number;
}

export interface TrafficSource {
  source: string;
  sessions: number;
  conversions: number;
  revenue: number;
  percentage: number;
}

export interface RetentionMetrics {
  period: string; // день, тиждень, місяць
  newUsers: number;
  returningUsers: number;
  retentionRate: number; // відсоток повернення
}

export interface CustomerLifetimeValue {
  userId: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  firstOrderDate: Date;
  lastOrderDate: Date;
  daysSinceLastOrder: number;
}

export interface CohortData {
  cohort: string; // місяць реєстрації
  users: number;
  retention: { [period: string]: number }; // відсоток користувачів, що повернулись
}

export interface RFMSegment {
  segment: string;
  recency: number; // 1-5 (5 - найкращі)
  frequency: number; // 1-5
  monetary: number; // 1-5
  userCount: number;
}

export interface DailyMetrics {
  date: string;
  revenue: number;
  orders: number;
  visitors: number;
  conversions: number;
  averageOrderValue: number;
}

export interface CategoryPerformance {
  category: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export interface GeographicData {
  country: string;
  city?: string;
  sessions: number;
  revenue: number;
  orders: number;
}

class MetricsCalculator {
  /**
   * Розрахунок доходу за період
   */
  calculateRevenue(orders: any[], dateRange: DateRange): RevenueMetrics {
    const { startDate, endDate } = dateRange;
    const now = new Date();

    // Фільтруємо замовлення за поточний період
    const currentOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });

    const total = currentOrders.reduce((sum, order) => sum + order.total, 0);

    // Розрахунок денного доходу
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const daily = currentOrders
      .filter(order => new Date(order.createdAt) >= oneDayAgo)
      .reduce((sum, order) => sum + order.total, 0);

    // Розрахунок тижневого доходу
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekly = currentOrders
      .filter(order => new Date(order.createdAt) >= oneWeekAgo)
      .reduce((sum, order) => sum + order.total, 0);

    // Розрахунок місячного доходу
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthly = currentOrders
      .filter(order => new Date(order.createdAt) >= oneMonthAgo)
      .reduce((sum, order) => sum + order.total, 0);

    // Розрахунок тренду (порівняння з попереднім періодом)
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= previousStartDate && orderDate < startDate;
    });
    const previousTotal = previousOrders.reduce((sum, order) => sum + order.total, 0);
    const trend = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

    return { daily, weekly, monthly, total, trend };
  }

  /**
   * Розрахунок конверсії
   */
  calculateConversion(sessions: any[], orders: any[]): ConversionMetrics {
    const totalSessions = sessions.length;
    const conversions = orders.length;
    const rate = totalSessions > 0 ? (conversions / totalSessions) * 100 : 0;

    return {
      rate,
      sessions: totalSessions,
      conversions,
    };
  }

  /**
   * Розрахунок середньої вартості замовлення (AOV)
   */
  calculateAverageOrderValue(orders: any[]): OrderMetrics {
    const total = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const averageValue = total > 0 ? totalRevenue / total : 0;

    return {
      total,
      averageValue,
      totalRevenue,
    };
  }

  /**
   * Розрахунок відсотку покинутих кошиків
   */
  calculateCartAbandonment(events: any[]): CartMetrics {
    const addToCartEvents = events.filter(e => e.eventType === 'add_to_cart');
    const checkoutStartEvents = events.filter(e => e.eventType === 'checkout_start');
    const purchaseEvents = events.filter(e => e.eventType === 'purchase');

    // Унікальні сесії з товарами в кошику
    const cartsCreated = new Set(addToCartEvents.map(e => e.sessionId)).size;
    const cartsCompleted = purchaseEvents.length;
    const abandonment = cartsCreated > 0
      ? ((cartsCreated - cartsCompleted) / cartsCreated) * 100
      : 0;

    return {
      abandonment,
      cartsCreated,
      cartsCompleted,
    };
  }

  /**
   * Розрахунок топ-продуктів
   */
  calculateTopProducts(events: any[], orders: any[], limit: number = 10): ProductMetrics[] {
    const productStats = new Map<string, ProductMetrics>();

    // Підрахунок переглядів
    events
      .filter(e => e.eventType === 'product_view')
      .forEach(event => {
        const { productId, productName } = event.data;
        if (!productStats.has(productId)) {
          productStats.set(productId, {
            productId,
            productName,
            views: 0,
            addedToCart: 0,
            purchased: 0,
            revenue: 0,
            conversionRate: 0,
          });
        }
        productStats.get(productId)!.views++;
      });

    // Підрахунок додавань до кошика
    events
      .filter(e => e.eventType === 'add_to_cart')
      .forEach(event => {
        const { productId, productName } = event.data;
        if (!productStats.has(productId)) {
          productStats.set(productId, {
            productId,
            productName,
            views: 0,
            addedToCart: 0,
            purchased: 0,
            revenue: 0,
            conversionRate: 0,
          });
        }
        productStats.get(productId)!.addedToCart++;
      });

    // Підрахунок покупок та доходу
    orders.forEach(order => {
      order.items?.forEach((item: any) => {
        const { productId, productName, price, quantity } = item;
        if (!productStats.has(productId)) {
          productStats.set(productId, {
            productId,
            productName: productName || 'Unknown',
            views: 0,
            addedToCart: 0,
            purchased: 0,
            revenue: 0,
            conversionRate: 0,
          });
        }
        const stats = productStats.get(productId)!;
        stats.purchased += quantity;
        stats.revenue += price * quantity;
      });
    });

    // Розрахунок конверсії
    productStats.forEach(stats => {
      stats.conversionRate = stats.views > 0 ? (stats.purchased / stats.views) * 100 : 0;
    });

    return Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Розрахунок джерел трафіку
   */
  calculateTrafficSources(sessions: any[], orders: any[]): TrafficSource[] {
    const sourcesMap = new Map<string, TrafficSource>();
    const totalSessions = sessions.length;

    sessions.forEach(session => {
      const source = this.extractSource(session.referrer) || 'Прямий перехід';

      if (!sourcesMap.has(source)) {
        sourcesMap.set(source, {
          source,
          sessions: 0,
          conversions: 0,
          revenue: 0,
          percentage: 0,
        });
      }

      const sourceStats = sourcesMap.get(source)!;
      sourceStats.sessions++;

      // Підрахунок конверсій та доходу
      const sessionOrders = orders.filter(o => o.sessionId === session.sessionId);
      if (sessionOrders.length > 0) {
        sourceStats.conversions++;
        sourceStats.revenue += sessionOrders.reduce((sum, o) => sum + o.total, 0);
      }
    });

    // Розрахунок відсотків
    sourcesMap.forEach(source => {
      source.percentage = totalSessions > 0 ? (source.sessions / totalSessions) * 100 : 0;
    });

    return Array.from(sourcesMap.values()).sort((a, b) => b.sessions - a.sessions);
  }

  /**
   * Витягування джерела з referrer URL
   */
  private extractSource(referrer?: string): string | null {
    if (!referrer) return null;

    try {
      const url = new URL(referrer);
      const hostname = url.hostname;

      if (hostname.includes('google')) return 'Google';
      if (hostname.includes('facebook')) return 'Facebook';
      if (hostname.includes('instagram')) return 'Instagram';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'Twitter/X';
      if (hostname.includes('linkedin')) return 'LinkedIn';
      if (hostname.includes('youtube')) return 'YouTube';
      if (hostname.includes('tiktok')) return 'TikTok';
      if (hostname.includes('pinterest')) return 'Pinterest';

      return hostname;
    } catch {
      return 'Інше';
    }
  }

  /**
   * Розрахунок утримання користувачів
   */
  calculateRetention(users: any[], period: 'day' | 'week' | 'month'): RetentionMetrics[] {
    const now = new Date();
    const metrics: RetentionMetrics[] = [];

    const periods = this.generatePeriods(now, period, 12);

    periods.forEach(periodInfo => {
      const { start, end, label } = periodInfo;

      const newUsers = users.filter(user => {
        const createdAt = new Date(user.createdAt);
        return createdAt >= start && createdAt < end;
      });

      const returningUsers = users.filter(user => {
        const createdAt = new Date(user.createdAt);
        const lastSeen = new Date(user.lastSeenAt || user.createdAt);
        return createdAt < start && lastSeen >= start && lastSeen < end;
      });

      metrics.push({
        period: label,
        newUsers: newUsers.length,
        returningUsers: returningUsers.length,
        retentionRate: newUsers.length > 0
          ? (returningUsers.length / newUsers.length) * 100
          : 0,
      });
    });

    return metrics;
  }

  /**
   * Генерація періодів для аналізу
   */
  private generatePeriods(endDate: Date, period: 'day' | 'week' | 'month', count: number) {
    const periods = [];
    let current = new Date(endDate);

    for (let i = 0; i < count; i++) {
      let start: Date;
      let end: Date;
      let label: string;

      if (period === 'day') {
        end = new Date(current);
        start = new Date(current.getTime() - 24 * 60 * 60 * 1000);
        label = start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      } else if (period === 'week') {
        end = new Date(current);
        start = new Date(current.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`;
      } else {
        end = new Date(current);
        start = new Date(current.getFullYear(), current.getMonth() - 1, 1);
        label = start.toLocaleDateString('uk-UA', { month: 'short', year: 'numeric' });
      }

      periods.unshift({ start, end, label });
      current = start;
    }

    return periods;
  }

  /**
   * Розрахунок Customer Lifetime Value (CLV)
   */
  calculateCustomerLifetimeValue(orders: any[]): CustomerLifetimeValue[] {
    const userStats = new Map<string, CustomerLifetimeValue>();

    orders.forEach(order => {
      const userId = order.userId;
      if (!userId) return;

      if (!userStats.has(userId)) {
        userStats.set(userId, {
          userId,
          totalOrders: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          firstOrderDate: new Date(order.createdAt),
          lastOrderDate: new Date(order.createdAt),
          daysSinceLastOrder: 0,
        });
      }

      const stats = userStats.get(userId)!;
      stats.totalOrders++;
      stats.totalSpent += order.total;

      const orderDate = new Date(order.createdAt);
      if (orderDate < stats.firstOrderDate) {
        stats.firstOrderDate = orderDate;
      }
      if (orderDate > stats.lastOrderDate) {
        stats.lastOrderDate = orderDate;
      }
    });

    const now = new Date();
    userStats.forEach(stats => {
      stats.averageOrderValue = stats.totalSpent / stats.totalOrders;
      stats.daysSinceLastOrder = Math.floor(
        (now.getTime() - stats.lastOrderDate.getTime()) / (24 * 60 * 60 * 1000)
      );
    });

    return Array.from(userStats.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Когортний аналіз
   */
  calculateCohortAnalysis(users: any[], orders: any[]): CohortData[] {
    const cohorts = new Map<string, CohortData>();

    // Групування користувачів за місяцем реєстрації
    users.forEach(user => {
      const cohortDate = new Date(user.createdAt);
      const cohortKey = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;

      if (!cohorts.has(cohortKey)) {
        cohorts.set(cohortKey, {
          cohort: cohortKey,
          users: 0,
          retention: {},
        });
      }

      cohorts.get(cohortKey)!.users++;
    });

    // Розрахунок утримання для кожної когорти
    cohorts.forEach((cohortData, cohortKey) => {
      const [year, month] = cohortKey.split('-').map(Number);
      const cohortStart = new Date(year, month - 1, 1);

      for (let i = 0; i <= 12; i++) {
        const periodStart = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + i, 1);
        const periodEnd = new Date(cohortStart.getFullYear(), cohortStart.getMonth() + i + 1, 1);

        const activeUsers = users.filter(user => {
          const userCohort = new Date(user.createdAt);
          const userCohortKey = `${userCohort.getFullYear()}-${String(userCohort.getMonth() + 1).padStart(2, '0')}`;

          if (userCohortKey !== cohortKey) return false;

          // Перевіряємо, чи користувач був активний в цьому періоді
          const userOrders = orders.filter(order =>
            order.userId === user.id &&
            new Date(order.createdAt) >= periodStart &&
            new Date(order.createdAt) < periodEnd
          );

          return userOrders.length > 0;
        }).length;

        const retentionRate = cohortData.users > 0
          ? (activeUsers / cohortData.users) * 100
          : 0;

        cohortData.retention[`month_${i}`] = retentionRate;
      }
    });

    return Array.from(cohorts.values()).sort((a, b) => b.cohort.localeCompare(a.cohort));
  }

  /**
   * RFM сегментація
   */
  calculateRFMSegmentation(orders: any[]): RFMSegment[] {
    const now = new Date();
    const userRFM = new Map<string, { recency: number; frequency: number; monetary: number }>();

    // Розрахунок RFM для кожного користувача
    orders.forEach(order => {
      const userId = order.userId;
      if (!userId) return;

      if (!userRFM.has(userId)) {
        userRFM.set(userId, { recency: 0, frequency: 0, monetary: 0 });
      }

      const rfm = userRFM.get(userId)!;
      rfm.frequency++;
      rfm.monetary += order.total;

      const orderDate = new Date(order.createdAt);
      const daysSinceOrder = (now.getTime() - orderDate.getTime()) / (24 * 60 * 60 * 1000);
      if (rfm.recency === 0 || daysSinceOrder < rfm.recency) {
        rfm.recency = daysSinceOrder;
      }
    });

    // Розрахунок квінтилів
    const users = Array.from(userRFM.entries());
    const recencyValues = users.map(([_, rfm]) => rfm.recency).sort((a, b) => a - b);
    const frequencyValues = users.map(([_, rfm]) => rfm.frequency).sort((a, b) => b - a);
    const monetaryValues = users.map(([_, rfm]) => rfm.monetary).sort((a, b) => b - a);

    const getScore = (value: number, values: number[], reverse = false) => {
      const quintileSize = Math.ceil(values.length / 5);
      const index = values.indexOf(value);
      const score = Math.ceil((index + 1) / quintileSize);
      return reverse ? score : 6 - score;
    };

    // Присвоєння балів та сегментація
    const segments = new Map<string, number>();

    users.forEach(([userId, rfm]) => {
      const r = getScore(rfm.recency, recencyValues);
      const f = getScore(rfm.frequency, frequencyValues, true);
      const m = getScore(rfm.monetary, monetaryValues, true);

      const segment = this.getRFMSegment(r, f, m);
      segments.set(segment, (segments.get(segment) || 0) + 1);
    });

    const result: RFMSegment[] = [];
    segments.forEach((count, segment) => {
      // Отримуємо середні значення для сегменту
      const segmentUsers = users.filter(([_, rfm]) => {
        const r = getScore(rfm.recency, recencyValues);
        const f = getScore(rfm.frequency, frequencyValues, true);
        const m = getScore(rfm.monetary, monetaryValues, true);
        return this.getRFMSegment(r, f, m) === segment;
      });

      const avgR = segmentUsers.reduce((sum, [_, rfm]) =>
        sum + getScore(rfm.recency, recencyValues), 0) / segmentUsers.length;
      const avgF = segmentUsers.reduce((sum, [_, rfm]) =>
        sum + getScore(rfm.frequency, frequencyValues, true), 0) / segmentUsers.length;
      const avgM = segmentUsers.reduce((sum, [_, rfm]) =>
        sum + getScore(rfm.monetary, monetaryValues, true), 0) / segmentUsers.length;

      result.push({
        segment,
        recency: Math.round(avgR),
        frequency: Math.round(avgF),
        monetary: Math.round(avgM),
        userCount: count,
      });
    });

    return result.sort((a, b) => b.userCount - a.userCount);
  }

  /**
   * Визначення RFM сегменту
   */
  private getRFMSegment(r: number, f: number, m: number): string {
    if (r >= 4 && f >= 4 && m >= 4) return 'Чемпіони';
    if (r >= 3 && f >= 3 && m >= 3) return 'Лояльні';
    if (r >= 4 && f <= 2) return 'Нові';
    if (r >= 3 && f >= 3 && m <= 2) return 'Потенційні';
    if (r <= 2 && f >= 4 && m >= 4) return 'Під ризиком';
    if (r <= 2 && f >= 3) return 'Потребують уваги';
    if (r <= 2 && f <= 2) return 'Втрачені';
    if (r >= 3 && f <= 2 && m <= 2) return 'Перспективні';
    return 'Інші';
  }

  /**
   * Розрахунок денних метрик
   */
  calculateDailyMetrics(orders: any[], sessions: any[], days: number = 30): DailyMetrics[] {
    const metrics: DailyMetrics[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= date && orderDate < nextDate;
      });

      const daySessions = sessions.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= date && sessionDate < nextDate;
      });

      const revenue = dayOrders.reduce((sum, order) => sum + order.total, 0);
      const ordersCount = dayOrders.length;
      const visitors = daySessions.length;
      const conversions = ordersCount;
      const averageOrderValue = ordersCount > 0 ? revenue / ordersCount : 0;

      metrics.push({
        date: dateStr,
        revenue,
        orders: ordersCount,
        visitors,
        conversions,
        averageOrderValue,
      });
    }

    return metrics;
  }

  /**
   * Розрахунок ефективності категорій
   */
  calculateCategoryPerformance(orders: any[]): CategoryPerformance[] {
    const categoryStats = new Map<string, { revenue: number; orders: number }>();
    let totalRevenue = 0;

    orders.forEach(order => {
      order.items?.forEach((item: any) => {
        const category = item.category || 'Без категорії';
        const itemRevenue = item.price * item.quantity;

        if (!categoryStats.has(category)) {
          categoryStats.set(category, { revenue: 0, orders: 0 });
        }

        const stats = categoryStats.get(category)!;
        stats.revenue += itemRevenue;
        stats.orders++;
        totalRevenue += itemRevenue;
      });
    });

    return Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category,
        revenue: stats.revenue,
        orders: stats.orders,
        percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }
}

export const metricsCalculator = new MetricsCalculator();
