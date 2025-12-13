/**
 * CRM System
 * Customer management, history, segmentation, and communications
 */

// ==================== TYPES ====================

export interface Customer {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  language: string;
  currency: string;
  status: CustomerStatus;
  segment?: CustomerSegment;
  tags: string[];
  source: CustomerSource;
  referralCode?: string;
  referredBy?: string;
  addresses: CustomerAddress[];
  defaultAddressId?: string;
  loyaltyTierId?: string;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  firstOrderDate?: Date;
  lastActivityDate?: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
  marketingConsent: boolean;
  smsConsent: boolean;
  notes?: string;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'pending_verification';
export type CustomerSource = 'organic' | 'referral' | 'social' | 'ads' | 'email' | 'direct' | 'other';

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: AddressType;
  firstName: string;
  lastName: string;
  company?: string;
  phone: string;
  street: string;
  apartment?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
}

export type AddressType = 'shipping' | 'billing' | 'both';

export interface CustomerSegment {
  id: string;
  name: string;
  nameUk: string;
  description?: string;
  color: string;
  icon: string;
  rules: SegmentRule[];
  customerCount: number;
  isAutomatic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentRule {
  field: SegmentField;
  operator: RuleOperator;
  value: string | number | boolean | Date | string[];
}

export type SegmentField =
  | 'total_spent'
  | 'total_orders'
  | 'average_order_value'
  | 'days_since_last_order'
  | 'days_since_registration'
  | 'loyalty_tier'
  | 'loyalty_points'
  | 'source'
  | 'tags'
  | 'city'
  | 'region'
  | 'has_email'
  | 'has_phone'
  | 'email_verified'
  | 'marketing_consent';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'is_set'
  | 'is_not_set';

export interface CustomerActivity {
  id: string;
  customerId: string;
  type: ActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  referenceType?: string;
  referenceId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type ActivityType =
  | 'registration'
  | 'login'
  | 'logout'
  | 'password_reset'
  | 'email_verified'
  | 'phone_verified'
  | 'profile_updated'
  | 'address_added'
  | 'address_updated'
  | 'address_deleted'
  | 'order_placed'
  | 'order_cancelled'
  | 'order_delivered'
  | 'return_requested'
  | 'return_completed'
  | 'review_submitted'
  | 'wishlist_added'
  | 'wishlist_removed'
  | 'coupon_used'
  | 'loyalty_points_earned'
  | 'loyalty_points_redeemed'
  | 'support_ticket_created'
  | 'support_ticket_resolved'
  | 'note_added'
  | 'tag_added'
  | 'tag_removed'
  | 'segment_changed';

export interface CustomerNote {
  id: string;
  customerId: string;
  content: string;
  type: NoteType;
  isPinned: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NoteType = 'general' | 'support' | 'sales' | 'warning' | 'reminder';

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  itemCount: number;
  paymentMethod: string;
  shippingMethod: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface CustomerStats {
  totalSpent: number;
  totalOrders: number;
  averageOrderValue: number;
  totalReturns: number;
  returnRate: number;
  totalReviews: number;
  averageRating: number;
  loyaltyPoints: number;
  lifetimeValue: number;
  daysSinceLastOrder: number | null;
  purchaseFrequency: number; // Orders per year
  preferredPaymentMethod?: string;
  preferredShippingMethod?: string;
  topCategories: { categoryId: string; categoryName: string; orderCount: number }[];
  topProducts: { productId: string; productName: string; purchaseCount: number }[];
}

export interface Communication {
  id: string;
  customerId: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  subject?: string;
  content: string;
  status: CommunicationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  campaignId?: string;
  templateId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
}

export type CommunicationType = 'transactional' | 'marketing' | 'support' | 'reminder' | 'notification';
export type CommunicationChannel = 'email' | 'sms' | 'push' | 'telegram' | 'viber';
export type CommunicationStatus = 'draft' | 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  type: CommunicationType;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  type: CampaignType;
  channel: CommunicationChannel;
  status: CampaignStatus;
  templateId?: string;
  segmentIds: string[];
  targetAudience: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  unsubscribed: number;
  bounced: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignType = 'promotional' | 'newsletter' | 'announcement' | 'reactivation' | 'birthday' | 'abandoned_cart';
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  assignedToName?: string;
  orderId?: string;
  productId?: string;
  messages: TicketMessage[];
  resolution?: string;
  satisfaction?: number;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TicketCategory = 'order' | 'payment' | 'shipping' | 'return' | 'product' | 'account' | 'technical' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  isFromCustomer: boolean;
  attachments?: string[];
  createdBy?: string;
  createdByName?: string;
  createdAt: Date;
}

// ==================== INPUT TYPES ====================

export interface CustomerFilters {
  search?: string;
  status?: CustomerStatus;
  segmentId?: string;
  tags?: string[];
  source?: CustomerSource;
  hasOrders?: boolean;
  minTotalSpent?: number;
  maxTotalSpent?: number;
  minOrders?: number;
  maxOrders?: number;
  registeredAfter?: Date;
  registeredBefore?: Date;
  lastActiveAfter?: Date;
  lastActiveBefore?: Date;
  city?: string;
  region?: string;
  loyaltyTier?: string;
}

export interface CreateCustomerInput {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: Gender;
  marketingConsent?: boolean;
  smsConsent?: boolean;
  tags?: string[];
  notes?: string;
  source?: CustomerSource;
}

export interface UpdateCustomerInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  status?: CustomerStatus;
  marketingConsent?: boolean;
  smsConsent?: boolean;
  tags?: string[];
  notes?: string;
  segmentId?: string;
}

export interface CreateNoteInput {
  customerId: string;
  content: string;
  type?: NoteType;
  isPinned?: boolean;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  type: CampaignType;
  channel: CommunicationChannel;
  templateId?: string;
  segmentIds: string[];
  scheduledAt?: Date;
}

export interface CreateTicketInput {
  customerId: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  orderId?: string;
  productId?: string;
}

// ==================== CONSTANTS ====================

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, { en: string; uk: string; color: string }> = {
  active: { en: 'Active', uk: 'Активний', color: '#10b981' },
  inactive: { en: 'Inactive', uk: 'Неактивний', color: '#6b7280' },
  blocked: { en: 'Blocked', uk: 'Заблоковано', color: '#ef4444' },
  pending_verification: { en: 'Pending Verification', uk: 'Очікує верифікації', color: '#f59e0b' },
};

export const CUSTOMER_SOURCE_LABELS: Record<CustomerSource, { en: string; uk: string }> = {
  organic: { en: 'Organic Search', uk: 'Органічний пошук' },
  referral: { en: 'Referral', uk: 'Реферал' },
  social: { en: 'Social Media', uk: 'Соцмережі' },
  ads: { en: 'Advertising', uk: 'Реклама' },
  email: { en: 'Email', uk: 'Email-розсилка' },
  direct: { en: 'Direct', uk: 'Прямий перехід' },
  other: { en: 'Other', uk: 'Інше' },
};

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, { en: string; uk: string; icon: string }> = {
  registration: { en: 'Registered', uk: 'Зареєструвався', icon: 'user-plus' },
  login: { en: 'Logged in', uk: 'Увійшов', icon: 'arrow-right-on-rectangle' },
  logout: { en: 'Logged out', uk: 'Вийшов', icon: 'arrow-left-on-rectangle' },
  password_reset: { en: 'Password reset', uk: 'Скинув пароль', icon: 'key' },
  email_verified: { en: 'Email verified', uk: 'Підтвердив email', icon: 'envelope-check' },
  phone_verified: { en: 'Phone verified', uk: 'Підтвердив телефон', icon: 'phone-check' },
  profile_updated: { en: 'Profile updated', uk: 'Оновив профіль', icon: 'user' },
  address_added: { en: 'Address added', uk: 'Додав адресу', icon: 'map-pin' },
  address_updated: { en: 'Address updated', uk: 'Оновив адресу', icon: 'map-pin' },
  address_deleted: { en: 'Address deleted', uk: 'Видалив адресу', icon: 'map-pin' },
  order_placed: { en: 'Placed order', uk: 'Оформив замовлення', icon: 'shopping-bag' },
  order_cancelled: { en: 'Cancelled order', uk: 'Скасував замовлення', icon: 'x-circle' },
  order_delivered: { en: 'Order delivered', uk: 'Отримав замовлення', icon: 'check-circle' },
  return_requested: { en: 'Requested return', uk: 'Запросив повернення', icon: 'arrow-uturn-left' },
  return_completed: { en: 'Return completed', uk: 'Повернення завершено', icon: 'arrow-uturn-left' },
  review_submitted: { en: 'Submitted review', uk: 'Залишив відгук', icon: 'star' },
  wishlist_added: { en: 'Added to wishlist', uk: 'Додав до бажань', icon: 'heart' },
  wishlist_removed: { en: 'Removed from wishlist', uk: 'Видалив з бажань', icon: 'heart' },
  coupon_used: { en: 'Used coupon', uk: 'Використав купон', icon: 'ticket' },
  loyalty_points_earned: { en: 'Earned points', uk: 'Отримав бали', icon: 'gift' },
  loyalty_points_redeemed: { en: 'Redeemed points', uk: 'Використав бали', icon: 'gift' },
  support_ticket_created: { en: 'Created ticket', uk: 'Створив звернення', icon: 'chat-bubble-left' },
  support_ticket_resolved: { en: 'Ticket resolved', uk: 'Звернення вирішено', icon: 'chat-bubble-left' },
  note_added: { en: 'Note added', uk: 'Додано примітку', icon: 'pencil' },
  tag_added: { en: 'Tag added', uk: 'Додано тег', icon: 'tag' },
  tag_removed: { en: 'Tag removed', uk: 'Видалено тег', icon: 'tag' },
  segment_changed: { en: 'Segment changed', uk: 'Змінено сегмент', icon: 'users' },
};

export const NOTE_TYPE_LABELS: Record<NoteType, { en: string; uk: string; color: string }> = {
  general: { en: 'General', uk: 'Загальна', color: '#6b7280' },
  support: { en: 'Support', uk: 'Підтримка', color: '#3b82f6' },
  sales: { en: 'Sales', uk: 'Продажі', color: '#10b981' },
  warning: { en: 'Warning', uk: 'Попередження', color: '#f59e0b' },
  reminder: { en: 'Reminder', uk: 'Нагадування', color: '#8b5cf6' },
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, { en: string; uk: string; color: string }> = {
  open: { en: 'Open', uk: 'Відкрито', color: '#3b82f6' },
  pending: { en: 'Pending', uk: 'В очікуванні', color: '#f59e0b' },
  in_progress: { en: 'In Progress', uk: 'В роботі', color: '#8b5cf6' },
  waiting_customer: { en: 'Waiting Customer', uk: 'Очікує клієнта', color: '#06b6d4' },
  resolved: { en: 'Resolved', uk: 'Вирішено', color: '#10b981' },
  closed: { en: 'Closed', uk: 'Закрито', color: '#6b7280' },
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, { en: string; uk: string; color: string }> = {
  low: { en: 'Low', uk: 'Низький', color: '#6b7280' },
  medium: { en: 'Medium', uk: 'Середній', color: '#f59e0b' },
  high: { en: 'High', uk: 'Високий', color: '#ef4444' },
  urgent: { en: 'Urgent', uk: 'Терміновий', color: '#dc2626' },
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, { en: string; uk: string }> = {
  order: { en: 'Order', uk: 'Замовлення' },
  payment: { en: 'Payment', uk: 'Оплата' },
  shipping: { en: 'Shipping', uk: 'Доставка' },
  return: { en: 'Return', uk: 'Повернення' },
  product: { en: 'Product', uk: 'Товар' },
  account: { en: 'Account', uk: 'Акаунт' },
  technical: { en: 'Technical', uk: 'Технічна' },
  other: { en: 'Other', uk: 'Інше' },
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, { en: string; uk: string; color: string }> = {
  draft: { en: 'Draft', uk: 'Чернетка', color: '#6b7280' },
  scheduled: { en: 'Scheduled', uk: 'Заплановано', color: '#f59e0b' },
  running: { en: 'Running', uk: 'Виконується', color: '#3b82f6' },
  paused: { en: 'Paused', uk: 'Призупинено', color: '#8b5cf6' },
  completed: { en: 'Completed', uk: 'Завершено', color: '#10b981' },
  cancelled: { en: 'Cancelled', uk: 'Скасовано', color: '#ef4444' },
};

// ==================== DEFAULT SEGMENTS ====================

export const DEFAULT_SEGMENTS: Omit<CustomerSegment, 'id' | 'customerCount' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'VIP Customers',
    nameUk: 'VIP клієнти',
    description: 'High-value customers with significant purchase history',
    color: '#fbbf24',
    icon: 'crown',
    rules: [{ field: 'total_spent', operator: 'greater_than', value: 50000 }],
    isAutomatic: true,
  },
  {
    name: 'New Customers',
    nameUk: 'Нові клієнти',
    description: 'Customers registered in the last 30 days',
    color: '#10b981',
    icon: 'sparkles',
    rules: [{ field: 'days_since_registration', operator: 'less_or_equal', value: 30 }],
    isAutomatic: true,
  },
  {
    name: 'At Risk',
    nameUk: 'Під загрозою відтоку',
    description: 'Customers who haven\'t ordered in 90 days',
    color: '#ef4444',
    icon: 'exclamation-triangle',
    rules: [
      { field: 'days_since_last_order', operator: 'greater_than', value: 90 },
      { field: 'total_orders', operator: 'greater_than', value: 0 },
    ],
    isAutomatic: true,
  },
  {
    name: 'Loyal Customers',
    nameUk: 'Постійні клієнти',
    description: 'Customers with 5+ orders',
    color: '#8b5cf6',
    icon: 'heart',
    rules: [{ field: 'total_orders', operator: 'greater_or_equal', value: 5 }],
    isAutomatic: true,
  },
  {
    name: 'Newsletter Subscribers',
    nameUk: 'Підписники розсилки',
    description: 'Customers who opted in for marketing emails',
    color: '#3b82f6',
    icon: 'envelope',
    rules: [{ field: 'marketing_consent', operator: 'equals', value: true }],
    isAutomatic: true,
  },
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate customer lifetime value
 */
export function calculateCustomerLTV(
  totalSpent: number,
  averageOrderValue: number,
  purchaseFrequency: number,
  customerLifespanYears: number = 3
): number {
  return averageOrderValue * purchaseFrequency * customerLifespanYears;
}

/**
 * Calculate days since date
 */
export function daysSince(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate purchase frequency (orders per year)
 */
export function calculatePurchaseFrequency(
  totalOrders: number,
  firstOrderDate: Date | null | undefined
): number {
  if (!firstOrderDate || totalOrders === 0) return 0;

  const daysSinceFirst = daysSince(firstOrderDate);
  if (!daysSinceFirst || daysSinceFirst === 0) return totalOrders;

  const yearsAsCustomer = daysSinceFirst / 365;
  return totalOrders / yearsAsCustomer;
}

/**
 * Check if customer matches segment rules
 */
export function matchesSegmentRules(customer: Customer, rules: SegmentRule[]): boolean {
  return rules.every(rule => {
    const fieldValue = getCustomerFieldValue(customer, rule.field);
    return evaluateRule(fieldValue, rule.operator, rule.value);
  });
}

/**
 * Get customer field value for segmentation
 */
function getCustomerFieldValue(customer: Customer, field: SegmentField): unknown {
  switch (field) {
    case 'total_spent':
      return customer.totalSpent;
    case 'total_orders':
      return customer.totalOrders;
    case 'average_order_value':
      return customer.averageOrderValue;
    case 'days_since_last_order':
      return daysSince(customer.lastOrderDate);
    case 'days_since_registration':
      return daysSince(customer.createdAt);
    case 'loyalty_tier':
      return customer.loyaltyTierId;
    case 'loyalty_points':
      return customer.loyaltyPoints;
    case 'source':
      return customer.source;
    case 'tags':
      return customer.tags;
    case 'city':
      return customer.addresses[0]?.city;
    case 'region':
      return customer.addresses[0]?.region;
    case 'has_email':
      return !!customer.email;
    case 'has_phone':
      return !!customer.phone;
    case 'email_verified':
      return customer.emailVerified;
    case 'marketing_consent':
      return customer.marketingConsent;
    default:
      return undefined;
  }
}

/**
 * Evaluate a single rule
 */
function evaluateRule(fieldValue: unknown, operator: RuleOperator, ruleValue: unknown): boolean {
  switch (operator) {
    case 'equals':
      return fieldValue === ruleValue;
    case 'not_equals':
      return fieldValue !== ruleValue;
    case 'greater_than':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue > ruleValue;
    case 'less_than':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue < ruleValue;
    case 'greater_or_equal':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue >= ruleValue;
    case 'less_or_equal':
      return typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue <= ruleValue;
    case 'contains':
      return typeof fieldValue === 'string' && typeof ruleValue === 'string' &&
        fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof ruleValue === 'string' &&
        !fieldValue.toLowerCase().includes(ruleValue.toLowerCase());
    case 'in':
      return Array.isArray(ruleValue) && ruleValue.includes(fieldValue);
    case 'not_in':
      return Array.isArray(ruleValue) && !ruleValue.includes(fieldValue);
    case 'is_set':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'is_not_set':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    default:
      return false;
  }
}

/**
 * Format customer name
 */
export function formatCustomerName(customer: { firstName: string; lastName: string }): string {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Generate referral code
 */
export function generateReferralCode(customerId: string): string {
  const prefix = 'REF';
  const hash = customerId.slice(0, 4).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${hash}${random}`;
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Ukrainian phone
 */
export function validateUkrainianPhone(phone: string): boolean {
  const phoneRegex = /^(\+?38)?(0\d{9})$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Format Ukrainian phone
 */
export function formatUkrainianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('380')) {
    return `+380 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10)}`;
  }
  if (cleaned.startsWith('0')) {
    return `+380 ${cleaned.slice(1, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch customers list
 */
export async function fetchCustomers(
  filters?: CustomerFilters,
  page: number = 1,
  limit: number = 20
): Promise<{ customers: Customer[]; total: number; page: number; totalPages: number }> {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  if (filters?.search) params.set('search', filters.search);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.segmentId) params.set('segmentId', filters.segmentId);
  if (filters?.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters?.source) params.set('source', filters.source);
  if (filters?.hasOrders !== undefined) params.set('hasOrders', filters.hasOrders.toString());
  if (filters?.minTotalSpent) params.set('minTotalSpent', filters.minTotalSpent.toString());
  if (filters?.maxTotalSpent) params.set('maxTotalSpent', filters.maxTotalSpent.toString());
  if (filters?.city) params.set('city', filters.city);
  if (filters?.region) params.set('region', filters.region);

  const response = await fetch(`/api/admin/customers?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch customers');
  }

  return response.json();
}

/**
 * Fetch single customer
 */
export async function fetchCustomer(customerId: string): Promise<Customer> {
  const response = await fetch(`/api/admin/customers/${customerId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer');
  }

  return response.json();
}

/**
 * Create customer
 */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const response = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create customer');
  }

  return response.json();
}

/**
 * Update customer
 */
export async function updateCustomer(customerId: string, updates: UpdateCustomerInput): Promise<Customer> {
  const response = await fetch(`/api/admin/customers/${customerId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update customer');
  }

  return response.json();
}

/**
 * Fetch customer stats
 */
export async function fetchCustomerStats(customerId: string): Promise<CustomerStats> {
  const response = await fetch(`/api/admin/customers/${customerId}/stats`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer stats');
  }

  return response.json();
}

/**
 * Fetch customer orders
 */
export async function fetchCustomerOrders(
  customerId: string,
  page: number = 1,
  limit: number = 10
): Promise<{ orders: CustomerOrder[]; total: number }> {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  const response = await fetch(`/api/admin/customers/${customerId}/orders?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer orders');
  }

  return response.json();
}

/**
 * Fetch customer activity
 */
export async function fetchCustomerActivity(
  customerId: string,
  limit: number = 50
): Promise<CustomerActivity[]> {
  const response = await fetch(`/api/admin/customers/${customerId}/activity?limit=${limit}`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer activity');
  }

  return response.json();
}

/**
 * Fetch customer notes
 */
export async function fetchCustomerNotes(customerId: string): Promise<CustomerNote[]> {
  const response = await fetch(`/api/admin/customers/${customerId}/notes`);

  if (!response.ok) {
    throw new Error('Failed to fetch customer notes');
  }

  return response.json();
}

/**
 * Create customer note
 */
export async function createCustomerNote(input: CreateNoteInput): Promise<CustomerNote> {
  const response = await fetch(`/api/admin/customers/${input.customerId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create note');
  }

  return response.json();
}

/**
 * Add tag to customer
 */
export async function addCustomerTag(customerId: string, tag: string): Promise<void> {
  const response = await fetch(`/api/admin/customers/${customerId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });

  if (!response.ok) {
    throw new Error('Failed to add tag');
  }
}

/**
 * Remove tag from customer
 */
export async function removeCustomerTag(customerId: string, tag: string): Promise<void> {
  const response = await fetch(`/api/admin/customers/${customerId}/tags/${encodeURIComponent(tag)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to remove tag');
  }
}

/**
 * Fetch segments
 */
export async function fetchSegments(): Promise<CustomerSegment[]> {
  const response = await fetch('/api/admin/segments');

  if (!response.ok) {
    throw new Error('Failed to fetch segments');
  }

  return response.json();
}

/**
 * Create segment
 */
export async function createSegment(
  input: Omit<CustomerSegment, 'id' | 'customerCount' | 'createdAt' | 'updatedAt'>
): Promise<CustomerSegment> {
  const response = await fetch('/api/admin/segments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create segment');
  }

  return response.json();
}

/**
 * Fetch campaigns
 */
export async function fetchCampaigns(status?: CampaignStatus): Promise<Campaign[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);

  const response = await fetch(`/api/admin/campaigns?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch campaigns');
  }

  return response.json();
}

/**
 * Create campaign
 */
export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const response = await fetch('/api/admin/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create campaign');
  }

  return response.json();
}

/**
 * Fetch support tickets
 */
export async function fetchSupportTickets(filters?: {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
}): Promise<SupportTicket[]> {
  const params = new URLSearchParams();

  if (filters?.status) params.set('status', filters.status);
  if (filters?.priority) params.set('priority', filters.priority);
  if (filters?.category) params.set('category', filters.category);
  if (filters?.assignedTo) params.set('assignedTo', filters.assignedTo);

  const response = await fetch(`/api/admin/tickets?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }

  return response.json();
}

/**
 * Create support ticket
 */
export async function createSupportTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const response = await fetch('/api/admin/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create ticket');
  }

  return response.json();
}

/**
 * Reply to ticket
 */
export async function replyToTicket(ticketId: string, content: string): Promise<TicketMessage> {
  const response = await fetch(`/api/admin/tickets/${ticketId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error('Failed to reply to ticket');
  }

  return response.json();
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  const response = await fetch(`/api/admin/tickets/${ticketId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error('Failed to update ticket status');
  }

  return response.json();
}

/**
 * Export customers
 */
export async function exportCustomers(
  filters?: CustomerFilters,
  format: 'csv' | 'excel' = 'excel'
): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('format', format);

  if (filters?.segmentId) params.set('segmentId', filters.segmentId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.tags?.length) params.set('tags', filters.tags.join(','));

  const response = await fetch(`/api/admin/customers/export?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to export customers');
  }

  return response.blob();
}
