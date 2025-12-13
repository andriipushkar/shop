/**
 * Optimized Checkout System
 * One-page checkout, guest checkout, saved addresses
 */

// ==================== TYPES ====================

export interface CheckoutState {
  step: CheckoutStep;
  customer: CustomerInfo | null;
  delivery: DeliveryInfo | null;
  payment: PaymentInfo | null;
  cart: CheckoutCart;
  appliedCoupons: AppliedCoupon[];
  totals: CheckoutTotals;
  errors: CheckoutErrors;
  isGuest: boolean;
  saveInfo: boolean;
}

export type CheckoutStep =
  | 'customer'
  | 'delivery'
  | 'payment'
  | 'review'
  | 'complete';

export interface CustomerInfo {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  isReturning: boolean;
  accountCreated?: boolean;
}

export interface DeliveryInfo {
  method: DeliveryMethod;
  provider?: string;
  cityRef?: string;
  cityName?: string;
  warehouseRef?: string;
  warehouseName?: string;
  address?: AddressInfo;
  date?: Date;
  timeSlot?: TimeSlot;
  notes?: string;
  price: number;
  isFree: boolean;
}

export type DeliveryMethod =
  | 'nova_poshta_warehouse'
  | 'nova_poshta_postomat'
  | 'nova_poshta_courier'
  | 'meest_warehouse'
  | 'meest_courier'
  | 'justin_warehouse'
  | 'ukrposhta'
  | 'pickup';

export interface AddressInfo {
  id?: string;
  street: string;
  building: string;
  apartment?: string;
  floor?: string;
  entrance?: string;
  cityRef: string;
  cityName: string;
  region?: string;
  postalCode?: string;
  isDefault: boolean;
  label?: string; // "Дім", "Робота", etc.
}

export interface TimeSlot {
  id: string;
  start: string; // "09:00"
  end: string; // "12:00"
  label: string;
  labelUk: string;
  price?: number;
}

export interface PaymentInfo {
  method: PaymentMethod;
  cardLast4?: string;
  cardBrand?: string;
  saveCard?: boolean;
  installmentMonths?: number;
}

export type PaymentMethod =
  | 'card'
  | 'privatbank'
  | 'monobank'
  | 'apple_pay'
  | 'google_pay'
  | 'cash'
  | 'installment';

export interface CheckoutCart {
  items: CheckoutItem[];
  itemCount: number;
  subtotal: number;
}

export interface CheckoutItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  stock: number;
  sku: string;
  variant?: string;
}

export interface AppliedCoupon {
  code: string;
  type: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  discount: number;
  description: string;
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
}

export interface CheckoutErrors {
  customer?: Record<string, string>;
  delivery?: Record<string, string>;
  payment?: Record<string, string>;
  general?: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  type: 'home' | 'work' | 'other';
  address: AddressInfo;
  isDefault: boolean;
}

export interface SavedCard {
  id: string;
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface CheckoutSession {
  id: string;
  state: CheckoutState;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  orderId?: string;
}

export interface CreateOrderInput {
  customer: CustomerInfo;
  delivery: DeliveryInfo;
  payment: PaymentInfo;
  cart: CheckoutCart;
  coupons: string[];
  notes?: string;
  saveInfo: boolean;
  isGuest: boolean;
}

export interface OrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  paymentUrl?: string;
  status: 'pending' | 'paid' | 'processing';
}

// ==================== CONSTANTS ====================

export const CHECKOUT_STEPS: { step: CheckoutStep; label: string; labelUk: string }[] = [
  { step: 'customer', label: 'Contact Info', labelUk: 'Контакти' },
  { step: 'delivery', label: 'Delivery', labelUk: 'Доставка' },
  { step: 'payment', label: 'Payment', labelUk: 'Оплата' },
  { step: 'review', label: 'Review', labelUk: 'Підтвердження' },
];

export const DELIVERY_METHODS: {
  method: DeliveryMethod;
  provider: string;
  name: string;
  nameUk: string;
  estimatedDays: string;
  icon: string;
}[] = [
  {
    method: 'nova_poshta_warehouse',
    provider: 'nova_poshta',
    name: 'Nova Poshta Branch',
    nameUk: 'Відділення Нової Пошти',
    estimatedDays: '1-2',
    icon: 'warehouse',
  },
  {
    method: 'nova_poshta_postomat',
    provider: 'nova_poshta',
    name: 'Nova Poshta Postomat',
    nameUk: 'Поштомат Нової Пошти',
    estimatedDays: '1-2',
    icon: 'postomat',
  },
  {
    method: 'nova_poshta_courier',
    provider: 'nova_poshta',
    name: 'Nova Poshta Courier',
    nameUk: 'Кур\'єр Нової Пошти',
    estimatedDays: '1-3',
    icon: 'courier',
  },
  {
    method: 'meest_warehouse',
    provider: 'meest',
    name: 'Meest Branch',
    nameUk: 'Відділення Meest',
    estimatedDays: '2-4',
    icon: 'warehouse',
  },
  {
    method: 'meest_courier',
    provider: 'meest',
    name: 'Meest Courier',
    nameUk: 'Кур\'єр Meest',
    estimatedDays: '2-5',
    icon: 'courier',
  },
  {
    method: 'justin_warehouse',
    provider: 'justin',
    name: 'Justin Branch',
    nameUk: 'Відділення Justin',
    estimatedDays: '1-3',
    icon: 'warehouse',
  },
  {
    method: 'ukrposhta',
    provider: 'ukrposhta',
    name: 'Ukrposhta',
    nameUk: 'Укрпошта',
    estimatedDays: '3-7',
    icon: 'post',
  },
  {
    method: 'pickup',
    provider: 'self',
    name: 'Store Pickup',
    nameUk: 'Самовивіз з магазину',
    estimatedDays: '0',
    icon: 'store',
  },
];

export const PAYMENT_METHODS: {
  method: PaymentMethod;
  name: string;
  nameUk: string;
  icon: string;
  popular?: boolean;
}[] = [
  { method: 'card', name: 'Credit/Debit Card', nameUk: 'Банківська картка', icon: 'card', popular: true },
  { method: 'privatbank', name: 'Privat24', nameUk: 'Приват24', icon: 'privatbank', popular: true },
  { method: 'monobank', name: 'Monobank', nameUk: 'Монобанк', icon: 'monobank' },
  { method: 'apple_pay', name: 'Apple Pay', nameUk: 'Apple Pay', icon: 'apple' },
  { method: 'google_pay', name: 'Google Pay', nameUk: 'Google Pay', icon: 'google' },
  { method: 'cash', name: 'Cash on Delivery', nameUk: 'Оплата при отриманні', icon: 'cash' },
  { method: 'installment', name: 'Pay in Installments', nameUk: 'Оплата частинами', icon: 'installment' },
];

export const TIME_SLOTS: TimeSlot[] = [
  { id: '09-12', start: '09:00', end: '12:00', label: '9 AM - 12 PM', labelUk: '9:00 - 12:00' },
  { id: '12-15', start: '12:00', end: '15:00', label: '12 PM - 3 PM', labelUk: '12:00 - 15:00' },
  { id: '15-18', start: '15:00', end: '18:00', label: '3 PM - 6 PM', labelUk: '15:00 - 18:00' },
  { id: '18-21', start: '18:00', end: '21:00', label: '6 PM - 9 PM', labelUk: '18:00 - 21:00', price: 50 },
];

export const CHECKOUT_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// ==================== VALIDATION ====================

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13;
}

export function validateCustomerInfo(customer: CustomerInfo): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!customer.email) {
    errors.email = 'Email обов\'язковий';
  } else if (!validateEmail(customer.email)) {
    errors.email = 'Невірний формат email';
  }

  if (!customer.phone) {
    errors.phone = 'Телефон обов\'язковий';
  } else if (!validatePhone(customer.phone)) {
    errors.phone = 'Невірний формат телефону';
  }

  if (!customer.firstName?.trim()) {
    errors.firstName = 'Ім\'я обов\'язкове';
  }

  if (!customer.lastName?.trim()) {
    errors.lastName = 'Прізвище обов\'язкове';
  }

  return errors;
}

export function validateDeliveryInfo(delivery: DeliveryInfo): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!delivery.method) {
    errors.method = 'Виберіть спосіб доставки';
  }

  if (delivery.method?.includes('warehouse') || delivery.method?.includes('postomat')) {
    if (!delivery.cityRef) {
      errors.city = 'Виберіть місто';
    }
    if (!delivery.warehouseRef) {
      errors.warehouse = 'Виберіть відділення';
    }
  }

  if (delivery.method?.includes('courier')) {
    if (!delivery.address?.street) {
      errors.street = 'Вкажіть вулицю';
    }
    if (!delivery.address?.building) {
      errors.building = 'Вкажіть номер будинку';
    }
  }

  return errors;
}

export function validatePaymentInfo(payment: PaymentInfo): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payment.method) {
    errors.method = 'Виберіть спосіб оплати';
  }

  if (payment.method === 'installment' && !payment.installmentMonths) {
    errors.installmentMonths = 'Виберіть кількість платежів';
  }

  return errors;
}

// ==================== CHECKOUT STATE MANAGEMENT ====================

const CHECKOUT_STATE_KEY = 'techshop_checkout';

export function getInitialCheckoutState(): CheckoutState {
  return {
    step: 'customer',
    customer: null,
    delivery: null,
    payment: null,
    cart: { items: [], itemCount: 0, subtotal: 0 },
    appliedCoupons: [],
    totals: {
      subtotal: 0,
      discount: 0,
      delivery: 0,
      total: 0,
      loyaltyPointsEarned: 0,
      loyaltyPointsUsed: 0,
    },
    errors: {},
    isGuest: true,
    saveInfo: false,
  };
}

export function saveCheckoutState(state: CheckoutState): void {
  if (typeof window === 'undefined') return;

  try {
    const data = {
      state,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save checkout state:', error);
  }
}

export function loadCheckoutState(): CheckoutState | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(CHECKOUT_STATE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Check if expired
    if (Date.now() - data.timestamp > CHECKOUT_SESSION_DURATION) {
      clearCheckoutState();
      return null;
    }

    return data.state;
  } catch {
    return null;
  }
}

export function clearCheckoutState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_STATE_KEY);
}

// ==================== CALCULATIONS ====================

export function calculateTotals(state: CheckoutState): CheckoutTotals {
  const subtotal = state.cart.subtotal;
  let discount = 0;
  let delivery = state.delivery?.price || 0;

  // Apply coupons
  state.appliedCoupons.forEach(coupon => {
    if (coupon.type === 'percent') {
      discount += subtotal * (coupon.value / 100);
    } else if (coupon.type === 'fixed') {
      discount += coupon.value;
    } else if (coupon.type === 'free_shipping') {
      delivery = 0;
    }
    discount = Math.min(discount, subtotal); // Can't be more than subtotal
  });

  // Free delivery threshold
  if (state.delivery?.isFree) {
    delivery = 0;
  }

  const total = Math.max(0, subtotal - discount + delivery - state.totals.loyaltyPointsUsed);

  // Calculate loyalty points earned (1 point per 10 UAH)
  const loyaltyPointsEarned = Math.floor(total / 10);

  return {
    subtotal,
    discount,
    delivery,
    total,
    loyaltyPointsEarned,
    loyaltyPointsUsed: state.totals.loyaltyPointsUsed,
  };
}

export function canProceedToStep(state: CheckoutState, targetStep: CheckoutStep): boolean {
  const stepOrder: CheckoutStep[] = ['customer', 'delivery', 'payment', 'review', 'complete'];
  const currentIndex = stepOrder.indexOf(state.step);
  const targetIndex = stepOrder.indexOf(targetStep);

  if (targetIndex <= currentIndex) return true;

  // Validate previous steps
  if (targetIndex > 0 && state.customer) {
    const customerErrors = validateCustomerInfo(state.customer);
    if (Object.keys(customerErrors).length > 0) return false;
  }

  if (targetIndex > 1 && state.delivery) {
    const deliveryErrors = validateDeliveryInfo(state.delivery);
    if (Object.keys(deliveryErrors).length > 0) return false;
  }

  if (targetIndex > 2 && state.payment) {
    const paymentErrors = validatePaymentInfo(state.payment);
    if (Object.keys(paymentErrors).length > 0) return false;
  }

  return true;
}

// ==================== API FUNCTIONS ====================

export async function createCheckoutSession(cartItems: CheckoutItem[]): Promise<CheckoutSession> {
  const response = await fetch('/api/checkout/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: cartItems }),
  });

  if (!response.ok) {
    throw new Error('Failed to create checkout session');
  }

  return response.json();
}

export async function updateCheckoutSession(
  sessionId: string,
  updates: Partial<CheckoutState>
): Promise<CheckoutSession> {
  const response = await fetch(`/api/checkout/session/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update checkout session');
  }

  return response.json();
}

export async function getSavedAddresses(): Promise<SavedAddress[]> {
  const response = await fetch('/api/user/addresses');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export async function saveAddress(address: AddressInfo): Promise<SavedAddress> {
  const response = await fetch('/api/user/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(address),
  });

  if (!response.ok) {
    throw new Error('Failed to save address');
  }

  return response.json();
}

export async function deleteAddress(addressId: string): Promise<void> {
  const response = await fetch(`/api/user/addresses/${addressId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete address');
  }
}

export async function getSavedCards(): Promise<SavedCard[]> {
  const response = await fetch('/api/user/cards');

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export async function deleteSavedCard(cardId: string): Promise<void> {
  const response = await fetch(`/api/user/cards/${cardId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete card');
  }
}

export async function applyCoupon(code: string): Promise<AppliedCoupon> {
  const response = await fetch('/api/checkout/coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Invalid coupon code');
  }

  return response.json();
}

export async function calculateDeliveryPrice(
  method: DeliveryMethod,
  cityRef: string,
  weight: number,
  declaredValue: number
): Promise<{ price: number; isFree: boolean; estimatedDays: string }> {
  const response = await fetch('/api/checkout/delivery-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, cityRef, weight, declaredValue }),
  });

  if (!response.ok) {
    throw new Error('Failed to calculate delivery price');
  }

  return response.json();
}

export async function createOrder(input: CreateOrderInput): Promise<OrderResult> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create order');
  }

  return response.json();
}

export async function checkEmailExists(email: string): Promise<{ exists: boolean; name?: string }> {
  const response = await fetch(`/api/checkout/check-email?email=${encodeURIComponent(email)}`);

  if (!response.ok) {
    return { exists: false };
  }

  return response.json();
}

// ==================== UTILITIES ====================

export function formatDeliveryMethod(method: DeliveryMethod): { name: string; nameUk: string } {
  const found = DELIVERY_METHODS.find(m => m.method === method);
  return found || { name: method, nameUk: method };
}

export function formatPaymentMethod(method: PaymentMethod): { name: string; nameUk: string } {
  const found = PAYMENT_METHODS.find(m => m.method === method);
  return found || { name: method, nameUk: method };
}

export function getDeliveryMethodsByProvider(provider: string): typeof DELIVERY_METHODS {
  return DELIVERY_METHODS.filter(m => m.provider === provider);
}

export function formatAddress(address: AddressInfo): string {
  const parts = [
    address.cityName,
    address.street,
    address.building && `буд. ${address.building}`,
    address.apartment && `кв. ${address.apartment}`,
  ].filter(Boolean);

  return parts.join(', ');
}

export function getStepNumber(step: CheckoutStep): number {
  const steps: CheckoutStep[] = ['customer', 'delivery', 'payment', 'review', 'complete'];
  return steps.indexOf(step) + 1;
}

export function isStepComplete(state: CheckoutState, step: CheckoutStep): boolean {
  const steps: CheckoutStep[] = ['customer', 'delivery', 'payment', 'review'];
  const stepIndex = steps.indexOf(step);
  const currentIndex = steps.indexOf(state.step);

  return stepIndex < currentIndex;
}
