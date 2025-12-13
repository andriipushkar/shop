/**
 * Reports & Export System
 * PDF/Excel report generation, automated sending, and data export
 */

// ==================== TYPES ====================

export interface Report {
  id: string;
  name: string;
  nameUk: string;
  description?: string;
  type: ReportType;
  category: ReportCategory;
  format: ReportFormat;
  parameters: ReportParameter[];
  schedule?: ReportSchedule;
  lastGeneratedAt?: Date;
  createdBy?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportType =
  | 'sales'
  | 'orders'
  | 'customers'
  | 'products'
  | 'inventory'
  | 'payments'
  | 'returns'
  | 'marketing'
  | 'analytics'
  | 'financial'
  | 'custom';

export type ReportCategory =
  | 'overview'
  | 'detailed'
  | 'summary'
  | 'comparison'
  | 'trend'
  | 'forecast';

export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';

export interface ReportParameter {
  name: string;
  nameUk: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export type ParameterType = 'date' | 'dateRange' | 'select' | 'multiSelect' | 'number' | 'text' | 'boolean';

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  dayOfWeek?: number; // 0-6, Sunday-Saturday
  dayOfMonth?: number; // 1-31
  time: string; // HH:mm format
  timezone: string;
  recipients: string[];
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface GeneratedReport {
  id: string;
  reportId: string;
  reportName: string;
  format: ReportFormat;
  parameters: Record<string, unknown>;
  fileUrl: string;
  fileSize: number;
  generatedBy?: string;
  generatedByName?: string;
  generatedAt: Date;
  expiresAt: Date;
  downloadCount: number;
}

export interface ReportGenerationInput {
  reportId?: string;
  reportType?: ReportType;
  format: ReportFormat;
  parameters: Record<string, unknown>;
  sendTo?: string[];
}

export interface ExportConfig {
  columns: ExportColumn[];
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeHeaders?: boolean;
  dateFormat?: string;
  numberFormat?: string;
  encoding?: 'utf-8' | 'windows-1251';
}

export interface ExportColumn {
  field: string;
  header: string;
  headerUk: string;
  width?: number;
  format?: ColumnFormat;
  transform?: (value: unknown) => string;
}

export type ColumnFormat = 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean';

export interface ExportResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
}

// PDF-specific types
export interface PDFReportConfig {
  title: string;
  subtitle?: string;
  logo?: string;
  orientation: 'portrait' | 'landscape';
  pageSize: 'A4' | 'Letter';
  margins: { top: number; right: number; bottom: number; left: number };
  header?: PDFHeader;
  footer?: PDFFooter;
  sections: PDFSection[];
  styles?: PDFStyles;
}

export interface PDFHeader {
  left?: string;
  center?: string;
  right?: string;
  showLogo?: boolean;
  showDate?: boolean;
}

export interface PDFFooter {
  left?: string;
  center?: string;
  right?: string;
  showPageNumbers?: boolean;
}

export interface PDFSection {
  type: 'title' | 'text' | 'table' | 'chart' | 'summary' | 'spacer' | 'pageBreak';
  content?: string;
  data?: unknown[];
  columns?: ExportColumn[];
  chartType?: 'bar' | 'line' | 'pie';
  chartData?: { labels: string[]; values: number[] };
  style?: Record<string, unknown>;
}

export interface PDFStyles {
  titleFont?: string;
  titleSize?: number;
  bodyFont?: string;
  bodySize?: number;
  tableHeaderBg?: string;
  tableHeaderColor?: string;
  accentColor?: string;
}

// ==================== CONSTANTS ====================

export const REPORT_TYPE_LABELS: Record<ReportType, { en: string; uk: string; icon: string }> = {
  sales: { en: 'Sales', uk: 'Продажі', icon: 'banknotes' },
  orders: { en: 'Orders', uk: 'Замовлення', icon: 'shopping-bag' },
  customers: { en: 'Customers', uk: 'Клієнти', icon: 'users' },
  products: { en: 'Products', uk: 'Товари', icon: 'cube' },
  inventory: { en: 'Inventory', uk: 'Склад', icon: 'archive-box' },
  payments: { en: 'Payments', uk: 'Платежі', icon: 'credit-card' },
  returns: { en: 'Returns', uk: 'Повернення', icon: 'arrow-uturn-left' },
  marketing: { en: 'Marketing', uk: 'Маркетинг', icon: 'megaphone' },
  analytics: { en: 'Analytics', uk: 'Аналітика', icon: 'chart-bar' },
  financial: { en: 'Financial', uk: 'Фінанси', icon: 'calculator' },
  custom: { en: 'Custom', uk: 'Кастомний', icon: 'cog' },
};

export const REPORT_FORMAT_LABELS: Record<ReportFormat, { en: string; uk: string; mimeType: string; extension: string }> = {
  pdf: { en: 'PDF Document', uk: 'PDF документ', mimeType: 'application/pdf', extension: '.pdf' },
  excel: { en: 'Excel Spreadsheet', uk: 'Excel таблиця', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
  csv: { en: 'CSV File', uk: 'CSV файл', mimeType: 'text/csv', extension: '.csv' },
  json: { en: 'JSON Data', uk: 'JSON дані', mimeType: 'application/json', extension: '.json' },
};

export const SCHEDULE_FREQUENCY_LABELS: Record<ScheduleFrequency, { en: string; uk: string }> = {
  daily: { en: 'Daily', uk: 'Щодня' },
  weekly: { en: 'Weekly', uk: 'Щотижня' },
  monthly: { en: 'Monthly', uk: 'Щомісяця' },
  quarterly: { en: 'Quarterly', uk: 'Щокварталу' },
};

// ==================== PREDEFINED REPORTS ====================

export const SYSTEM_REPORTS: Omit<Report, 'id' | 'lastGeneratedAt' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Daily Sales Report',
    nameUk: 'Щоденний звіт продажів',
    description: 'Overview of daily sales, orders, and revenue',
    type: 'sales',
    category: 'summary',
    format: 'pdf',
    parameters: [
      { name: 'date', nameUk: 'Дата', type: 'date', required: true, defaultValue: 'today' },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Weekly Sales Summary',
    nameUk: 'Тижневий звіт продажів',
    description: 'Weekly sales performance with trends',
    type: 'sales',
    category: 'summary',
    format: 'pdf',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true, defaultValue: 'last_7_days' },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Monthly Sales Report',
    nameUk: 'Місячний звіт продажів',
    description: 'Comprehensive monthly sales analysis',
    type: 'sales',
    category: 'detailed',
    format: 'excel',
    parameters: [
      { name: 'month', nameUk: 'Місяць', type: 'select', required: true },
      { name: 'year', nameUk: 'Рік', type: 'number', required: true },
      { name: 'compareWithPrevious', nameUk: 'Порівняти з попереднім', type: 'boolean', required: false, defaultValue: true },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Orders Export',
    nameUk: 'Експорт замовлень',
    description: 'Export orders with all details',
    type: 'orders',
    category: 'detailed',
    format: 'excel',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true },
      { name: 'status', nameUk: 'Статус', type: 'multiSelect', required: false },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Customer List Export',
    nameUk: 'Експорт клієнтів',
    description: 'Export customer database',
    type: 'customers',
    category: 'detailed',
    format: 'excel',
    parameters: [
      { name: 'segment', nameUk: 'Сегмент', type: 'select', required: false },
      { name: 'registeredAfter', nameUk: 'Зареєстровані після', type: 'date', required: false },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Inventory Report',
    nameUk: 'Звіт по складу',
    description: 'Current inventory levels and status',
    type: 'inventory',
    category: 'summary',
    format: 'excel',
    parameters: [
      { name: 'warehouse', nameUk: 'Склад', type: 'select', required: false },
      { name: 'lowStockOnly', nameUk: 'Тільки низький залишок', type: 'boolean', required: false },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Product Performance',
    nameUk: 'Ефективність товарів',
    description: 'Product sales and performance metrics',
    type: 'products',
    category: 'detailed',
    format: 'excel',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true },
      { name: 'category', nameUk: 'Категорія', type: 'select', required: false },
      { name: 'topN', nameUk: 'Топ N товарів', type: 'number', required: false, defaultValue: 100 },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Financial Summary',
    nameUk: 'Фінансовий звіт',
    description: 'Revenue, costs, and profit analysis',
    type: 'financial',
    category: 'summary',
    format: 'pdf',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true },
      { name: 'includeProjections', nameUk: 'Включити прогноз', type: 'boolean', required: false },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Returns Analysis',
    nameUk: 'Аналіз повернень',
    description: 'Return rates and reasons analysis',
    type: 'returns',
    category: 'detailed',
    format: 'excel',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true },
    ],
    isSystem: true,
    isActive: true,
  },
  {
    name: 'Marketing Campaign Report',
    nameUk: 'Звіт маркетингових кампаній',
    description: 'Campaign performance and ROI',
    type: 'marketing',
    category: 'detailed',
    format: 'pdf',
    parameters: [
      { name: 'dateRange', nameUk: 'Період', type: 'dateRange', required: true },
      { name: 'campaignId', nameUk: 'Кампанія', type: 'select', required: false },
    ],
    isSystem: true,
    isActive: true,
  },
];

// ==================== EXPORT COLUMN DEFINITIONS ====================

export const ORDER_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'orderNumber', header: 'Order Number', headerUk: 'Номер замовлення', width: 15 },
  { field: 'createdAt', header: 'Date', headerUk: 'Дата', width: 12, format: 'datetime' },
  { field: 'customerName', header: 'Customer', headerUk: 'Клієнт', width: 20 },
  { field: 'customerEmail', header: 'Email', headerUk: 'Email', width: 25 },
  { field: 'customerPhone', header: 'Phone', headerUk: 'Телефон', width: 15 },
  { field: 'status', header: 'Status', headerUk: 'Статус', width: 12 },
  { field: 'paymentMethod', header: 'Payment', headerUk: 'Оплата', width: 15 },
  { field: 'paymentStatus', header: 'Payment Status', headerUk: 'Статус оплати', width: 15 },
  { field: 'shippingMethod', header: 'Delivery', headerUk: 'Доставка', width: 15 },
  { field: 'subtotal', header: 'Subtotal', headerUk: 'Підсумок', width: 12, format: 'currency' },
  { field: 'discount', header: 'Discount', headerUk: 'Знижка', width: 12, format: 'currency' },
  { field: 'shipping', header: 'Shipping', headerUk: 'Доставка', width: 12, format: 'currency' },
  { field: 'total', header: 'Total', headerUk: 'Всього', width: 12, format: 'currency' },
  { field: 'city', header: 'City', headerUk: 'Місто', width: 15 },
  { field: 'notes', header: 'Notes', headerUk: 'Примітки', width: 30 },
];

export const CUSTOMER_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'id', header: 'ID', headerUk: 'ID', width: 10 },
  { field: 'firstName', header: 'First Name', headerUk: "Ім'я", width: 15 },
  { field: 'lastName', header: 'Last Name', headerUk: 'Прізвище', width: 15 },
  { field: 'email', header: 'Email', headerUk: 'Email', width: 25 },
  { field: 'phone', header: 'Phone', headerUk: 'Телефон', width: 15 },
  { field: 'status', header: 'Status', headerUk: 'Статус', width: 12 },
  { field: 'segment', header: 'Segment', headerUk: 'Сегмент', width: 15 },
  { field: 'totalOrders', header: 'Orders', headerUk: 'Замовлень', width: 10, format: 'number' },
  { field: 'totalSpent', header: 'Total Spent', headerUk: 'Витрачено', width: 12, format: 'currency' },
  { field: 'averageOrderValue', header: 'Avg Order', headerUk: 'Середній чек', width: 12, format: 'currency' },
  { field: 'loyaltyPoints', header: 'Points', headerUk: 'Бали', width: 10, format: 'number' },
  { field: 'loyaltyTier', header: 'Tier', headerUk: 'Рівень', width: 12 },
  { field: 'city', header: 'City', headerUk: 'Місто', width: 15 },
  { field: 'createdAt', header: 'Registered', headerUk: 'Зареєстровано', width: 12, format: 'date' },
  { field: 'lastOrderDate', header: 'Last Order', headerUk: 'Останнє замовлення', width: 12, format: 'date' },
  { field: 'marketingConsent', header: 'Marketing', headerUk: 'Маркетинг', width: 10, format: 'boolean' },
];

export const PRODUCT_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'sku', header: 'SKU', headerUk: 'Артикул', width: 15 },
  { field: 'name', header: 'Name', headerUk: 'Назва', width: 30 },
  { field: 'category', header: 'Category', headerUk: 'Категорія', width: 20 },
  { field: 'price', header: 'Price', headerUk: 'Ціна', width: 12, format: 'currency' },
  { field: 'originalPrice', header: 'Original Price', headerUk: 'Стара ціна', width: 12, format: 'currency' },
  { field: 'stock', header: 'Stock', headerUk: 'Залишок', width: 10, format: 'number' },
  { field: 'soldCount', header: 'Sold', headerUk: 'Продано', width: 10, format: 'number' },
  { field: 'revenue', header: 'Revenue', headerUk: 'Дохід', width: 12, format: 'currency' },
  { field: 'viewCount', header: 'Views', headerUk: 'Перегляди', width: 10, format: 'number' },
  { field: 'conversionRate', header: 'Conversion', headerUk: 'Конверсія', width: 12, format: 'percent' },
  { field: 'averageRating', header: 'Rating', headerUk: 'Рейтинг', width: 10, format: 'number' },
  { field: 'reviewCount', header: 'Reviews', headerUk: 'Відгуки', width: 10, format: 'number' },
  { field: 'status', header: 'Status', headerUk: 'Статус', width: 12 },
];

export const INVENTORY_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'sku', header: 'SKU', headerUk: 'Артикул', width: 15 },
  { field: 'productName', header: 'Product', headerUk: 'Товар', width: 30 },
  { field: 'warehouse', header: 'Warehouse', headerUk: 'Склад', width: 20 },
  { field: 'location', header: 'Location', headerUk: 'Локація', width: 12 },
  { field: 'quantity', header: 'Quantity', headerUk: 'Кількість', width: 10, format: 'number' },
  { field: 'reserved', header: 'Reserved', headerUk: 'Резерв', width: 10, format: 'number' },
  { field: 'available', header: 'Available', headerUk: 'Доступно', width: 10, format: 'number' },
  { field: 'minStock', header: 'Min Stock', headerUk: 'Мін. залишок', width: 10, format: 'number' },
  { field: 'maxStock', header: 'Max Stock', headerUk: 'Макс. залишок', width: 10, format: 'number' },
  { field: 'costPrice', header: 'Cost', headerUk: 'Собівартість', width: 12, format: 'currency' },
  { field: 'totalValue', header: 'Value', headerUk: 'Вартість', width: 12, format: 'currency' },
  { field: 'status', header: 'Status', headerUk: 'Статус', width: 12 },
  { field: 'lastMovement', header: 'Last Movement', headerUk: 'Останній рух', width: 12, format: 'date' },
];

// ==================== HELPER FUNCTIONS ====================

/**
 * Format value for export based on format type
 */
export function formatExportValue(
  value: unknown,
  format: ColumnFormat,
  options?: { currency?: string; dateFormat?: string }
): string {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('uk-UA', {
        style: 'currency',
        currency: options?.currency || 'UAH',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number(value));

    case 'number':
      return new Intl.NumberFormat('uk-UA').format(Number(value));

    case 'percent':
      return `${Number(value).toFixed(2)}%`;

    case 'date':
      return new Date(value as string).toLocaleDateString('uk-UA');

    case 'datetime':
      return new Date(value as string).toLocaleString('uk-UA');

    case 'boolean':
      return value ? 'Так' : 'Ні';

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Generate file name for export
 */
export function generateExportFileName(
  reportName: string,
  format: ReportFormat,
  dateRange?: { start: Date; end: Date }
): string {
  const sanitizedName = reportName
    .toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]+/gi, '_')
    .replace(/^_|_$/g, '');

  const dateStr = dateRange
    ? `_${formatDateForFileName(dateRange.start)}-${formatDateForFileName(dateRange.end)}`
    : `_${formatDateForFileName(new Date())}`;

  const extension = REPORT_FORMAT_LABELS[format].extension;

  return `${sanitizedName}${dateStr}${extension}`;
}

/**
 * Format date for file name
 */
function formatDateForFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Calculate next run date for scheduled report
 */
export function calculateNextRunDate(schedule: ReportSchedule): Date {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      const daysUntilTarget = ((schedule.dayOfWeek || 1) - now.getDay() + 7) % 7;
      nextRun.setDate(now.getDate() + daysUntilTarget);
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 7);
      }
      break;

    case 'monthly':
      nextRun.setDate(schedule.dayOfMonth || 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    case 'quarterly':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const nextQuarterMonth = (currentQuarter + 1) * 3;
      nextRun.setMonth(nextQuarterMonth, schedule.dayOfMonth || 1);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 3);
      }
      break;
  }

  return nextRun;
}

/**
 * Validate report parameters
 */
export function validateReportParameters(
  parameters: ReportParameter[],
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  parameters.forEach(param => {
    const value = values[param.name];

    if (param.required && (value === null || value === undefined || value === '')) {
      errors[param.name] = `${param.nameUk} є обов'язковим`;
      return;
    }

    if (value !== null && value !== undefined && param.validation) {
      if (param.validation.min !== undefined && Number(value) < param.validation.min) {
        errors[param.name] = `Мінімальне значення: ${param.validation.min}`;
      }
      if (param.validation.max !== undefined && Number(value) > param.validation.max) {
        errors[param.name] = `Максимальне значення: ${param.validation.max}`;
      }
      if (param.validation.pattern && !new RegExp(param.validation.pattern).test(String(value))) {
        errors[param.name] = 'Невірний формат';
      }
    }
  });

  return errors;
}

/**
 * Build CSV content from data
 */
export function buildCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  options?: { delimiter?: string; encoding?: string }
): string {
  const delimiter = options?.delimiter || ';';

  // Header row
  const headers = columns.map(col => `"${col.headerUk}"`).join(delimiter);

  // Data rows
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.field];
      const formatted = formatExportValue(value, col.format || 'text');
      // Escape quotes and wrap in quotes
      return `"${String(formatted).replace(/"/g, '""')}"`;
    }).join(delimiter)
  );

  return [headers, ...rows].join('\n');
}

/**
 * Build Excel workbook data structure
 */
export function buildExcelData(
  data: Record<string, unknown>[],
  columns: ExportColumn[]
): {
  headers: string[];
  rows: unknown[][];
  columnWidths: number[];
  formats: Record<number, string>;
} {
  const headers = columns.map(col => col.headerUk);
  const columnWidths = columns.map(col => col.width || 15);

  const formats: Record<number, string> = {};
  columns.forEach((col, index) => {
    switch (col.format) {
      case 'currency':
        formats[index] = '#,##0.00 ₴';
        break;
      case 'percent':
        formats[index] = '0.00%';
        break;
      case 'date':
        formats[index] = 'DD.MM.YYYY';
        break;
      case 'datetime':
        formats[index] = 'DD.MM.YYYY HH:MM';
        break;
    }
  });

  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.field];
      // Keep raw values for Excel, formatting will be applied via cell formats
      if (col.format === 'boolean') {
        return value ? 'Так' : 'Ні';
      }
      return value;
    })
  );

  return { headers, rows, columnWidths, formats };
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch available reports
 */
export async function fetchReports(type?: ReportType): Promise<Report[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);

  const response = await fetch(`/api/admin/reports?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch reports');
  }

  return response.json();
}

/**
 * Fetch single report
 */
export async function fetchReport(reportId: string): Promise<Report> {
  const response = await fetch(`/api/admin/reports/${reportId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch report');
  }

  return response.json();
}

/**
 * Generate report
 */
export async function generateReport(input: ReportGenerationInput): Promise<GeneratedReport> {
  const response = await fetch('/api/admin/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate report');
  }

  return response.json();
}

/**
 * Fetch generated reports
 */
export async function fetchGeneratedReports(
  reportId?: string,
  limit: number = 20
): Promise<GeneratedReport[]> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  if (reportId) params.set('reportId', reportId);

  const response = await fetch(`/api/admin/reports/generated?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch generated reports');
  }

  return response.json();
}

/**
 * Download report
 */
export async function downloadReport(reportId: string): Promise<Blob> {
  const response = await fetch(`/api/admin/reports/generated/${reportId}/download`);

  if (!response.ok) {
    throw new Error('Failed to download report');
  }

  return response.blob();
}

/**
 * Schedule report
 */
export async function scheduleReport(
  reportId: string,
  schedule: Omit<ReportSchedule, 'lastRunAt' | 'nextRunAt'>
): Promise<Report> {
  const response = await fetch(`/api/admin/reports/${reportId}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    throw new Error('Failed to schedule report');
  }

  return response.json();
}

/**
 * Cancel scheduled report
 */
export async function cancelSchedule(reportId: string): Promise<void> {
  const response = await fetch(`/api/admin/reports/${reportId}/schedule`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to cancel schedule');
  }
}

/**
 * Export data directly
 */
export async function exportData(
  entityType: 'orders' | 'customers' | 'products' | 'inventory',
  config: ExportConfig,
  format: ReportFormat
): Promise<Blob> {
  const response = await fetch(`/api/admin/export/${entityType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, format }),
  });

  if (!response.ok) {
    throw new Error('Failed to export data');
  }

  return response.blob();
}

/**
 * Get export preview
 */
export async function getExportPreview(
  entityType: 'orders' | 'customers' | 'products' | 'inventory',
  config: ExportConfig,
  limit: number = 10
): Promise<{ data: Record<string, unknown>[]; total: number }> {
  const response = await fetch(`/api/admin/export/${entityType}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...config, limit }),
  });

  if (!response.ok) {
    throw new Error('Failed to get export preview');
  }

  return response.json();
}

/**
 * Create custom report
 */
export async function createCustomReport(
  input: Omit<Report, 'id' | 'lastGeneratedAt' | 'createdAt' | 'updatedAt' | 'isSystem'>
): Promise<Report> {
  const response = await fetch('/api/admin/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, isSystem: false }),
  });

  if (!response.ok) {
    throw new Error('Failed to create report');
  }

  return response.json();
}

/**
 * Delete custom report
 */
export async function deleteReport(reportId: string): Promise<void> {
  const response = await fetch(`/api/admin/reports/${reportId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete report');
  }
}

/**
 * Send report to recipients
 */
export async function sendReport(
  generatedReportId: string,
  recipients: string[],
  message?: string
): Promise<{ sent: number; failed: number }> {
  const response = await fetch(`/api/admin/reports/generated/${generatedReportId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send report');
  }

  return response.json();
}
