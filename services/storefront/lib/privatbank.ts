/**
 * PrivatBank Payment Integration
 * API Documentation: https://api.privatbank.ua/
 *
 * PrivatBank is used by 40%+ of Ukrainians, making it essential for UA market
 */

import crypto from 'crypto';
import { paymentLogger } from './logger';

// Types
export interface PrivatBankPaymentData {
  merchantId: string;
  orderId: string;
  amount: number;
  currency: 'UAH' | 'USD' | 'EUR';
  description: string;
  returnUrl: string;
  serverUrl: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface PrivatBankCallbackData {
  payment: string;
  signature: string;
}

export interface PrivatBankPaymentInfo {
  id: string;
  state: PrivatBankPaymentState;
  order: string;
  amount: number;
  ccy: string;
  message: string;
  ref: string;
  payway: string;
  cardMask?: string;
  fee: number;
  date: string;
}

export type PrivatBankPaymentState =
  | 'created'      // Payment created
  | 'processing'   // Payment in progress
  | 'hold'         // Funds on hold
  | 'success'      // Payment successful
  | 'failure'      // Payment failed
  | 'reversed'     // Payment reversed
  | 'refunded';    // Payment refunded

export interface PaymentFormData {
  url: string;
  data: Record<string, string>;
}

// Configuration
const MERCHANT_ID = process.env.PRIVATBANK_MERCHANT_ID || 'test_merchant';
const MERCHANT_PASSWORD = process.env.PRIVATBANK_MERCHANT_PASSWORD || 'test_password';
const IS_SANDBOX = process.env.NODE_ENV !== 'production' || !process.env.PRIVATBANK_MERCHANT_ID;

const API_URL = IS_SANDBOX
  ? 'https://paytest.privatbank.ua/api/checkout'
  : 'https://pay.privatbank.ua/api/checkout';

/**
 * Generate signature for PrivatBank request
 */
function generateSignature(data: string): string {
  const str = MERCHANT_PASSWORD + data + MERCHANT_PASSWORD;
  return crypto.createHash('sha1').update(str, 'utf8').digest('base64');
}

/**
 * Create payment for PrivatBank checkout
 */
export function createPayment(params: {
  orderId: string;
  amount: number;
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  resultUrl?: string;
  serverUrl?: string;
}): PaymentFormData {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const paymentData: PrivatBankPaymentData = {
    merchantId: MERCHANT_ID,
    orderId: params.orderId,
    amount: params.amount,
    currency: 'UAH',
    description: params.description,
    returnUrl: params.resultUrl || `${baseUrl}/orders?payment=success`,
    serverUrl: params.serverUrl || `${baseUrl}/api/payments/privatbank/callback`,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
  };

  const jsonData = JSON.stringify(paymentData);
  const signature = generateSignature(jsonData);

  return {
    url: API_URL,
    data: {
      data: Buffer.from(jsonData).toString('base64'),
      signature,
    },
  };
}

/**
 * Verify callback signature from PrivatBank
 */
export function verifyCallback(data: string, signature: string): boolean {
  const expectedSignature = generateSignature(data);
  return signature === expectedSignature;
}

/**
 * Parse callback data from PrivatBank
 */
export function parseCallbackData(data: string): PrivatBankPaymentInfo | null {
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(decoded) as PrivatBankPaymentInfo;
  } catch (error) {
    paymentLogger.error('Failed to parse PrivatBank callback data', error);
    return null;
  }
}

/**
 * Get payment status text in Ukrainian
 */
export function getPaymentStatusText(state: PrivatBankPaymentState): string {
  const states: Record<PrivatBankPaymentState, string> = {
    created: 'Створено',
    processing: 'Обробка',
    hold: 'Кошти заблоковано',
    success: 'Оплачено',
    failure: 'Помилка оплати',
    reversed: 'Скасовано',
    refunded: 'Повернено',
  };

  return states[state] || 'Невідомий статус';
}

/**
 * Check if payment is successful
 */
export function isPaymentSuccessful(state: PrivatBankPaymentState): boolean {
  return state === 'success';
}

/**
 * Check if payment is pending
 */
export function isPaymentPending(state: PrivatBankPaymentState): boolean {
  return ['created', 'processing', 'hold'].includes(state);
}

/**
 * Check if payment failed
 */
export function isPaymentFailed(state: PrivatBankPaymentState): boolean {
  return ['failure', 'reversed'].includes(state);
}

/**
 * Get PrivatBank payment method info
 */
export const PRIVATBANK_PAYMENT_METHOD = {
  id: 'privatbank',
  name: 'Приват24',
  description: 'Оплата через Приват24 або картою ПриватБанку',
  icon: '🏦',
  enabled: true,
  popular: true, // Mark as popular for UA market
} as const;

/**
 * PrivatBank Installments (Оплата частинами)
 */
export interface InstallmentPlan {
  id: string;
  months: number;
  monthlyPayment: number;
  totalAmount: number;
  interestRate: number;
  description: string;
}

/**
 * Calculate available installment plans
 */
export function calculateInstallmentPlans(amount: number): InstallmentPlan[] {
  // PrivatBank standard installment options
  const options = [
    { months: 2, rate: 0 },      // 2 months, 0%
    { months: 3, rate: 0 },      // 3 months, 0% (popular)
    { months: 4, rate: 0 },      // 4 months, 0%
    { months: 6, rate: 0.025 },  // 6 months, 2.5%
    { months: 10, rate: 0.05 },  // 10 months, 5%
    { months: 12, rate: 0.07 },  // 12 months, 7%
    { months: 24, rate: 0.15 },  // 24 months, 15%
  ];

  // Minimum amount for installments is 500 UAH
  if (amount < 500) {
    return [];
  }

  return options.map(opt => {
    const totalAmount = amount * (1 + opt.rate);
    const monthlyPayment = Math.ceil(totalAmount / opt.months);

    return {
      id: `installment_${opt.months}`,
      months: opt.months,
      monthlyPayment,
      totalAmount: Math.round(totalAmount),
      interestRate: opt.rate * 100,
      description: opt.rate === 0
        ? `${opt.months} платежі без переплат`
        : `${opt.months} платежів (${opt.rate * 100}% річних)`,
    };
  });
}

/**
 * Create installment payment request
 */
export function createInstallmentPayment(params: {
  orderId: string;
  amount: number;
  description: string;
  months: number;
  customerPhone: string;
  customerEmail?: string;
  resultUrl?: string;
  serverUrl?: string;
}): PaymentFormData {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const paymentData = {
    merchantId: MERCHANT_ID,
    orderId: params.orderId,
    amount: params.amount,
    currency: 'UAH',
    description: params.description,
    partsCount: params.months,
    returnUrl: params.resultUrl || `${baseUrl}/orders?payment=success`,
    serverUrl: params.serverUrl || `${baseUrl}/api/payments/privatbank/callback`,
    customerPhone: params.customerPhone,
    customerEmail: params.customerEmail,
    paymentType: 'parts', // Оплата частинами
  };

  const jsonData = JSON.stringify(paymentData);
  const signature = generateSignature(jsonData);

  return {
    url: `${API_URL}/parts`,
    data: {
      data: Buffer.from(jsonData).toString('base64'),
      signature,
    },
  };
}
