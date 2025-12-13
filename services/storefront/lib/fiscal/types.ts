/**
 * Fiscal Types
 * Centralized type definitions for fiscal operations
 */

// Re-export all types from checkbox-api for convenience
export type {
  CheckboxConfig,
  CashRegister,
  Shift,
  ShiftTransaction,
  TaxInfo,
  ReceiptGood,
  ReceiptDiscount,
  ReceiptPayment,
  Receipt,
  ReceiptTax,
  CreateReceiptRequest,
  ZReport,
  ZReportTax,
} from './checkbox-api';

// Re-export all types from prro-service
export type {
  FiscalizeOrderRequest,
  OrderItem,
  PaymentInfo,
  FiscalResult,
  ShiftInfo,
  ZReportInfo,
  ShiftStatus,
  DailyReport,
  PeriodReport,
  ReceiptInfo,
} from './prro-service';

// Re-export utility types
export type { VATRate, PaymentType } from './utils';

/**
 * Environment configuration type
 */
export interface FiscalEnvironment {
  CHECKBOX_API_URL: string;
  CHECKBOX_LICENSE_KEY: string;
  CHECKBOX_CASHIER_LOGIN: string;
  CHECKBOX_CASHIER_PASSWORD: string;
  DEFAULT_TAX_RATE?: number;
}

/**
 * Company information for receipts
 */
export interface CompanyInfo {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string; // ЄДРПОУ/ІПН
  fiscalNumber?: string; // Фіскальний номер РРО
}

/**
 * Customer information
 */
export interface CustomerInfo {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  loyaltyCardNumber?: string;
}

/**
 * Product information for fiscal receipt
 */
export interface ProductInfo {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  taxRate: number;
  barcode?: string;
  uktzed?: string; // Код УКТЗЕД
  unit?: string; // шт, кг, л, etc.
}

/**
 * Order for fiscalization
 */
export interface FiscalOrder {
  id: string;
  number?: string;
  date: Date;
  items: FiscalOrderItem[];
  payments: FiscalPayment[];
  customer?: CustomerInfo;
  discount?: OrderDiscount;
  notes?: string;
}

/**
 * Order item
 */
export interface FiscalOrderItem {
  product: ProductInfo;
  quantity: number;
  price: number; // May be different from product.price if discounted
  discount?: ItemDiscount;
}

/**
 * Payment information
 */
export interface FiscalPayment {
  type: 'cash' | 'card' | 'online' | 'mixed';
  amount: number;
  cardLast4?: string;
  transactionId?: string;
  provider?: string; // Visa, Mastercard, etc.
}

/**
 * Discount types
 */
export interface OrderDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  code?: string;
  description?: string;
}

export interface ItemDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  reason?: string;
}

/**
 * Fiscal event types
 */
export enum FiscalEventType {
  SHIFT_OPENED = 'shift_opened',
  SHIFT_CLOSED = 'shift_closed',
  RECEIPT_CREATED = 'receipt_created',
  RETURN_PROCESSED = 'return_processed',
  CASH_DEPOSITED = 'cash_deposited',
  CASH_WITHDRAWN = 'cash_withdrawn',
  ERROR_OCCURRED = 'error_occurred',
}

/**
 * Fiscal event
 */
export interface FiscalEvent {
  type: FiscalEventType;
  timestamp: Date;
  data: any;
  userId?: string;
  cashierId?: string;
  success: boolean;
  error?: string;
}

/**
 * Fiscal statistics
 */
export interface FiscalStatistics {
  period: {
    from: Date;
    to: Date;
  };
  totalSales: number;
  totalReturns: number;
  netSales: number;
  receiptsCount: number;
  returnsCount: number;
  averageReceiptValue: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    online: number;
  };
  topProducts: Array<{
    sku: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  hourlyBreakdown: Array<{
    hour: number;
    receipts: number;
    revenue: number;
  }>;
}

/**
 * Cashier information
 */
export interface CashierInfo {
  id: string;
  name: string;
  inn?: string; // РНОКПП
  pin?: string;
  permissions: string[];
  isActive: boolean;
}

/**
 * Cash register information
 */
export interface CashRegisterInfo {
  id: string;
  fiscalNumber: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  registrationDate?: Date;
  isActive: boolean;
  location?: string;
}

/**
 * Z-Report details
 */
export interface ZReportDetails extends ZReportInfo {
  openedBy?: CashierInfo;
  closedBy?: CashierInfo;
  openingBalance: number;
  closingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  receipts: {
    first?: string; // First receipt number
    last?: string; // Last receipt number
  };
}

/**
 * Fiscal report filter
 */
export interface FiscalReportFilter {
  from?: Date;
  to?: Date;
  cashierId?: string;
  registerId?: string;
  paymentType?: 'cash' | 'card' | 'online';
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Fiscal error codes
 */
export enum FiscalErrorCode {
  NO_SHIFT_OPEN = 'NO_SHIFT_OPEN',
  SHIFT_ALREADY_OPEN = 'SHIFT_ALREADY_OPEN',
  NO_CASH_REGISTER = 'NO_CASH_REGISTER',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  RECEIPT_NOT_FOUND = 'RECEIPT_NOT_FOUND',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
}

/**
 * Fiscal error
 */
export interface FiscalError {
  code: FiscalErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
}

/**
 * API response wrapper
 */
export interface FiscalApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: FiscalError;
  metadata?: {
    timestamp: Date;
    requestId?: string;
    version?: string;
  };
}

/**
 * Webhook event for fiscal operations
 */
export interface FiscalWebhookEvent {
  id: string;
  type: FiscalEventType;
  timestamp: Date;
  data: any;
  signature?: string;
}

/**
 * Fiscal configuration
 */
export interface FiscalConfiguration {
  enabled: boolean;
  environment: 'production' | 'development' | 'test';
  company: CompanyInfo;
  defaultTaxRate: number;
  autoOpenShift: boolean;
  autoCloseShift: boolean;
  shiftAutoCloseTime?: string; // HH:MM format
  requireCustomerEmail: boolean;
  requireCustomerPhone: boolean;
  printReceipts: boolean;
  emailReceipts: boolean;
  smsReceipts: boolean;
  webhooks?: {
    url: string;
    events: FiscalEventType[];
    secret?: string;
  }[];
}

/**
 * Export all types as a namespace
 */
export namespace Fiscal {
  export type Config = FiscalConfiguration;
  export type Order = FiscalOrder;
  export type OrderItem = FiscalOrderItem;
  export type Payment = FiscalPayment;
  export type Event = FiscalEvent;
  export type EventType = FiscalEventType;
  export type Statistics = FiscalStatistics;
  export type Cashier = CashierInfo;
  export type Register = CashRegisterInfo;
  export type Error = FiscalError;
  export type ErrorCode = FiscalErrorCode;
  export type ApiResponse<T = any> = FiscalApiResponse<T>;
  export type ReportFilter = FiscalReportFilter;
  export type Company = CompanyInfo;
  export type Customer = CustomerInfo;
  export type Product = ProductInfo;
}
