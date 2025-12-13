/**
 * Сервіс аналітики для відстеження подій та поведінки користувачів
 */

export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  data?: Record<string, any>;
  url: string;
  referrer?: string;
  userAgent?: string;
}

export interface PageViewEvent extends AnalyticsEvent {
  eventType: 'page_view';
  page: string;
  title: string;
}

export interface AddToCartEvent extends AnalyticsEvent {
  eventType: 'add_to_cart';
  data: {
    productId: string;
    productName: string;
    price: number;
    quantity: number;
    category?: string;
  };
}

export interface PurchaseEvent extends AnalyticsEvent {
  eventType: 'purchase';
  data: {
    orderId: string;
    total: number;
    items: Array<{
      productId: string;
      productName: string;
      price: number;
      quantity: number;
    }>;
    paymentMethod: string;
  };
}

export interface RemoveFromCartEvent extends AnalyticsEvent {
  eventType: 'remove_from_cart';
  data: {
    productId: string;
    productName: string;
  };
}

export interface SearchEvent extends AnalyticsEvent {
  eventType: 'search';
  data: {
    query: string;
    resultsCount: number;
  };
}

export interface ProductViewEvent extends AnalyticsEvent {
  eventType: 'product_view';
  data: {
    productId: string;
    productName: string;
    price: number;
    category?: string;
  };
}

export interface CheckoutStartEvent extends AnalyticsEvent {
  eventType: 'checkout_start';
  data: {
    cartTotal: number;
    itemCount: number;
  };
}

export interface CheckoutCompleteEvent extends AnalyticsEvent {
  eventType: 'checkout_complete';
  data: {
    orderId: string;
    total: number;
  };
}

export interface Session {
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  events: AnalyticsEvent[];
  referrer?: string;
  landingPage: string;
  userAgent?: string;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private sessions: Map<string, Session> = new Map();
  private activeUsers: Set<string> = new Set();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 хвилин
  private readonly ACTIVE_USER_WINDOW = 5 * 60 * 1000; // 5 хвилин

  private constructor() {
    // Очистка неактивних сесій кожні 5 хвилин
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupInactiveSessions(), 5 * 60 * 1000);
      setInterval(() => this.updateActiveUsers(), 60 * 1000);
    }
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Генерація унікального ID сесії
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Отримання або створення сесії
   */
  getOrCreateSession(userId?: string, referrer?: string, userAgent?: string): Session {
    const existingSessionId = this.getCurrentSessionId();

    if (existingSessionId && this.sessions.has(existingSessionId)) {
      const session = this.sessions.get(existingSessionId)!;
      session.lastActivity = new Date();
      return session;
    }

    const sessionId = this.generateSessionId();
    const session: Session = {
      sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      events: [],
      referrer,
      landingPage: typeof window !== 'undefined' ? window.location.pathname : '/',
      userAgent,
    };

    this.sessions.set(sessionId, session);
    this.setCurrentSessionId(sessionId);

    return session;
  }

  /**
   * Зберігання ID поточної сесії
   */
  private setCurrentSessionId(sessionId: string): void {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
  }

  /**
   * Отримання ID поточної сесії
   */
  private getCurrentSessionId(): string | null {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('analytics_session_id');
    }
    return null;
  }

  /**
   * Відстеження перегляду сторінки
   */
  trackPageView(page: string, title: string, userId?: string): void {
    const session = this.getOrCreateSession(
      userId,
      typeof window !== 'undefined' ? document.referrer : undefined,
      typeof window !== 'undefined' ? navigator.userAgent : undefined
    );

    const event: PageViewEvent = {
      eventType: 'page_view',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      page,
      title,
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження додавання товару до кошика
   */
  trackAddToCart(
    productId: string,
    productName: string,
    price: number,
    quantity: number,
    category?: string,
    userId?: string
  ): void {
    const session = this.getOrCreateSession(userId);

    const event: AddToCartEvent = {
      eventType: 'add_to_cart',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        productId,
        productName,
        price,
        quantity,
        category,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження покупки
   */
  trackPurchase(
    orderId: string,
    total: number,
    items: Array<{
      productId: string;
      productName: string;
      price: number;
      quantity: number;
    }>,
    paymentMethod: string,
    userId?: string
  ): void {
    const session = this.getOrCreateSession(userId);

    const event: PurchaseEvent = {
      eventType: 'purchase',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        orderId,
        total,
        items,
        paymentMethod,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження видалення з кошика
   */
  trackRemoveFromCart(
    productId: string,
    productName: string,
    userId?: string
  ): void {
    const session = this.getOrCreateSession(userId);

    const event: RemoveFromCartEvent = {
      eventType: 'remove_from_cart',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        productId,
        productName,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження пошуку
   */
  trackSearch(query: string, resultsCount: number, userId?: string): void {
    const session = this.getOrCreateSession(userId);

    const event: SearchEvent = {
      eventType: 'search',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        query,
        resultsCount,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження перегляду товару
   */
  trackProductView(
    productId: string,
    productName: string,
    price: number,
    category?: string,
    userId?: string
  ): void {
    const session = this.getOrCreateSession(userId);

    const event: ProductViewEvent = {
      eventType: 'product_view',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        productId,
        productName,
        price,
        category,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження початку оформлення замовлення
   */
  trackCheckoutStart(cartTotal: number, itemCount: number, userId?: string): void {
    const session = this.getOrCreateSession(userId);

    const event: CheckoutStartEvent = {
      eventType: 'checkout_start',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        cartTotal,
        itemCount,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження завершення оформлення
   */
  trackCheckoutComplete(orderId: string, total: number, userId?: string): void {
    const session = this.getOrCreateSession(userId);

    const event: CheckoutCompleteEvent = {
      eventType: 'checkout_complete',
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data: {
        orderId,
        total,
      },
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відстеження користувацької події
   */
  trackEvent(
    eventType: string,
    data?: Record<string, any>,
    userId?: string
  ): void {
    const session = this.getOrCreateSession(userId);

    const event: AnalyticsEvent = {
      eventType,
      userId,
      sessionId: session.sessionId,
      timestamp: new Date(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      data,
    };

    session.events.push(event);
    this.sendToServer(event);
  }

  /**
   * Відправка події на сервер
   */
  private async sendToServer(event: AnalyticsEvent): Promise<void> {
    try {
      await fetch('/api/admin/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send analytics event:', error);
    }
  }

  /**
   * Очистка неактивних сесій
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Оновлення активних користувачів
   */
  private updateActiveUsers(): void {
    const now = Date.now();
    this.activeUsers.clear();

    for (const session of this.sessions.values()) {
      if (now - session.lastActivity.getTime() <= this.ACTIVE_USER_WINDOW) {
        if (session.userId) {
          this.activeUsers.add(session.userId);
        } else {
          this.activeUsers.add(session.sessionId);
        }
      }
    }
  }

  /**
   * Отримання кількості активних користувачів
   */
  getActiveUsersCount(): number {
    this.updateActiveUsers();
    return this.activeUsers.size;
  }

  /**
   * Отримання шляху користувача (user journey)
   */
  getUserJourney(sessionId: string): AnalyticsEvent[] {
    const session = this.sessions.get(sessionId);
    return session ? session.events : [];
  }

  /**
   * Отримання всіх активних сесій
   */
  getActiveSessions(): Session[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(
      session => now - session.lastActivity.getTime() <= this.SESSION_TIMEOUT
    );
  }
}

export const analyticsService = AnalyticsService.getInstance();
