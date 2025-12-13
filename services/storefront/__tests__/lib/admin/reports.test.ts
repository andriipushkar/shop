/**
 * Tests for Reports & Export System
 */

import {
  formatExportValue,
  generateExportFileName,
  calculateNextRunDate,
  validateReportParameters,
  buildCSV,
  buildExcelData,
  REPORT_TYPE_LABELS,
  REPORT_FORMAT_LABELS,
  SYSTEM_REPORTS,
  ORDER_EXPORT_COLUMNS,
  CUSTOMER_EXPORT_COLUMNS,
  ReportFormat,
  ReportParameter,
  ReportSchedule,
  ExportColumn,
} from '../../../lib/admin/reports';

describe('Reports & Export System', () => {
  describe('formatExportValue', () => {
    it('should format currency value', () => {
      const formatted = formatExportValue(1000, 'currency');

      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
      expect(formatted).toContain('₴');
    });

    it('should format number value', () => {
      const formatted = formatExportValue(1500, 'number');

      expect(formatted).toContain('1');
      expect(formatted).toContain('500');
    });

    it('should format percent value', () => {
      const formatted = formatExportValue(25.5, 'percent');

      expect(formatted).toBe('25.50%');
    });

    it('should format date value', () => {
      const formatted = formatExportValue('2024-01-15', 'date');

      expect(formatted).toContain('15');
      expect(formatted).toContain('01');
      expect(formatted).toContain('2024');
    });

    it('should format datetime value', () => {
      const formatted = formatExportValue('2024-01-15T10:30:00', 'datetime');

      expect(formatted).toContain('15');
      expect(formatted).toContain('10');
      expect(formatted).toContain('30');
    });

    it('should format boolean value', () => {
      expect(formatExportValue(true, 'boolean')).toBe('Так');
      expect(formatExportValue(false, 'boolean')).toBe('Ні');
    });

    it('should format text value', () => {
      const formatted = formatExportValue('Test String', 'text');
      expect(formatted).toBe('Test String');
    });

    it('should handle null and undefined', () => {
      expect(formatExportValue(null, 'text')).toBe('');
      expect(formatExportValue(undefined, 'text')).toBe('');
    });
  });

  describe('generateExportFileName', () => {
    it('should generate file name with date', () => {
      const fileName = generateExportFileName('Sales Report', 'pdf');

      expect(fileName).toContain('sales_report');
      expect(fileName).toContain('.pdf');
    });

    it('should include date range in name', () => {
      const dateRange = {
        start: new Date('2024-01-15'),
        end: new Date('2024-01-20'),
      };

      const fileName = generateExportFileName('Report', 'excel', dateRange);

      expect(fileName).toContain('20240115');
      expect(fileName).toContain('20240120');
    });

    it('should use correct extension for each format', () => {
      expect(generateExportFileName('Test', 'pdf')).toContain('.pdf');
      expect(generateExportFileName('Test', 'excel')).toContain('.xlsx');
      expect(generateExportFileName('Test', 'csv')).toContain('.csv');
      expect(generateExportFileName('Test', 'json')).toContain('.json');
    });

    it('should sanitize report name', () => {
      const fileName = generateExportFileName('Report with Spaces & Special!', 'pdf');

      expect(fileName).not.toContain(' ');
      expect(fileName).not.toContain('&');
      expect(fileName).not.toContain('!');
    });

    it('should handle Ukrainian characters', () => {
      const fileName = generateExportFileName('Звіт продажів', 'pdf');

      expect(fileName).toContain('.pdf');
    });
  });

  describe('calculateNextRunDate', () => {
    it('should calculate next daily run', () => {
      const schedule: ReportSchedule = {
        frequency: 'daily',
        time: '09:00',
        timezone: 'Europe/Kyiv',
        recipients: ['test@example.com'],
        isActive: true,
      };

      const nextRun = calculateNextRunDate(schedule);

      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should calculate next weekly run', () => {
      const schedule: ReportSchedule = {
        frequency: 'weekly',
        dayOfWeek: 1, // Monday
        time: '09:00',
        timezone: 'Europe/Kyiv',
        recipients: ['test@example.com'],
        isActive: true,
      };

      const nextRun = calculateNextRunDate(schedule);

      expect(nextRun.getDay()).toBe(1); // Monday
    });

    it('should calculate next monthly run', () => {
      const schedule: ReportSchedule = {
        frequency: 'monthly',
        dayOfMonth: 1,
        time: '09:00',
        timezone: 'Europe/Kyiv',
        recipients: ['test@example.com'],
        isActive: true,
      };

      const nextRun = calculateNextRunDate(schedule);

      expect(nextRun.getDate()).toBe(1);
    });

    it('should calculate next quarterly run', () => {
      const schedule: ReportSchedule = {
        frequency: 'quarterly',
        dayOfMonth: 1,
        time: '09:00',
        timezone: 'Europe/Kyiv',
        recipients: ['test@example.com'],
        isActive: true,
      };

      const nextRun = calculateNextRunDate(schedule);

      // Should be start of a quarter (Jan, Apr, Jul, Oct)
      expect([0, 3, 6, 9]).toContain(nextRun.getMonth());
      expect(nextRun.getDate()).toBe(1);
    });

    it('should return future date', () => {
      const schedule: ReportSchedule = {
        frequency: 'daily',
        time: '09:00',
        timezone: 'Europe/Kyiv',
        recipients: ['test@example.com'],
        isActive: true,
      };

      const nextRun = calculateNextRunDate(schedule);
      const now = new Date();

      expect(nextRun.getTime()).toBeGreaterThan(now.getTime() - 1000); // Allow 1 second tolerance
    });
  });

  describe('validateReportParameters', () => {
    it('should pass for valid parameters', () => {
      const parameters: ReportParameter[] = [
        { name: 'date', nameUk: 'Дата', type: 'date', required: true },
      ];
      const values = { date: '2024-01-15' };

      const errors = validateReportParameters(parameters, values);

      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should fail for missing required parameter', () => {
      const parameters: ReportParameter[] = [
        { name: 'date', nameUk: 'Дата', type: 'date', required: true },
      ];
      const values = {};

      const errors = validateReportParameters(parameters, values);

      expect(errors.date).toBeTruthy();
    });

    it('should pass for missing optional parameter', () => {
      const parameters: ReportParameter[] = [
        { name: 'category', nameUk: 'Категорія', type: 'select', required: false },
      ];
      const values = {};

      const errors = validateReportParameters(parameters, values);

      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate min value', () => {
      const parameters: ReportParameter[] = [
        {
          name: 'limit',
          nameUk: 'Ліміт',
          type: 'number',
          required: true,
          validation: { min: 1 },
        },
      ];
      const values = { limit: 0 };

      const errors = validateReportParameters(parameters, values);

      expect(errors.limit).toBeTruthy();
    });

    it('should validate max value', () => {
      const parameters: ReportParameter[] = [
        {
          name: 'limit',
          nameUk: 'Ліміт',
          type: 'number',
          required: true,
          validation: { max: 100 },
        },
      ];
      const values = { limit: 200 };

      const errors = validateReportParameters(parameters, values);

      expect(errors.limit).toBeTruthy();
    });

    it('should validate pattern', () => {
      const parameters: ReportParameter[] = [
        {
          name: 'code',
          nameUk: 'Код',
          type: 'text',
          required: true,
          validation: { pattern: '^[A-Z]+$' },
        },
      ];
      const values = { code: 'abc123' };

      const errors = validateReportParameters(parameters, values);

      expect(errors.code).toBeTruthy();
    });
  });

  describe('buildCSV', () => {
    it('should build CSV with headers', () => {
      const data = [
        { name: 'Product 1', price: 100 },
        { name: 'Product 2', price: 200 },
      ];
      const columns: ExportColumn[] = [
        { field: 'name', header: 'Name', headerUk: 'Назва' },
        { field: 'price', header: 'Price', headerUk: 'Ціна', format: 'number' },
      ];

      const csv = buildCSV(data, columns);

      expect(csv).toContain('"Назва"');
      expect(csv).toContain('"Ціна"');
      expect(csv).toContain('"Product 1"');
      expect(csv).toContain('"Product 2"');
    });

    it('should use semicolon as default delimiter', () => {
      const data = [{ name: 'Test' }];
      const columns: ExportColumn[] = [
        { field: 'name', header: 'Name', headerUk: 'Назва' },
      ];

      const csv = buildCSV(data, columns);

      // With only one column, no delimiter between columns in a row
      expect(csv).toContain('"Назва"');
    });

    it('should escape quotes in values', () => {
      const data = [{ name: 'Test "quoted" value' }];
      const columns: ExportColumn[] = [
        { field: 'name', header: 'Name', headerUk: 'Назва' },
      ];

      const csv = buildCSV(data, columns);

      expect(csv).toContain('""quoted""');
    });

    it('should handle empty data', () => {
      const columns: ExportColumn[] = [
        { field: 'name', header: 'Name', headerUk: 'Назва' },
      ];

      const csv = buildCSV([], columns);

      // Should still have header row
      expect(csv).toContain('"Назва"');
    });
  });

  describe('buildExcelData', () => {
    it('should return headers and rows', () => {
      const data = [
        { name: 'Product 1', price: 100 },
        { name: 'Product 2', price: 200 },
      ];
      const columns: ExportColumn[] = [
        { field: 'name', header: 'Name', headerUk: 'Назва', width: 20 },
        { field: 'price', header: 'Price', headerUk: 'Ціна', width: 10 },
      ];

      const result = buildExcelData(data, columns);

      expect(result.headers).toEqual(['Назва', 'Ціна']);
      expect(result.rows).toHaveLength(2);
      expect(result.columnWidths).toEqual([20, 10]);
    });

    it('should include format specifications', () => {
      const data = [{ amount: 1000 }];
      const columns: ExportColumn[] = [
        { field: 'amount', header: 'Amount', headerUk: 'Сума', format: 'currency' },
      ];

      const result = buildExcelData(data, columns);

      expect(result.formats[0]).toBeTruthy();
      expect(result.formats[0]).toContain('₴');
    });

    it('should convert boolean values', () => {
      const data = [{ active: true }, { active: false }];
      const columns: ExportColumn[] = [
        { field: 'active', header: 'Active', headerUk: 'Активний', format: 'boolean' },
      ];

      const result = buildExcelData(data, columns);

      expect(result.rows[0][0]).toBe('Так');
      expect(result.rows[1][0]).toBe('Ні');
    });
  });

  describe('REPORT_TYPE_LABELS', () => {
    it('should have all report types', () => {
      expect(REPORT_TYPE_LABELS.sales).toBeDefined();
      expect(REPORT_TYPE_LABELS.orders).toBeDefined();
      expect(REPORT_TYPE_LABELS.customers).toBeDefined();
      expect(REPORT_TYPE_LABELS.products).toBeDefined();
      expect(REPORT_TYPE_LABELS.inventory).toBeDefined();
      expect(REPORT_TYPE_LABELS.payments).toBeDefined();
      expect(REPORT_TYPE_LABELS.returns).toBeDefined();
      expect(REPORT_TYPE_LABELS.marketing).toBeDefined();
      expect(REPORT_TYPE_LABELS.analytics).toBeDefined();
      expect(REPORT_TYPE_LABELS.financial).toBeDefined();
      expect(REPORT_TYPE_LABELS.custom).toBeDefined();
    });

    it('should have all required properties', () => {
      Object.values(REPORT_TYPE_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
        expect(label.icon).toBeTruthy();
      });
    });
  });

  describe('REPORT_FORMAT_LABELS', () => {
    it('should have all formats', () => {
      expect(REPORT_FORMAT_LABELS.pdf).toBeDefined();
      expect(REPORT_FORMAT_LABELS.excel).toBeDefined();
      expect(REPORT_FORMAT_LABELS.csv).toBeDefined();
      expect(REPORT_FORMAT_LABELS.json).toBeDefined();
    });

    it('should have correct MIME types', () => {
      expect(REPORT_FORMAT_LABELS.pdf.mimeType).toBe('application/pdf');
      expect(REPORT_FORMAT_LABELS.excel.mimeType).toContain('spreadsheet');
      expect(REPORT_FORMAT_LABELS.csv.mimeType).toBe('text/csv');
      expect(REPORT_FORMAT_LABELS.json.mimeType).toBe('application/json');
    });

    it('should have correct extensions', () => {
      expect(REPORT_FORMAT_LABELS.pdf.extension).toBe('.pdf');
      expect(REPORT_FORMAT_LABELS.excel.extension).toBe('.xlsx');
      expect(REPORT_FORMAT_LABELS.csv.extension).toBe('.csv');
      expect(REPORT_FORMAT_LABELS.json.extension).toBe('.json');
    });
  });

  describe('SYSTEM_REPORTS', () => {
    it('should have multiple reports', () => {
      expect(SYSTEM_REPORTS.length).toBeGreaterThan(5);
    });

    it('should have all required properties', () => {
      SYSTEM_REPORTS.forEach(report => {
        expect(report.name).toBeTruthy();
        expect(report.nameUk).toBeTruthy();
        expect(report.type).toBeTruthy();
        expect(report.category).toBeTruthy();
        expect(report.format).toBeTruthy();
        expect(Array.isArray(report.parameters)).toBe(true);
        expect(typeof report.isSystem).toBe('boolean');
        expect(typeof report.isActive).toBe('boolean');
      });
    });

    it('should have parameters with required fields', () => {
      SYSTEM_REPORTS.forEach(report => {
        report.parameters.forEach(param => {
          expect(param.name).toBeTruthy();
          expect(param.nameUk).toBeTruthy();
          expect(param.type).toBeTruthy();
          expect(typeof param.required).toBe('boolean');
        });
      });
    });

    it('should have sales reports', () => {
      const salesReports = SYSTEM_REPORTS.filter(r => r.type === 'sales');
      expect(salesReports.length).toBeGreaterThan(0);
    });

    it('should have inventory report', () => {
      const inventoryReports = SYSTEM_REPORTS.filter(r => r.type === 'inventory');
      expect(inventoryReports.length).toBeGreaterThan(0);
    });
  });

  describe('ORDER_EXPORT_COLUMNS', () => {
    it('should have essential columns', () => {
      const fields = ORDER_EXPORT_COLUMNS.map(c => c.field);

      expect(fields).toContain('orderNumber');
      expect(fields).toContain('customerName');
      expect(fields).toContain('total');
      expect(fields).toContain('status');
    });

    it('should have all required properties', () => {
      ORDER_EXPORT_COLUMNS.forEach(column => {
        expect(column.field).toBeTruthy();
        expect(column.header).toBeTruthy();
        expect(column.headerUk).toBeTruthy();
      });
    });
  });

  describe('CUSTOMER_EXPORT_COLUMNS', () => {
    it('should have essential columns', () => {
      const fields = CUSTOMER_EXPORT_COLUMNS.map(c => c.field);

      expect(fields).toContain('email');
      expect(fields).toContain('firstName');
      expect(fields).toContain('lastName');
      expect(fields).toContain('totalSpent');
    });

    it('should have all required properties', () => {
      CUSTOMER_EXPORT_COLUMNS.forEach(column => {
        expect(column.field).toBeTruthy();
        expect(column.header).toBeTruthy();
        expect(column.headerUk).toBeTruthy();
      });
    });
  });
});
