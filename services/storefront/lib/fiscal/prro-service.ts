/**
 * ПРРО Service - Ukrainian Fiscal Service
 * Handles fiscalization of orders and receipts
 */

import {
  CheckboxClient,
  type CheckboxConfig,
  type Receipt,
  type ReceiptGood,
  type ReceiptPayment,
  type Shift,
  type ZReport,
  type TaxInfo,
  type CreateReceiptRequest,
} from './checkbox-api';

// ============================================================
// Request/Response Types
// ============================================================

export interface FiscalizeOrderRequest {
  orderId: string;
  items: OrderItem[];
  payments: PaymentInfo[];
  customer?: {
    email?: string;
    phone?: string;
  };
  header?: string;
  footer?: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  price: number; // in UAH
  quantity: number;
  taxRate?: number; // 0, 7, 20
  uktzed?: string;
  barcode?: string;
}

export interface PaymentInfo {
  type: 'cash' | 'card' | 'online';
  amount: number; // in UAH
}

export interface FiscalResult {
  success: boolean;
  fiscalCode?: string;
  receiptId?: string;
  receiptUrl?: string;
  qrCodeUrl?: string;
  pdfUrl?: string;
  receiptText?: string;
  error?: string;
}

export interface ShiftInfo {
  id: string;
  serial: number;
  status: 'OPENED' | 'CLOSED';
  openedAt: Date;
  closedAt?: Date;
  balance: number; // in UAH
  receiptsCount: number;
  totalSales: number; // in UAH
  totalReturns: number; // in UAH
}

export interface ZReportInfo {
  id: string;
  serial: number;
  fiscalCode?: string;
  createdAt: Date;
  paymentsSum: number; // in UAH
  returnsSum: number; // in UAH
  receiptsCount: number;
  returnsCount: number;
  taxes: {
    rate: number;
    label: string;
    sellSum: number; // in UAH
    returnSum: number; // in UAH
  }[];
}

export interface ShiftStatus {
  isOpen: boolean;
  shift?: ShiftInfo;
}

export interface DailyReport {
  date: Date;
  totalSales: number; // in UAH
  totalReturns: number; // in UAH
  receiptsCount: number;
  returnsCount: number;
  cashPayments: number; // in UAH
  cardPayments: number; // in UAH
  onlinePayments: number; // in UAH
  shifts: ShiftInfo[];
}

export interface PeriodReport {
  from: Date;
  to: Date;
  totalSales: number; // in UAH
  totalReturns: number; // in UAH
  receiptsCount: number;
  returnsCount: number;
  dailyReports: DailyReport[];
}

export interface ReceiptInfo {
  id: string;
  fiscalCode: string;
  type: 'SELL' | 'RETURN';
  date: Date;
  total: number; // in UAH
  items: {
    name: string;
    quantity: number;
    price: number; // in UAH
    total: number; // in UAH
  }[];
  payments: {
    type: string;
    amount: number; // in UAH
  }[];
  pdfUrl?: string;
  qrCodeUrl?: string;
}

// ============================================================
// PRRO Service Class
// ============================================================

export class PRROService {
  private checkboxClient: CheckboxClient;
  private isInitialized: boolean = false;
  private taxCache: TaxInfo[] = [];

  constructor(config?: CheckboxConfig) {
    // Default config - should be loaded from environment variables
    const defaultConfig: CheckboxConfig = {
      apiUrl: process.env.CHECKBOX_API_URL || 'https://api.checkbox.ua/api/v1',
      licenseKey: process.env.CHECKBOX_LICENSE_KEY || '',
      cashierLogin: process.env.CHECKBOX_CASHIER_LOGIN || '',
      cashierPassword: process.env.CHECKBOX_CASHIER_PASSWORD || '',
    };

    this.checkboxClient = new CheckboxClient(config || defaultConfig);
  }

  /**
   * Initialize service - sign in and select cash register
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Sign in
      await this.checkboxClient.signIn();

      // Get and select first active cash register
      const registers = await this.checkboxClient.getCashRegisters();
      const activeRegister = registers.find((r) => r.active);

      if (!activeRegister) {
        throw new Error('No active cash register found');
      }

      await this.checkboxClient.selectCashRegister(activeRegister.id);

      // Cache tax information
      this.taxCache = await this.checkboxClient.getTaxes();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize PRRO service: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // ============================================================
  // Fiscalization
  // ============================================================

  /**
   * Fiscalize an order (create fiscal receipt)
   */
  async fiscalizeOrder(request: FiscalizeOrderRequest): Promise<FiscalResult> {
    try {
      await this.ensureInitialized();

      // Convert items to receipt goods
      const goods: ReceiptGood[] = request.items.map((item) => ({
        good: {
          code: item.sku,
          name: item.name,
          barcode: item.barcode,
          uktzed: item.uktzed,
          price: this.checkboxClient.formatAmount(item.price),
        },
        quantity: Math.round(item.quantity * 1000), // Convert to Checkbox format
        taxes: this.getTaxIdsForRate(item.taxRate || 20),
      }));

      // Convert payments
      const payments: ReceiptPayment[] = request.payments.map((payment) => ({
        type: this.mapPaymentType(payment.type),
        value: this.checkboxClient.formatAmount(payment.amount),
        label: this.getPaymentLabel(payment.type),
      }));

      // Create receipt request
      const receiptRequest: CreateReceiptRequest = {
        goods,
        payments,
        header: request.header,
        footer: request.footer,
        delivery: request.customer,
      };

      // Create receipt
      const receipt = await this.checkboxClient.createReceipt(receiptRequest);

      return {
        success: true,
        fiscalCode: receipt.fiscal_code,
        receiptId: receipt.id,
        receiptUrl: receipt.pdf_url,
        qrCodeUrl: receipt.qr_code_url,
        pdfUrl: receipt.pdf_url,
        receiptText: receipt.text,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Fiscalize a return/refund
   */
  async fiscalizeReturn(
    originalFiscalCode: string,
    items: OrderItem[]
  ): Promise<FiscalResult> {
    try {
      await this.ensureInitialized();

      // Find original receipt by fiscal code
      const receipts = await this.checkboxClient.searchReceipts({
        fiscal_code: originalFiscalCode,
      });

      if (receipts.length === 0) {
        throw new Error(`Receipt with fiscal code ${originalFiscalCode} not found`);
      }

      const originalReceipt = receipts[0];

      // Convert items to receipt goods
      const goods: ReceiptGood[] = items.map((item) => ({
        good: {
          code: item.sku,
          name: item.name,
          barcode: item.barcode,
          uktzed: item.uktzed,
          price: this.checkboxClient.formatAmount(item.price),
        },
        quantity: Math.round(item.quantity * 1000),
        is_return: true,
        taxes: this.getTaxIdsForRate(item.taxRate || 20),
      }));

      // Create return receipt
      const receipt = await this.checkboxClient.createReturnReceipt(
        originalReceipt.id,
        goods
      );

      return {
        success: true,
        fiscalCode: receipt.fiscal_code,
        receiptId: receipt.id,
        receiptUrl: receipt.pdf_url,
        qrCodeUrl: receipt.qr_code_url,
        pdfUrl: receipt.pdf_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================
  // Shift Management
  // ============================================================

  /**
   * Open cashier shift
   */
  async openCashierShift(cashierId: string): Promise<ShiftInfo> {
    await this.ensureInitialized();

    const shift = await this.checkboxClient.openShift();

    return this.mapShiftToInfo(shift);
  }

  /**
   * Close cashier shift and generate Z-report
   */
  async closeCashierShift(cashierId: string): Promise<ZReportInfo> {
    await this.ensureInitialized();

    const zReport = await this.checkboxClient.closeShift();

    return this.mapZReportToInfo(zReport);
  }

  /**
   * Get current shift status
   */
  async getShiftStatus(cashierId: string): Promise<ShiftStatus> {
    await this.ensureInitialized();

    const shift = await this.checkboxClient.getCurrentShift();

    if (!shift) {
      return { isOpen: false };
    }

    return {
      isOpen: shift.status === 'OPENED',
      shift: this.mapShiftToInfo(shift),
    };
  }

  // ============================================================
  // Service Operations
  // ============================================================

  /**
   * Deposit cash (службове внесення)
   */
  async depositCash(amount: number): Promise<FiscalResult> {
    try {
      await this.ensureInitialized();

      const receipt = await this.checkboxClient.serviceDeposit(amount);

      return {
        success: true,
        fiscalCode: receipt.fiscal_code,
        receiptId: receipt.id,
        receiptUrl: receipt.pdf_url,
        qrCodeUrl: receipt.qr_code_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Withdraw cash (службове винесення)
   */
  async withdrawCash(amount: number): Promise<FiscalResult> {
    try {
      await this.ensureInitialized();

      const receipt = await this.checkboxClient.serviceWithdraw(amount);

      return {
        success: true,
        fiscalCode: receipt.fiscal_code,
        receiptId: receipt.id,
        receiptUrl: receipt.pdf_url,
        qrCodeUrl: receipt.qr_code_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================
  // Reports
  // ============================================================

  /**
   * Generate Z-report (close shift)
   */
  async generateZReport(): Promise<ZReportInfo> {
    await this.ensureInitialized();

    const zReport = await this.checkboxClient.closeShift();

    return this.mapZReportToInfo(zReport);
  }

  /**
   * Get daily report
   */
  async getDailyReport(date: Date): Promise<DailyReport> {
    await this.ensureInitialized();

    // Get period report for the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const periodReport = await this.checkboxClient.getPeriodReport(
      startOfDay,
      endOfDay
    );

    // TODO: Parse and map period report to DailyReport
    // This depends on the actual structure returned by Checkbox API
    return {
      date,
      totalSales: 0,
      totalReturns: 0,
      receiptsCount: 0,
      returnsCount: 0,
      cashPayments: 0,
      cardPayments: 0,
      onlinePayments: 0,
      shifts: [],
    };
  }

  /**
   * Get period report
   */
  async getPeriodReport(from: Date, to: Date): Promise<PeriodReport> {
    await this.ensureInitialized();

    const periodReport = await this.checkboxClient.getPeriodReport(from, to);

    // TODO: Parse and map period report to PeriodReport
    return {
      from,
      to,
      totalSales: 0,
      totalReturns: 0,
      receiptsCount: 0,
      returnsCount: 0,
      dailyReports: [],
    };
  }

  /**
   * Get X-report (intermediate report without closing shift)
   */
  async getXReport(): Promise<any> {
    await this.ensureInitialized();

    return this.checkboxClient.getXReport();
  }

  // ============================================================
  // Receipt Operations
  // ============================================================

  /**
   * Get receipt by fiscal code
   */
  async getReceiptByFiscalCode(fiscalCode: string): Promise<ReceiptInfo | null> {
    await this.ensureInitialized();

    const receipts = await this.checkboxClient.searchReceipts({
      fiscal_code: fiscalCode,
    });

    if (receipts.length === 0) {
      return null;
    }

    return this.mapReceiptToInfo(receipts[0]);
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(receiptId: string): Promise<ReceiptInfo | null> {
    try {
      await this.ensureInitialized();

      const receipt = await this.checkboxClient.getReceipt(receiptId);
      return this.mapReceiptToInfo(receipt);
    } catch {
      return null;
    }
  }

  /**
   * Resend receipt to customer
   */
  async resendReceiptToCustomer(receiptId: string, email: string): Promise<void> {
    await this.ensureInitialized();

    // Note: Checkbox API doesn't have a direct resend endpoint
    // You would need to implement this by getting the receipt and sending via email service
    const receipt = await this.checkboxClient.getReceipt(receiptId);

    // TODO: Implement email sending logic
    console.log(`Would send receipt ${receipt.fiscal_code} to ${email}`);
  }

  /**
   * Get receipt PDF
   */
  async getReceiptPdf(receiptId: string): Promise<Buffer> {
    await this.ensureInitialized();

    return this.checkboxClient.getReceiptPdf(receiptId);
  }

  /**
   * Get receipt text for printing
   */
  async getReceiptText(receiptId: string): Promise<string> {
    await this.ensureInitialized();

    return this.checkboxClient.getReceiptText(receiptId);
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Check service health
   */
  async checkHealth(): Promise<boolean> {
    try {
      return await this.checkboxClient.ping();
    } catch {
      return false;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.checkboxClient.signOut();
    this.isInitialized = false;
    this.taxCache = [];
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  private mapPaymentType(type: string): 'CASH' | 'CASHLESS' | 'CARD' {
    switch (type.toLowerCase()) {
      case 'cash':
        return 'CASH';
      case 'card':
        return 'CARD';
      case 'online':
        return 'CASHLESS';
      default:
        return 'CASHLESS';
    }
  }

  private getPaymentLabel(type: string): string {
    switch (type.toLowerCase()) {
      case 'cash':
        return 'Готівка';
      case 'card':
        return 'Картка';
      case 'online':
        return 'Безготівковий';
      default:
        return 'Оплата';
    }
  }

  private getTaxIdsForRate(rate: number): number[] {
    // Find tax by rate
    const tax = this.taxCache.find((t) => t.rate === rate);
    return tax ? [parseInt(tax.id)] : [];
  }

  private mapShiftToInfo(shift: Shift): ShiftInfo {
    return {
      id: shift.id,
      serial: shift.serial,
      status: shift.status,
      openedAt: new Date(shift.opened_at),
      closedAt: shift.closed_at ? new Date(shift.closed_at) : undefined,
      balance: this.checkboxClient.parseAmount(shift.balance),
      receiptsCount: 0, // Would need to fetch this separately
      totalSales: 0, // Would need to fetch this separately
      totalReturns: 0, // Would need to fetch this separately
    };
  }

  private mapZReportToInfo(zReport: ZReport): ZReportInfo {
    return {
      id: zReport.id,
      serial: zReport.serial,
      fiscalCode: zReport.fiscal_code,
      createdAt: new Date(zReport.created_at),
      paymentsSum: this.checkboxClient.parseAmount(zReport.payments_sum),
      returnsSum: this.checkboxClient.parseAmount(zReport.returns_sum),
      receiptsCount: zReport.receipts_count,
      returnsCount: zReport.returns_count,
      taxes: zReport.taxes.map((tax) => ({
        rate: tax.rate,
        label: tax.label,
        sellSum: this.checkboxClient.parseAmount(tax.sell_sum),
        returnSum: this.checkboxClient.parseAmount(tax.return_sum),
      })),
    };
  }

  private mapReceiptToInfo(receipt: Receipt): ReceiptInfo {
    return {
      id: receipt.id,
      fiscalCode: receipt.fiscal_code,
      type: receipt.type,
      date: new Date(receipt.fiscal_date),
      total: this.checkboxClient.parseAmount(receipt.total_sum),
      items: receipt.goods.map((good) => ({
        name: good.good.name,
        quantity: good.quantity / 1000,
        price: this.checkboxClient.parseAmount(good.good.price),
        total: this.checkboxClient.parseAmount(
          (good.good.price * good.quantity) / 1000
        ),
      })),
      payments: receipt.payments.map((payment) => ({
        type: payment.type,
        amount: this.checkboxClient.parseAmount(payment.value),
      })),
      pdfUrl: receipt.pdf_url,
      qrCodeUrl: receipt.qr_code_url,
    };
  }
}

// ============================================================
// Singleton Export
// ============================================================

let prroServiceInstance: PRROService | null = null;

export function getPRROService(): PRROService {
  if (!prroServiceInstance) {
    prroServiceInstance = new PRROService();
  }
  return prroServiceInstance;
}

// Export singleton
export const prroService = getPRROService();
