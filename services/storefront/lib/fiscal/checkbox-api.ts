/**
 * Checkbox ПРРО Integration
 * Інтеграція з програмним реєстратором розрахункових операцій
 * Документація: https://docs.checkbox.ua/
 */

// Types for Checkbox API
export interface CheckboxConfig {
  apiUrl: string; // 'https://api.checkbox.ua/api/v1' for prod
  licenseKey: string;
  cashierLogin: string;
  cashierPassword: string;
}

export interface CashRegister {
  id: string;
  fiscal_number: string;
  active: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  serial: number;
  status: 'OPENED' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  initial_transaction: ShiftTransaction;
  closing_transaction?: ShiftTransaction;
  balance: number;
  taxes: TaxInfo[];
}

export interface ShiftTransaction {
  id: string;
  type: string;
  datetime: string;
  balance: number;
}

export interface TaxInfo {
  id: string;
  code: number;
  label: string;
  symbol: string;
  rate: number;
  extra_rate?: number;
  included: boolean;
}

export interface ReceiptGood {
  good: {
    code: string;
    name: string;
    barcode?: string;
    excise_barcode?: string;
    uktzed?: string; // код УКТЗЕД
    price: number; // in kopecks
  };
  quantity: number; // 1000 = 1 piece
  is_return?: boolean;
  discounts?: ReceiptDiscount[];
  taxes?: number[]; // tax ids
}

export interface ReceiptDiscount {
  type: 'DISCOUNT' | 'EXTRA_CHARGE';
  mode: 'PERCENT' | 'VALUE';
  value: number;
  name?: string;
}

export interface ReceiptPayment {
  type: 'CASH' | 'CASHLESS' | 'CARD';
  value: number; // in kopecks
  label?: string;
}

export interface Receipt {
  id: string;
  type: 'SELL' | 'RETURN';
  fiscal_code: string;
  fiscal_date: string;
  serial: number;
  total_sum: number;
  total_payment: number;
  total_rest: number;
  goods: ReceiptGood[];
  payments: ReceiptPayment[];
  taxes: ReceiptTax[];
  pdf_url?: string;
  qr_code_url?: string;
  text?: string;
}

export interface ReceiptTax {
  id: string;
  code: number;
  label: string;
  symbol: string;
  rate: number;
  value: number;
}

export interface CreateReceiptRequest {
  goods: ReceiptGood[];
  payments: ReceiptPayment[];
  discounts?: ReceiptDiscount[];
  header?: string;
  footer?: string;
  barcode?: string;
  delivery?: {
    email?: string;
    phone?: string;
  };
}

export interface ZReport {
  id: string;
  serial: number;
  fiscal_code?: string;
  created_at: string;
  payments_sum: number;
  returns_sum: number;
  receipts_count: number;
  returns_count: number;
  taxes: ZReportTax[];
}

export interface ZReportTax {
  rate: number;
  label: string;
  sell_sum: number;
  return_sum: number;
  sales_turnover: number;
  returns_turnover: number;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface CashierProfile {
  id: string;
  full_name: string;
  nin: string; // РНОКПП (ІПН)
  key_id: string;
  signature_type: string;
  permissions: string[];
}

// Main Checkbox client class
export class CheckboxClient {
  private config: CheckboxConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private cashRegisterId: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: CheckboxConfig) {
    this.config = config;
  }

  // ============================================================
  // Authentication
  // ============================================================

  /**
   * Sign in to Checkbox and get access token
   */
  async signIn(): Promise<void> {
    const response = await this.request<AuthResponse>('/cashier/signin', {
      method: 'POST',
      body: JSON.stringify({
        login: this.config.cashierLogin,
        password: this.config.cashierPassword,
      }),
      skipAuth: true,
    });

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;
    this.tokenExpiresAt = Date.now() + (response.expires_in * 1000);
  }

  /**
   * Sign out and invalidate tokens
   */
  async signOut(): Promise<void> {
    try {
      await this.request('/cashier/signout', {
        method: 'POST',
      });
    } finally {
      this.accessToken = null;
      this.refreshToken = null;
      this.cashRegisterId = null;
      this.tokenExpiresAt = 0;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request<AuthResponse>('/cashier/refresh', {
      method: 'POST',
      body: JSON.stringify({
        refresh_token: this.refreshToken,
      }),
      skipAuth: true,
    });

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;
    this.tokenExpiresAt = Date.now() + (response.expires_in * 1000);
  }

  /**
   * Get current cashier profile
   */
  async getCashierProfile(): Promise<CashierProfile> {
    return this.request<CashierProfile>('/cashier/me', {
      method: 'GET',
    });
  }

  // ============================================================
  // Cash Register
  // ============================================================

  /**
   * Get list of available cash registers
   */
  async getCashRegisters(): Promise<CashRegister[]> {
    const response = await this.request<{ results: CashRegister[] }>('/cash-registers', {
      method: 'GET',
    });
    return response.results;
  }

  /**
   * Select active cash register for operations
   */
  async selectCashRegister(registerId: string): Promise<void> {
    this.cashRegisterId = registerId;
  }

  /**
   * Get currently selected cash register
   */
  getSelectedCashRegister(): string | null {
    return this.cashRegisterId;
  }

  // ============================================================
  // Shifts (Зміни)
  // ============================================================

  /**
   * Open a new shift
   */
  async openShift(): Promise<Shift> {
    this.ensureCashRegister();

    return this.request<Shift>(`/cash-registers/${this.cashRegisterId}/shifts`, {
      method: 'POST',
    });
  }

  /**
   * Close current shift and generate Z-report
   */
  async closeShift(): Promise<ZReport> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift to close');
    }

    return this.request<ZReport>(`/shifts/${shift.id}/close`, {
      method: 'POST',
    });
  }

  /**
   * Get current active shift
   */
  async getCurrentShift(): Promise<Shift | null> {
    this.ensureCashRegister();

    const response = await this.request<{ results: Shift[] }>(
      `/cash-registers/${this.cashRegisterId}/shifts`,
      {
        method: 'GET',
        query: { status: 'OPENED' },
      }
    );

    return response.results[0] || null;
  }

  /**
   * Get shift status
   */
  async getShiftStatus(): Promise<'OPENED' | 'CLOSED' | 'NONE'> {
    const shift = await this.getCurrentShift();
    return shift ? shift.status : 'NONE';
  }

  /**
   * Get shift by ID
   */
  async getShift(shiftId: string): Promise<Shift> {
    return this.request<Shift>(`/shifts/${shiftId}`, {
      method: 'GET',
    });
  }

  // ============================================================
  // Receipts (Чеки)
  // ============================================================

  /**
   * Create a new receipt (чек продажу)
   */
  async createReceipt(request: CreateReceiptRequest): Promise<Receipt> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift. Please open a shift first.');
    }

    return this.request<Receipt>(`/shifts/${shift.id}/receipts`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Create a return receipt (чек повернення)
   */
  async createReturnReceipt(
    originalReceiptId: string,
    goods: ReceiptGood[]
  ): Promise<Receipt> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift. Please open a shift first.');
    }

    // Get original receipt to copy payment methods
    const originalReceipt = await this.getReceipt(originalReceiptId);

    // Mark goods as returns
    const returnGoods = goods.map(good => ({
      ...good,
      is_return: true,
    }));

    return this.request<Receipt>(`/shifts/${shift.id}/receipts`, {
      method: 'POST',
      body: JSON.stringify({
        goods: returnGoods,
        payments: originalReceipt.payments,
      }),
    });
  }

  /**
   * Get receipt by ID
   */
  async getReceipt(receiptId: string): Promise<Receipt> {
    return this.request<Receipt>(`/receipts/${receiptId}`, {
      method: 'GET',
    });
  }

  /**
   * Get receipt PDF
   */
  async getReceiptPdf(receiptId: string): Promise<Buffer> {
    const receipt = await this.getReceipt(receiptId);

    if (!receipt.pdf_url) {
      throw new Error('PDF URL not available for this receipt');
    }

    const response = await fetch(receipt.pdf_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Get receipt as HTML
   */
  async getReceiptHtml(receiptId: string): Promise<string> {
    return this.request<string>(`/receipts/${receiptId}/html`, {
      method: 'GET',
    });
  }

  /**
   * Get receipt QR code URL
   */
  async getReceiptQrCode(receiptId: string): Promise<string> {
    const receipt = await this.getReceipt(receiptId);
    return receipt.qr_code_url || this.generateFiscalQrUrl(receipt.fiscal_code);
  }

  /**
   * Get receipt text (for thermal printer)
   */
  async getReceiptText(receiptId: string): Promise<string> {
    return this.request<string>(`/receipts/${receiptId}/text`, {
      method: 'GET',
    });
  }

  /**
   * Search receipts
   */
  async searchReceipts(params: {
    fiscal_code?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<Receipt[]> {
    const response = await this.request<{ results: Receipt[] }>('/receipts', {
      method: 'GET',
      query: params,
    });
    return response.results;
  }

  // ============================================================
  // Service operations (Службові внесення/винесення)
  // ============================================================

  /**
   * Service deposit (службове внесення готівки)
   */
  async serviceDeposit(amount: number): Promise<Receipt> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift. Please open a shift first.');
    }

    return this.request<Receipt>(`/shifts/${shift.id}/service-input`, {
      method: 'POST',
      body: JSON.stringify({
        payment: {
          type: 'CASH',
          value: this.formatAmount(amount),
        },
      }),
    });
  }

  /**
   * Service withdraw (службове винесення готівки)
   */
  async serviceWithdraw(amount: number): Promise<Receipt> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift. Please open a shift first.');
    }

    return this.request<Receipt>(`/shifts/${shift.id}/service-output`, {
      method: 'POST',
      body: JSON.stringify({
        payment: {
          type: 'CASH',
          value: this.formatAmount(amount),
        },
      }),
    });
  }

  // ============================================================
  // Reports (Звіти)
  // ============================================================

  /**
   * Get Z-report by ID
   */
  async getZReport(reportId: string): Promise<ZReport> {
    return this.request<ZReport>(`/reports/${reportId}`, {
      method: 'GET',
    });
  }

  /**
   * Get all Z-reports for a shift
   */
  async getShiftReports(shiftId: string): Promise<ZReport[]> {
    const response = await this.request<{ results: ZReport[] }>(
      `/shifts/${shiftId}/reports`,
      {
        method: 'GET',
      }
    );
    return response.results;
  }

  /**
   * Get periodic report (звіт за період)
   */
  async getPeriodReport(from: Date, to: Date): Promise<any> {
    this.ensureCashRegister();

    return this.request('/reports/periodic', {
      method: 'POST',
      body: JSON.stringify({
        from_date: from.toISOString(),
        to_date: to.toISOString(),
        cash_register_id: this.cashRegisterId,
      }),
    });
  }

  /**
   * Get X-report (проміжний звіт без закриття зміни)
   */
  async getXReport(): Promise<any> {
    this.ensureCashRegister();

    const shift = await this.getCurrentShift();
    if (!shift) {
      throw new Error('No open shift');
    }

    return this.request(`/shifts/${shift.id}/x-report`, {
      method: 'GET',
    });
  }

  // ============================================================
  // Taxes
  // ============================================================

  /**
   * Get available tax rates
   */
  async getTaxes(): Promise<TaxInfo[]> {
    this.ensureCashRegister();

    const response = await this.request<{ results: TaxInfo[] }>(
      `/cash-registers/${this.cashRegisterId}/taxes`,
      {
        method: 'GET',
      }
    );
    return response.results;
  }

  // ============================================================
  // Utils
  // ============================================================

  /**
   * Ping server to check connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.request('/ping', {
        method: 'GET',
        skipAuth: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert UAH to kopecks (Checkbox uses kopecks)
   * @param amount Amount in UAH
   * @returns Amount in kopecks
   */
  formatAmount(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Convert kopecks to UAH
   * @param kopecks Amount in kopecks
   * @returns Amount in UAH
   */
  parseAmount(kopecks: number): number {
    return kopecks / 100;
  }

  /**
   * Generate fiscal QR code URL for verification
   */
  generateFiscalQrUrl(fiscalCode: string): string {
    return `https://cabinet.tax.gov.ua/cashregs/check?id=${fiscalCode}`;
  }

  // ============================================================
  // Private methods
  // ============================================================

  private ensureCashRegister(): void {
    if (!this.cashRegisterId) {
      throw new Error('No cash register selected. Please select a cash register first.');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken) {
      await this.signIn();
      return;
    }

    // Check if token is about to expire (refresh 5 minutes before)
    if (this.tokenExpiresAt - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }
  }

  private async request<T>(
    endpoint: string,
    options: {
      method: string;
      body?: string;
      query?: Record<string, any>;
      skipAuth?: boolean;
    }
  ): Promise<T> {
    // Ensure we have a valid token unless explicitly skipping auth
    if (!options.skipAuth) {
      await this.ensureAuthenticated();
    }

    // Build URL with query params
    let url = `${this.config.apiUrl}${endpoint}`;
    if (options.query) {
      const params = new URLSearchParams();
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-License-Key': this.config.licenseKey,
    };

    if (!options.skipAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Make request
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body,
    });

    // Handle response
    if (!response.ok) {
      let errorMessage = `Checkbox API error: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch {
        // If we can't parse error JSON, use the default message
      }

      throw new Error(errorMessage);
    }

    // Some endpoints return empty responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return '' as T;
    }

    return response.json();
  }
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Format receipt for Ukrainian thermal printer
 */
export function formatUkrainianReceipt(receipt: Receipt): string {
  const lines: string[] = [];
  const width = 32; // Standard thermal printer width

  // Header
  lines.push('='.repeat(width));
  lines.push(centerText('ФІСКАЛЬНИЙ ЧЕК', width));
  lines.push('='.repeat(width));
  lines.push('');

  // Receipt info
  lines.push(`№ ${receipt.serial}`);
  lines.push(`Дата: ${new Date(receipt.fiscal_date).toLocaleString('uk-UA')}`);
  lines.push(`Фіскальний код: ${receipt.fiscal_code}`);
  lines.push('');
  lines.push('-'.repeat(width));

  // Goods
  receipt.goods.forEach((item) => {
    const name = item.good.name;
    const price = (item.good.price / 100).toFixed(2);
    const qty = (item.quantity / 1000).toFixed(3);
    const total = ((item.good.price * item.quantity) / 100000).toFixed(2);

    lines.push(name);
    lines.push(`  ${qty} x ${price} = ${total} грн`);

    if (item.good.barcode) {
      lines.push(`  Штрихкод: ${item.good.barcode}`);
    }
  });

  lines.push('-'.repeat(width));
  lines.push('');

  // Taxes
  if (receipt.taxes.length > 0) {
    lines.push('ПОДАТКИ:');
    receipt.taxes.forEach((tax) => {
      lines.push(`  ${tax.label}: ${(tax.value / 100).toFixed(2)} грн`);
    });
    lines.push('');
  }

  // Total
  lines.push(`ВСЬОГО: ${(receipt.total_sum / 100).toFixed(2)} грн`);
  lines.push('');

  // Payments
  lines.push('ОПЛАТА:');
  receipt.payments.forEach((payment) => {
    const type = payment.type === 'CASH' ? 'Готівка' :
                 payment.type === 'CARD' ? 'Картка' : 'Безготівковий';
    lines.push(`  ${type}: ${(payment.value / 100).toFixed(2)} грн`);
  });

  if (receipt.total_rest > 0) {
    lines.push(`РЕШТА: ${(receipt.total_rest / 100).toFixed(2)} грн`);
  }

  lines.push('');
  lines.push('='.repeat(width));
  lines.push(centerText('ДЯКУЄМО ЗА ПОКУПКУ!', width));
  lines.push('='.repeat(width));

  return lines.join('\n');
}

/**
 * Center text for thermal printer
 */
function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Generate fiscal QR URL for verification on tax.gov.ua
 */
export function generateFiscalQrUrl(fiscalCode: string): string {
  return `https://cabinet.tax.gov.ua/cashregs/check?id=${fiscalCode}`;
}

/**
 * Validate Ukrainian tax number (РНОКПП/ІПН)
 */
export function validateUkrainianTaxNumber(taxNumber: string): boolean {
  // Remove any non-digit characters
  const digits = taxNumber.replace(/\D/g, '');

  // Must be 10 digits for individual or 8-10 for legal entity
  if (digits.length < 8 || digits.length > 10) {
    return false;
  }

  // Basic validation passed
  return true;
}

/**
 * Format amount for display in UAH
 */
export function formatUAH(amount: number): string {
  return `${amount.toFixed(2)} грн`;
}

/**
 * Parse Ukrainian phone number
 */
export function parseUkrainianPhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If starts with 380, it's already in international format
  if (digits.startsWith('380')) {
    return `+${digits}`;
  }

  // If starts with 0, replace with +380
  if (digits.startsWith('0')) {
    return `+380${digits.substring(1)}`;
  }

  // Otherwise assume it's missing country code
  return `+380${digits}`;
}
