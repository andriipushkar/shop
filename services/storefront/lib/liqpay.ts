/**
 * LiqPay Payment Integration
 * API Documentation: https://www.liqpay.ua/documentation
 */

import crypto from 'crypto';
import { paymentLogger } from './logger';

// Types
export interface LiqPayPaymentData {
  version: number;
  public_key: string;
  action: 'pay' | 'hold' | 'subscribe' | 'paydonate';
  amount: number;
  currency: 'UAH' | 'USD' | 'EUR';
  description: string;
  order_id: string;
  result_url?: string;
  server_url?: string;
  language?: 'uk' | 'ru' | 'en';
  sandbox?: number;
  expired_date?: string;
  split_rules?: string;
  sender_first_name?: string;
  sender_last_name?: string;
  sender_email?: string;
  sender_phone?: string;
  product_url?: string;
  product_category?: string;
  product_name?: string;
  product_description?: string;
}

export interface LiqPayCallbackData {
  action: string;
  payment_id: number;
  status: LiqPayStatus;
  version: number;
  type: string;
  paytype: string;
  public_key: string;
  acq_id: number;
  order_id: string;
  liqpay_order_id: string;
  description: string;
  sender_phone: string;
  sender_card_mask2: string;
  sender_card_bank: string;
  sender_card_type: string;
  sender_card_country: number;
  ip: string;
  amount: number;
  currency: string;
  sender_commission: number;
  receiver_commission: number;
  agent_commission: number;
  amount_debit: number;
  amount_credit: number;
  commission_debit: number;
  commission_credit: number;
  currency_debit: string;
  currency_credit: string;
  sender_bonus: number;
  amount_bonus: number;
  mpi_eci: string;
  is_3ds: boolean;
  create_date: number;
  end_date: number;
  transaction_id: number;
}

export type LiqPayStatus =
  | 'success'       // Успішний платіж
  | 'failure'       // Неуспішний платіж
  | 'error'         // Помилка
  | 'wait_secure'   // Очікується підтвердження
  | 'wait_accept'   // Очікується підтвердження
  | 'wait_card'     // Очікується введення карти
  | 'wait_sender'   // Очікується дані відправника
  | 'wait_reserve'  // Очікується резервування
  | 'hold_wait'     // Очікується підтвердження холду
  | 'cash_wait'     // Очікується готівкової оплати
  | 'processing'    // Платіж обробляється
  | 'prepared'      // Платіж підготовлено
  | 'reversed'      // Платіж скасовано
  | 'subscribed'    // Підписка активна
  | 'unsubscribed'; // Підписка скасована

export interface PaymentFormData {
  data: string;
  signature: string;
}

export interface PaymentResult {
  success: boolean;
  status: LiqPayStatus;
  orderId: string;
  amount: number;
  error?: string;
}

// Configuration
const PUBLIC_KEY = process.env.NEXT_PUBLIC_LIQPAY_PUBLIC_KEY || 'sandbox_public_key';
const PRIVATE_KEY = process.env.LIQPAY_PRIVATE_KEY || 'sandbox_private_key';
const IS_SANDBOX = process.env.NODE_ENV !== 'production' || !process.env.LIQPAY_PRIVATE_KEY;

/**
 * Generate Base64 encoded data
 */
function encodeBase64(data: string): string {
  if (typeof window !== 'undefined') {
    return btoa(unescape(encodeURIComponent(data)));
  }
  return Buffer.from(data).toString('base64');
}

/**
 * Decode Base64 data
 */
function decodeBase64(data: string): string {
  if (typeof window !== 'undefined') {
    return decodeURIComponent(escape(atob(data)));
  }
  return Buffer.from(data, 'base64').toString('utf-8');
}

/**
 * Generate SHA1 signature
 */
function generateSignature(data: string): string {
  if (typeof window !== 'undefined') {
    // Client-side: use Web Crypto API (async) - for now use simple hash
    // In production, signature should be generated server-side
    paymentLogger.warn('Signature generation should be done server-side');
    return '';
  }
  const str = PRIVATE_KEY + data + PRIVATE_KEY;
  return crypto.createHash('sha1').update(str).digest('base64');
}

/**
 * Create payment form data for LiqPay checkout
 */
export function createPaymentFormData(params: {
  orderId: string;
  amount: number;
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  resultUrl?: string;
  serverUrl?: string;
}): PaymentFormData {
  const paymentData: LiqPayPaymentData = {
    version: 3,
    public_key: PUBLIC_KEY,
    action: 'pay',
    amount: params.amount,
    currency: 'UAH',
    description: params.description,
    order_id: params.orderId,
    result_url: params.resultUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/orders?payment=success`,
    server_url: params.serverUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/liqpay/callback`,
    language: 'uk',
    sandbox: IS_SANDBOX ? 1 : 0,
    sender_email: params.customerEmail,
    sender_phone: params.customerPhone,
    sender_first_name: params.customerName?.split(' ')[0],
    sender_last_name: params.customerName?.split(' ').slice(1).join(' '),
  };

  // Remove undefined values
  const cleanData = Object.fromEntries(
    Object.entries(paymentData).filter(([, v]) => v !== undefined)
  );

  const jsonData = JSON.stringify(cleanData);
  const data = encodeBase64(jsonData);
  const signature = generateSignature(data);

  return { data, signature };
}

/**
 * Verify callback signature from LiqPay
 */
export function verifyCallback(data: string, signature: string): boolean {
  const expectedSignature = generateSignature(data);
  return signature === expectedSignature;
}

/**
 * Parse callback data from LiqPay
 */
export function parseCallbackData(data: string): LiqPayCallbackData | null {
  try {
    const decoded = decodeBase64(data);
    return JSON.parse(decoded) as LiqPayCallbackData;
  } catch (error) {
    paymentLogger.error('Failed to parse LiqPay callback data', error);
    return null;
  }
}

/**
 * Get payment status text in Ukrainian
 */
export function getPaymentStatusText(status: LiqPayStatus): string {
  const statuses: Record<LiqPayStatus, string> = {
    success: 'Оплачено',
    failure: 'Помилка оплати',
    error: 'Помилка',
    wait_secure: 'Очікує підтвердження 3DS',
    wait_accept: 'Очікує підтвердження',
    wait_card: 'Введіть дані картки',
    wait_sender: 'Введіть дані відправника',
    wait_reserve: 'Резервування коштів',
    hold_wait: 'Кошти заблоковано',
    cash_wait: 'Очікує оплати готівкою',
    processing: 'Обробка платежу',
    prepared: 'Платіж підготовлено',
    reversed: 'Платіж скасовано',
    subscribed: 'Підписка активна',
    unsubscribed: 'Підписка скасована',
  };

  return statuses[status] || 'Невідомий статус';
}

/**
 * Check if payment is successful
 */
export function isPaymentSuccessful(status: LiqPayStatus): boolean {
  return status === 'success';
}

/**
 * Check if payment is pending
 */
export function isPaymentPending(status: LiqPayStatus): boolean {
  return [
    'wait_secure',
    'wait_accept',
    'wait_card',
    'wait_sender',
    'wait_reserve',
    'hold_wait',
    'cash_wait',
    'processing',
    'prepared',
  ].includes(status);
}

/**
 * Check if payment failed
 */
export function isPaymentFailed(status: LiqPayStatus): boolean {
  return ['failure', 'error', 'reversed'].includes(status);
}

/**
 * Generate LiqPay checkout URL (for redirect-based payment)
 */
export function getCheckoutUrl(): string {
  return 'https://www.liqpay.ua/api/3/checkout';
}

/**
 * Payment methods available
 */
export const PAYMENT_METHODS = [
  {
    id: 'liqpay',
    name: 'Картка онлайн (LiqPay)',
    description: 'Visa, Mastercard, Google Pay, Apple Pay',
    icon: '💳',
    enabled: true,
  },
  {
    id: 'monobank',
    name: 'Monobank',
    description: 'Оплата через Monobank Acquiring',
    icon: '🏦',
    enabled: true,
  },
  {
    id: 'cash',
    name: 'Готівкою',
    description: 'При отриманні у відділенні',
    icon: '💵',
    enabled: true,
  },
  {
    id: 'cod',
    name: 'Накладений платіж',
    description: 'Оплата при отриманні + комісія',
    icon: '📦',
    enabled: true,
  },
] as const;

export type PaymentMethodId = typeof PAYMENT_METHODS[number]['id'];

/**
 * Calculate COD (cash on delivery) commission
 */
export function calculateCODCommission(amount: number): number {
  // Nova Poshta COD commission: 2% + 20 UAH (min 30 UAH)
  const commission = Math.max(30, amount * 0.02 + 20);
  return Math.round(commission);
}
