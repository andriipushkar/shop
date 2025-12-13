/**
 * Business Events Logger
 * Track important business events for analytics and debugging
 */

import { logger } from './logger';
import { addBreadcrumb } from './sentry';

// Event types
export type BusinessEventType =
  // Order events
  | 'order.created'
  | 'order.paid'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  // Cart events
  | 'cart.item_added'
  | 'cart.item_removed'
  | 'cart.item_updated'
  | 'cart.cleared'
  | 'cart.abandoned'
  // User events
  | 'user.registered'
  | 'user.logged_in'
  | 'user.logged_out'
  | 'user.password_reset'
  | 'user.profile_updated'
  | 'user.email_verified'
  // Product events
  | 'product.viewed'
  | 'product.searched'
  | 'product.reviewed'
  | 'product.wishlisted'
  | 'product.stock_low'
  | 'product.out_of_stock'
  // Payment events
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refund_initiated'
  | 'payment.refund_completed'
  // Promotion events
  | 'coupon.applied'
  | 'coupon.removed'
  | 'coupon.invalid'
  // Admin events
  | 'admin.product_created'
  | 'admin.product_updated'
  | 'admin.product_deleted'
  | 'admin.order_status_changed'
  | 'admin.inventory_adjusted'
  // System events
  | 'system.error'
  | 'system.slow_response'
  | 'system.rate_limited';

export interface BusinessEvent {
  type: BusinessEventType;
  timestamp: string;
  userId?: string;
  sessionId?: string;
  data: Record<string, unknown>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    source?: string;
    referrer?: string;
  };
}

// Event queue for batch processing
let eventQueue: BusinessEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;

const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 100;

/**
 * Log a business event
 */
export function logBusinessEvent(
  type: BusinessEventType,
  data: Record<string, unknown>,
  options?: {
    userId?: string;
    sessionId?: string;
    metadata?: BusinessEvent['metadata'];
  }
): void {
  const event: BusinessEvent = {
    type,
    timestamp: new Date().toISOString(),
    userId: options?.userId,
    sessionId: options?.sessionId,
    data,
    metadata: options?.metadata,
  };

  // Log to console/logger
  logger.info(`Business Event: ${type}`, {
    ...data,
    userId: options?.userId,
    sessionId: options?.sessionId,
  });

  // Add breadcrumb for Sentry
  addBreadcrumb('business-event', type, data);

  // Add to queue
  eventQueue.push(event);

  // Flush if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
  } else if (!flushTimer) {
    // Start flush timer
    flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
  }
}

/**
 * Flush events to storage/API
 */
async function flushEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  try {
    // Send to analytics API or storage
    if (process.env.ANALYTICS_ENDPOINT) {
      await fetch(process.env.ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    }

    // Or store in database
    // await db.businessEvents.createMany({ data: events });
  } catch (error) {
    logger.error('Failed to flush business events', error as Error);
    // Re-queue failed events
    eventQueue = [...events, ...eventQueue].slice(0, MAX_QUEUE_SIZE);
  }
}

// ==================== ORDER EVENTS ====================

export function logOrderCreated(
  orderId: string,
  data: {
    userId?: string;
    total: number;
    itemCount: number;
    paymentMethod: string;
    shippingMethod: string;
  }
): void {
  logBusinessEvent('order.created', {
    orderId,
    ...data,
  }, { userId: data.userId });
}

export function logOrderPaid(
  orderId: string,
  data: {
    userId?: string;
    total: number;
    paymentMethod: string;
    transactionId?: string;
  }
): void {
  logBusinessEvent('order.paid', {
    orderId,
    ...data,
  }, { userId: data.userId });
}

export function logOrderShipped(
  orderId: string,
  data: {
    userId?: string;
    trackingNumber?: string;
    carrier?: string;
  }
): void {
  logBusinessEvent('order.shipped', {
    orderId,
    ...data,
  }, { userId: data.userId });
}

export function logOrderCancelled(
  orderId: string,
  data: {
    userId?: string;
    reason?: string;
    cancelledBy: 'user' | 'admin' | 'system';
  }
): void {
  logBusinessEvent('order.cancelled', {
    orderId,
    ...data,
  }, { userId: data.userId });
}

// ==================== CART EVENTS ====================

export function logCartItemAdded(
  data: {
    userId?: string;
    sessionId?: string;
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }
): void {
  logBusinessEvent('cart.item_added', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

export function logCartItemRemoved(
  data: {
    userId?: string;
    sessionId?: string;
    productId: string;
    productName: string;
    quantity: number;
  }
): void {
  logBusinessEvent('cart.item_removed', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

export function logCartAbandoned(
  data: {
    userId?: string;
    sessionId?: string;
    total: number;
    itemCount: number;
    lastActivityAt: string;
  }
): void {
  logBusinessEvent('cart.abandoned', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

// ==================== USER EVENTS ====================

export function logUserRegistered(
  userId: string,
  data: {
    email: string;
    source?: string;
    referrer?: string;
  }
): void {
  logBusinessEvent('user.registered', {
    userId,
    email: data.email,
    source: data.source,
  }, {
    userId,
    metadata: { source: data.source, referrer: data.referrer },
  });
}

export function logUserLoggedIn(
  userId: string,
  data: {
    email: string;
    method: 'email' | 'google' | 'facebook' | 'phone';
  }
): void {
  logBusinessEvent('user.logged_in', {
    userId,
    ...data,
  }, { userId });
}

export function logUserLoggedOut(userId: string): void {
  logBusinessEvent('user.logged_out', { userId }, { userId });
}

// ==================== PRODUCT EVENTS ====================

export function logProductViewed(
  data: {
    userId?: string;
    sessionId?: string;
    productId: string;
    productName: string;
    categoryId?: string;
    price: number;
  }
): void {
  logBusinessEvent('product.viewed', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

export function logProductSearched(
  data: {
    userId?: string;
    sessionId?: string;
    query: string;
    resultsCount: number;
    filters?: Record<string, unknown>;
  }
): void {
  logBusinessEvent('product.searched', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

export function logProductReviewed(
  data: {
    userId: string;
    productId: string;
    productName: string;
    rating: number;
    hasText: boolean;
    hasPhotos: boolean;
  }
): void {
  logBusinessEvent('product.reviewed', data, { userId: data.userId });
}

export function logLowStock(
  data: {
    productId: string;
    productName: string;
    currentStock: number;
    threshold: number;
  }
): void {
  logBusinessEvent('product.stock_low', data);
}

export function logOutOfStock(
  data: {
    productId: string;
    productName: string;
  }
): void {
  logBusinessEvent('product.out_of_stock', data);
}

// ==================== PAYMENT EVENTS ====================

export function logPaymentInitiated(
  data: {
    userId?: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
  }
): void {
  logBusinessEvent('payment.initiated', data, { userId: data.userId });
}

export function logPaymentCompleted(
  data: {
    userId?: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
    transactionId: string;
  }
): void {
  logBusinessEvent('payment.completed', data, { userId: data.userId });
}

export function logPaymentFailed(
  data: {
    userId?: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
    errorCode?: string;
    errorMessage?: string;
  }
): void {
  logBusinessEvent('payment.failed', data, { userId: data.userId });
}

// ==================== PROMOTION EVENTS ====================

export function logCouponApplied(
  data: {
    userId?: string;
    sessionId?: string;
    couponCode: string;
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    orderId?: string;
  }
): void {
  logBusinessEvent('coupon.applied', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

export function logCouponInvalid(
  data: {
    userId?: string;
    sessionId?: string;
    couponCode: string;
    reason: string;
  }
): void {
  logBusinessEvent('coupon.invalid', data, {
    userId: data.userId,
    sessionId: data.sessionId,
  });
}

// ==================== ADMIN EVENTS ====================

export function logAdminProductCreated(
  data: {
    adminId: string;
    productId: string;
    productName: string;
  }
): void {
  logBusinessEvent('admin.product_created', data, { userId: data.adminId });
}

export function logAdminProductUpdated(
  data: {
    adminId: string;
    productId: string;
    productName: string;
    changes: string[];
  }
): void {
  logBusinessEvent('admin.product_updated', data, { userId: data.adminId });
}

export function logAdminOrderStatusChanged(
  data: {
    adminId: string;
    orderId: string;
    previousStatus: string;
    newStatus: string;
  }
): void {
  logBusinessEvent('admin.order_status_changed', data, { userId: data.adminId });
}

export function logAdminInventoryAdjusted(
  data: {
    adminId: string;
    productId: string;
    productName: string;
    previousQuantity: number;
    newQuantity: number;
    reason: string;
  }
): void {
  logBusinessEvent('admin.inventory_adjusted', data, { userId: data.adminId });
}

// ==================== SYSTEM EVENTS ====================

export function logSystemError(
  data: {
    errorType: string;
    errorMessage: string;
    endpoint?: string;
    stack?: string;
  }
): void {
  logBusinessEvent('system.error', data);
}

export function logSlowResponse(
  data: {
    endpoint: string;
    method: string;
    duration: number;
    threshold: number;
  }
): void {
  logBusinessEvent('system.slow_response', data);
}

export function logRateLimited(
  data: {
    userId?: string;
    ip?: string;
    endpoint: string;
    limit: number;
  }
): void {
  logBusinessEvent('system.rate_limited', data, { userId: data.userId });
}

// ==================== CLEANUP ====================

/**
 * Flush pending events before shutdown
 */
export async function shutdown(): Promise<void> {
  await flushEvents();
}

// Flush on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default {
  logBusinessEvent,
  logOrderCreated,
  logOrderPaid,
  logOrderShipped,
  logOrderCancelled,
  logCartItemAdded,
  logCartItemRemoved,
  logCartAbandoned,
  logUserRegistered,
  logUserLoggedIn,
  logUserLoggedOut,
  logProductViewed,
  logProductSearched,
  logProductReviewed,
  logLowStock,
  logOutOfStock,
  logPaymentInitiated,
  logPaymentCompleted,
  logPaymentFailed,
  logCouponApplied,
  logCouponInvalid,
  logAdminProductCreated,
  logAdminProductUpdated,
  logAdminOrderStatusChanged,
  logAdminInventoryAdjusted,
  logSystemError,
  logSlowResponse,
  logRateLimited,
  shutdown,
};
