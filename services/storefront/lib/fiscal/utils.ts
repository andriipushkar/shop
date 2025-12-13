/**
 * Fiscal Utilities
 * Helper functions for fiscal operations
 */

import type { OrderItem, PaymentInfo } from './prro-service';

/**
 * Ukrainian VAT rates
 */
export const UkrainianVATRates = {
  ZERO: 0, // Export, some medical supplies
  REDUCED: 7, // Pharmaceuticals, some food products
  STANDARD: 20, // Standard rate
} as const;

/**
 * Payment types
 */
export const PaymentTypes = {
  CASH: 'cash',
  CARD: 'card',
  ONLINE: 'online',
} as const;

/**
 * Calculate VAT amount from total
 */
export function calculateVAT(total: number, rate: number): number {
  return (total * rate) / (100 + rate);
}

/**
 * Calculate price without VAT
 */
export function calculatePriceWithoutVAT(priceWithVAT: number, rate: number): number {
  return priceWithVAT / (1 + rate / 100);
}

/**
 * Calculate price with VAT
 */
export function calculatePriceWithVAT(priceWithoutVAT: number, rate: number): number {
  return priceWithoutVAT * (1 + rate / 100);
}

/**
 * Validate fiscal code format
 */
export function isValidFiscalCode(fiscalCode: string): boolean {
  // Fiscal codes are typically alphanumeric and 8-20 characters
  return /^[A-Z0-9]{8,20}$/i.test(fiscalCode);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'UAH'): string {
  const symbols: Record<string, string> = {
    UAH: 'грн',
    USD: '$',
    EUR: '€',
  };

  return `${amount.toFixed(2)} ${symbols[currency] || currency}`;
}

/**
 * Validate Ukrainian phone number
 */
export function validateUkrainianPhone(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Valid formats:
  // +380XXXXXXXXX (12 digits)
  // 380XXXXXXXXX (11 digits)
  // 0XXXXXXXXX (10 digits)
  return (
    (digits.length === 12 && digits.startsWith('380')) ||
    (digits.length === 11 && digits.startsWith('380')) ||
    (digits.length === 10 && digits.startsWith('0'))
  );
}

/**
 * Format Ukrainian phone number to international format
 */
export function formatUkrainianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('380')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+380${digits.substring(1)}`;
  }

  return `+380${digits}`;
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Calculate total from order items
 */
export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((total, item) => total + item.price * item.quantity, 0);
}

/**
 * Calculate total from payments
 */
export function calculatePaymentsTotal(payments: PaymentInfo[]): number {
  return payments.reduce((total, payment) => total + payment.amount, 0);
}

/**
 * Validate that order total matches payments total
 */
export function validateOrderPayments(
  items: OrderItem[],
  payments: PaymentInfo[],
  tolerance: number = 0.01
): { valid: boolean; itemsTotal: number; paymentsTotal: number; difference: number } {
  const itemsTotal = calculateOrderTotal(items);
  const paymentsTotal = calculatePaymentsTotal(payments);
  const difference = Math.abs(itemsTotal - paymentsTotal);

  return {
    valid: difference <= tolerance,
    itemsTotal,
    paymentsTotal,
    difference,
  };
}

/**
 * Split payment amount across multiple methods
 */
export function splitPayment(
  total: number,
  cashAmount: number
): { cash: number; card: number } {
  const cash = Math.min(total, cashAmount);
  const card = Math.max(0, total - cash);

  return { cash, card };
}

/**
 * Calculate change
 */
export function calculateChange(total: number, tendered: number): number {
  return Math.max(0, tendered - total);
}

/**
 * Round to kopecks (2 decimal places)
 */
export function roundToKopecks(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Generate receipt header with company info
 */
export function generateReceiptHeader(companyInfo: {
  name: string;
  address?: string;
  phone?: string;
  taxId?: string;
}): string {
  const lines = [companyInfo.name];

  if (companyInfo.address) {
    lines.push(companyInfo.address);
  }

  if (companyInfo.phone) {
    lines.push(`Тел: ${companyInfo.phone}`);
  }

  if (companyInfo.taxId) {
    lines.push(`ЄДРПОУ/ІПН: ${companyInfo.taxId}`);
  }

  return lines.join('\n');
}

/**
 * Generate receipt footer with thank you message
 */
export function generateReceiptFooter(customMessage?: string): string {
  const defaultMessage = 'Дякуємо за покупку!\nБудемо раді бачити Вас знову!';
  return customMessage || defaultMessage;
}

/**
 * Check if receipt is eligible for return
 */
export function isReceiptEligibleForReturn(
  receiptDate: Date,
  maxDays: number = 14
): boolean {
  const now = new Date();
  const diffMs = now.getTime() - receiptDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= maxDays;
}

/**
 * Format date for fiscal operations (ISO format)
 */
export function formatFiscalDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse fiscal date
 */
export function parseFiscalDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Get shift date range (from 00:00 to 23:59)
 */
export function getShiftDateRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  from.setHours(0, 0, 0, 0);

  const to = new Date(date);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

/**
 * Get week date range (Monday to Sunday)
 */
export function getWeekDateRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date);
  const day = from.getDay();
  const diff = from.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  from.setDate(diff);
  from.setHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

/**
 * Get month date range
 */
export function getMonthDateRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  from.setHours(0, 0, 0, 0);

  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

/**
 * Format shift time duration
 */
export function formatShiftDuration(openedAt: Date, closedAt?: Date): string {
  const end = closedAt || new Date();
  const diffMs = end.getTime() - openedAt.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}г ${minutes}хв`;
}

/**
 * Generate barcode check digit (EAN-13)
 */
export function generateEAN13CheckDigit(barcode: string): string {
  if (barcode.length !== 12) {
    throw new Error('Barcode must be 12 digits');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return barcode + checkDigit;
}

/**
 * Validate EAN-13 barcode
 */
export function validateEAN13(barcode: string): boolean {
  if (!/^\d{13}$/.test(barcode)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(barcode[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(barcode[12]);
}

/**
 * Format receipt number
 */
export function formatReceiptNumber(serial: number, prefix: string = ''): string {
  return `${prefix}${serial.toString().padStart(6, '0')}`;
}

/**
 * Fiscal compliance check
 */
export function checkFiscalCompliance(config: {
  hasLicense: boolean;
  hasCashRegister: boolean;
  isRegisteredWithTax: boolean;
}): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!config.hasLicense) {
    issues.push('Відсутня ліцензія на програмне забезпечення');
  }

  if (!config.hasCashRegister) {
    issues.push('Не зареєстрований касовий апарат');
  }

  if (!config.isRegisteredWithTax) {
    issues.push('Не зареєстровано в податковій');
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

/**
 * Export types for convenience
 */
export type VATRate = (typeof UkrainianVATRates)[keyof typeof UkrainianVATRates];
export type PaymentType = (typeof PaymentTypes)[keyof typeof PaymentTypes];
