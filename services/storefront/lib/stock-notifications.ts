/**
 * Stock Notifications System
 * "Notify when back in stock" functionality
 */

// ==================== TYPES ====================

export interface StockSubscription {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  userId?: string;
  email?: string;
  phone?: string;
  notifyBy: NotificationChannel[];
  status: SubscriptionStatus;
  createdAt: Date;
  notifiedAt?: Date;
  convertedAt?: Date; // When user made a purchase
  priceAtSubscription: number;
  desiredQuantity?: number;
}

export type NotificationChannel = 'email' | 'sms' | 'push' | 'telegram';

export type SubscriptionStatus =
  | 'active'
  | 'notified'
  | 'converted'
  | 'expired'
  | 'cancelled';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  currentStock: number;
  previousStock: number;
  subscriberCount: number;
  alertType: 'back_in_stock' | 'low_stock' | 'out_of_stock';
  processedAt?: Date;
  createdAt: Date;
}

export interface CreateSubscriptionInput {
  productId: string;
  email?: string;
  phone?: string;
  notifyBy: NotificationChannel[];
  desiredQuantity?: number;
}

export interface StockNotificationStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  notifiedToday: number;
  convertedToday: number;
  conversionRate: number;
  topProducts: { productId: string; productName: string; count: number }[];
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  telegram: boolean;
  maxNotificationsPerDay: number;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string; // "08:00"
}

// ==================== CONFIGURATION ====================

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  telegram: false,
  maxNotificationsPerDay: 5,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

export const SUBSCRIPTION_EXPIRY_DAYS = 90;
export const MAX_SUBSCRIPTIONS_PER_USER = 50;
export const NOTIFICATION_COOLDOWN_HOURS = 24;

// ==================== FUNCTIONS ====================

/**
 * Create a stock subscription
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
  userId?: string
): Promise<StockSubscription> {
  // Validate input
  if (!input.email && !input.phone) {
    throw new Error('Email or phone is required');
  }

  if (input.notifyBy.length === 0) {
    throw new Error('At least one notification channel is required');
  }

  if (input.notifyBy.includes('email') && !input.email) {
    throw new Error('Email is required for email notifications');
  }

  if (input.notifyBy.includes('sms') && !input.phone) {
    throw new Error('Phone is required for SMS notifications');
  }

  const response = await fetch('/api/stock-notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create subscription');
  }

  return response.json();
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const response = await fetch(`/api/stock-notifications/${subscriptionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to cancel subscription');
  }
}

/**
 * Get user's subscriptions
 */
export async function getUserSubscriptions(
  userId?: string,
  email?: string
): Promise<StockSubscription[]> {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  if (email) params.append('email', email);

  const response = await fetch(`/api/stock-notifications?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch subscriptions');
  }

  return response.json();
}

/**
 * Check if user is subscribed to a product
 */
export async function isSubscribed(
  productId: string,
  userId?: string,
  email?: string
): Promise<boolean> {
  const params = new URLSearchParams({ productId });
  if (userId) params.append('userId', userId);
  if (email) params.append('email', email);

  const response = await fetch(`/api/stock-notifications/check?${params}`);

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.subscribed;
}

/**
 * Process stock update and send notifications
 */
export async function processStockUpdate(
  productId: string,
  productName: string,
  productSku: string,
  newStock: number,
  previousStock: number
): Promise<{ notified: number; failed: number }> {
  // Only process if stock went from 0 to > 0
  if (previousStock > 0 || newStock === 0) {
    return { notified: 0, failed: 0 };
  }

  const response = await fetch('/api/stock-notifications/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId,
      productName,
      productSku,
      newStock,
      previousStock,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to process stock update');
  }

  return response.json();
}

/**
 * Get product subscription count
 */
export async function getProductSubscriptionCount(productId: string): Promise<number> {
  const response = await fetch(`/api/stock-notifications/count?productId=${productId}`);

  if (!response.ok) {
    return 0;
  }

  const data = await response.json();
  return data.count;
}

/**
 * Get notification statistics
 */
export async function getNotificationStats(): Promise<StockNotificationStats> {
  const response = await fetch('/api/stock-notifications/stats');

  if (!response.ok) {
    throw new Error('Failed to fetch notification stats');
  }

  return response.json();
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response = await fetch('/api/stock-notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, preferences }),
  });

  if (!response.ok) {
    throw new Error('Failed to update preferences');
  }

  return response.json();
}

/**
 * Check if notification can be sent (respecting quiet hours and limits)
 */
export function canSendNotification(
  preferences: NotificationPreferences,
  notificationsToday: number
): { canSend: boolean; reason?: string; reasonUk?: string } {
  // Check daily limit
  if (notificationsToday >= preferences.maxNotificationsPerDay) {
    return {
      canSend: false,
      reason: 'Daily notification limit reached',
      reasonUk: 'Досягнуто ліміту сповіщень на день',
    };
  }

  // Check quiet hours
  if (preferences.quietHoursStart && preferences.quietHoursEnd) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const quietStart = startHour * 60 + startMin;
    const quietEnd = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if (quietStart > quietEnd) {
      if (currentTime >= quietStart || currentTime < quietEnd) {
        return {
          canSend: false,
          reason: 'Quiet hours active',
          reasonUk: 'Зараз години тиші',
        };
      }
    } else {
      if (currentTime >= quietStart && currentTime < quietEnd) {
        return {
          canSend: false,
          reason: 'Quiet hours active',
          reasonUk: 'Зараз години тиші',
        };
      }
    }
  }

  return { canSend: true };
}

/**
 * Format subscription status
 */
export function formatSubscriptionStatus(status: SubscriptionStatus): { en: string; uk: string } {
  switch (status) {
    case 'active':
      return { en: 'Active', uk: 'Активна' };
    case 'notified':
      return { en: 'Notified', uk: 'Сповіщено' };
    case 'converted':
      return { en: 'Purchased', uk: 'Куплено' };
    case 'expired':
      return { en: 'Expired', uk: 'Закінчилася' };
    case 'cancelled':
      return { en: 'Cancelled', uk: 'Скасовано' };
    default:
      return { en: 'Unknown', uk: 'Невідомо' };
  }
}

/**
 * Get channel label
 */
export function getChannelLabel(channel: NotificationChannel): { en: string; uk: string } {
  switch (channel) {
    case 'email':
      return { en: 'Email', uk: 'Email' };
    case 'sms':
      return { en: 'SMS', uk: 'SMS' };
    case 'push':
      return { en: 'Push notification', uk: 'Push-сповіщення' };
    case 'telegram':
      return { en: 'Telegram', uk: 'Telegram' };
    default:
      return { en: 'Unknown', uk: 'Невідомо' };
  }
}

/**
 * Calculate subscription expiry date
 */
export function getSubscriptionExpiryDate(createdAt: Date): Date {
  const expiry = new Date(createdAt);
  expiry.setDate(expiry.getDate() + SUBSCRIPTION_EXPIRY_DAYS);
  return expiry;
}

/**
 * Check if subscription is expired
 */
export function isSubscriptionExpired(subscription: StockSubscription): boolean {
  if (subscription.status !== 'active') return false;

  const expiry = getSubscriptionExpiryDate(new Date(subscription.createdAt));
  return new Date() > expiry;
}

/**
 * Generate unsubscribe token
 */
export function generateUnsubscribeToken(subscriptionId: string, email: string): string {
  // Simple token generation - in production use proper JWT or signed tokens
  const data = `${subscriptionId}:${email}:${Date.now()}`;
  return Buffer.from(data).toString('base64url');
}

/**
 * Validate unsubscribe token
 */
export function validateUnsubscribeToken(token: string): { subscriptionId: string; email: string } | null {
  try {
    const data = Buffer.from(token, 'base64url').toString();
    const [subscriptionId, email] = data.split(':');

    if (!subscriptionId || !email) return null;

    return { subscriptionId, email };
  } catch {
    return null;
  }
}
