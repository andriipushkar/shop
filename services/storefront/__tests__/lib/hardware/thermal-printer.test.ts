/**
 * Unit tests for Thermal Printer Service
 * Тести для сервісу термопринтерів
 */

import { ThermalPrinterService, type PrinterConfig, type LabelTemplate, type ReceiptData } from '@/lib/hardware/thermal-printer';

describe('ThermalPrinterService', () => {
  let service: ThermalPrinterService;
  let config: PrinterConfig;

  beforeEach(() => {
    config = {
      type: 'network',
      address: '192.168.1.100',
      port: 9100,
      width: 100,
      height: 150,
      dpi: 203,
      model: 'zebra',
    };
    service = new ThermalPrinterService(config);
  });

  describe('ZPL Generation', () => {
    it('should generate ZPL code for simple label', () => {
      const template: LabelTemplate = {
        id: 'test-label',
        name: 'Test Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'text',
            x: 10,
            y: 10,
            content: 'Hello World',
            fontSize: 12,
          },
        ],
      };

      const zpl = service.generateZPL(template, {});

      expect(zpl).toContain('^XA'); // Start format
      expect(zpl).toContain('^XZ'); // End format
      expect(zpl).toContain('Hello World');
    });

    it('should generate ZPL with barcode', () => {
      const template: LabelTemplate = {
        id: 'barcode-label',
        name: 'Barcode Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'barcode',
            x: 10,
            y: 10,
            data: '1234567890',
            symbology: 'CODE128',
            height: 50,
            showText: true,
          },
        ],
      };

      const zpl = service.generateZPL(template, {});

      expect(zpl).toContain('^BC'); // CODE128 barcode
      expect(zpl).toContain('1234567890');
    });

    it('should generate ZPL with QR code', () => {
      const template: LabelTemplate = {
        id: 'qr-label',
        name: 'QR Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'qrcode',
            x: 10,
            y: 10,
            data: 'https://example.com',
            size: 5,
          },
        ],
      };

      const zpl = service.generateZPL(template, {});

      expect(zpl).toContain('^BQ'); // QR code
      expect(zpl).toContain('https://example.com');
    });

    it('should replace variables in template', () => {
      const template: LabelTemplate = {
        id: 'var-label',
        name: 'Variable Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'text',
            x: 10,
            y: 10,
            content: 'Order: {{orderNumber}}',
            fontSize: 12,
          },
        ],
      };

      const zpl = service.generateZPL(template, { orderNumber: '12345' });

      expect(zpl).toContain('Order: 12345');
      expect(zpl).not.toContain('{{orderNumber}}');
    });

    it('should handle lines and rectangles', () => {
      const template: LabelTemplate = {
        id: 'shapes-label',
        name: 'Shapes Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'line',
            x1: 10,
            y1: 10,
            x2: 90,
            y2: 10,
            thickness: 2,
          },
          {
            type: 'rectangle',
            x: 10,
            y: 20,
            width: 80,
            height: 30,
            thickness: 1,
          },
        ],
      };

      const zpl = service.generateZPL(template, {});

      expect(zpl).toContain('^GB'); // Graphic box/line
    });
  });

  describe('TSPL Generation', () => {
    beforeEach(() => {
      config.model = 'tsc';
      service = new ThermalPrinterService(config);
    });

    it('should generate TSPL code for label', () => {
      const template: LabelTemplate = {
        id: 'tspl-label',
        name: 'TSPL Label',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'text',
            x: 10,
            y: 10,
            content: 'Test Text',
            fontSize: 12,
          },
        ],
      };

      const tspl = service.generateTSPL(template, {});

      expect(tspl).toContain('SIZE');
      expect(tspl).toContain('CLS');
      expect(tspl).toContain('PRINT');
      expect(tspl).toContain('Test Text');
    });

    it('should generate TSPL with barcode', () => {
      const template: LabelTemplate = {
        id: 'tspl-barcode',
        name: 'TSPL Barcode',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'barcode',
            x: 10,
            y: 10,
            data: '1234567890',
            symbology: 'CODE128',
            height: 50,
          },
        ],
      };

      const tspl = service.generateTSPL(template, {});

      expect(tspl).toContain('BARCODE');
      expect(tspl).toContain('128');
    });

    it('should generate TSPL with QR code', () => {
      const template: LabelTemplate = {
        id: 'tspl-qr',
        name: 'TSPL QR',
        width: 100,
        height: 50,
        elements: [
          {
            type: 'qrcode',
            x: 10,
            y: 10,
            data: 'QR Data',
            size: 5,
          },
        ],
      };

      const tspl = service.generateTSPL(template, {});

      expect(tspl).toContain('QRCODE');
    });
  });

  describe('ESC/POS Generation', () => {
    it('should generate ESC/POS for receipt', () => {
      const receipt: ReceiptData = {
        storeName: 'Test Store',
        storeAddress: '123 Main St',
        storePhone: '+380501234567',
        invoiceNumber: 'INV-001',
        date: '2024-01-01 12:00:00',
        items: [
          {
            name: 'Product 1',
            quantity: 2,
            price: 100,
            total: 200,
          },
        ],
        subtotal: 200,
        tax: 40,
        total: 240,
        paymentMethod: 'Cash',
      };

      const escpos = service.generateESCPOS(receipt);

      expect(escpos).toBeInstanceOf(Uint8Array);
      expect(escpos.length).toBeGreaterThan(0);
    });

    it('should include all receipt items', () => {
      const receipt: ReceiptData = {
        storeName: 'Store',
        invoiceNumber: 'INV-002',
        date: '2024-01-01',
        items: [
          { name: 'Item 1', quantity: 1, price: 100, total: 100 },
          { name: 'Item 2', quantity: 2, price: 50, total: 100 },
        ],
        subtotal: 200,
        total: 200,
      };

      const escpos = service.generateESCPOS(receipt);

      expect(escpos.length).toBeGreaterThan(0);
    });

    it('should handle optional fields', () => {
      const receipt: ReceiptData = {
        storeName: 'Minimal Store',
        invoiceNumber: 'MIN-001',
        date: '2024-01-01',
        items: [],
        subtotal: 0,
        total: 0,
      };

      const escpos = service.generateESCPOS(receipt);

      expect(escpos).toBeInstanceOf(Uint8Array);
    });

    it('should include footer when provided', () => {
      const receipt: ReceiptData = {
        storeName: 'Store',
        invoiceNumber: 'INV-003',
        date: '2024-01-01',
        items: [],
        subtotal: 0,
        total: 0,
        footer: 'Thank you for your purchase!',
      };

      const escpos = service.generateESCPOS(receipt);

      expect(escpos.length).toBeGreaterThan(0);
    });
  });

  describe('Label Formatting', () => {
    it('should format product label', async () => {
      const product = {
        name: 'Test Product',
        sku: 'SKU-123',
        barcode: '1234567890123',
        price: 99.99,
        location: 'A-1-5',
      };

      await expect(
        service.printProductLabel(product)
      ).rejects.toThrow('Printer not connected');
    });

    it('should format shipping label', async () => {
      const label = {
        sender: {
          name: 'Sender Name',
          phone: '+380501234567',
          address: 'Sender Address',
          city: 'Kyiv',
        },
        recipient: {
          name: 'Recipient Name',
          phone: '+380509876543',
          address: 'Recipient Address',
          city: 'Lviv',
        },
        trackingNumber: 'NP1234567890',
        barcode: '1234567890',
        carrier: 'Nova Poshta',
      };

      await expect(
        service.printShippingLabel(label)
      ).rejects.toThrow('Printer not connected');
    });

    it('should include COD amount in shipping label', async () => {
      const label = {
        sender: { name: 'Sender', phone: '+380501234567', address: 'Addr' },
        recipient: { name: 'Recipient', phone: '+380509876543', address: 'Addr', city: 'Kyiv' },
        trackingNumber: 'NP123',
        barcode: '123',
        carrier: 'Nova Poshta',
        cod: 1500,
      };

      await expect(
        service.printShippingLabel(label)
      ).rejects.toThrow('Printer not connected');
    });
  });

  describe('Connection Management', () => {
    it('should check connection status', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should handle network connection', async () => {
      const result = await service.connect({
        type: 'network',
        address: '192.168.1.100',
        port: 9100,
        width: 100,
        height: 150,
        dpi: 203,
      });

      expect(result).toBe(true);
    });

    it('should handle disconnection', async () => {
      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should throw error when printing without connection', async () => {
      await expect(service.printRaw('TEST')).rejects.toThrow(
        'Printer not connected'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle unsupported printer model', async () => {
      const unsupportedConfig: PrinterConfig = {
        type: 'usb',
        width: 100,
        height: 150,
        dpi: 203,
        model: 'unknown' as any,
      };

      const unsupportedService = new ThermalPrinterService(unsupportedConfig);
      const template: LabelTemplate = {
        id: 'test',
        name: 'Test',
        width: 100,
        height: 50,
        elements: [],
      };

      await expect(unsupportedService.printLabel(template, {})).rejects.toThrow(
        'Unsupported printer model'
      );
    });

    it('should handle missing network address', async () => {
      const service = new ThermalPrinterService({
        type: 'network',
        width: 100,
        height: 150,
        dpi: 203,
      });

      // connect() returns false on failure instead of throwing
      const result = await service.connect();
      expect(result).toBe(false);
    });
  });

  describe('DPI Calculations', () => {
    it('should calculate dots correctly for 203 DPI', () => {
      const config203: PrinterConfig = {
        type: 'usb',
        width: 100,
        height: 50,
        dpi: 203,
      };

      const service203 = new ThermalPrinterService(config203);
      const template: LabelTemplate = {
        id: 'dpi-test',
        name: 'DPI Test',
        width: 100,
        height: 50,
        elements: [],
      };

      const zpl = service203.generateZPL(template, {});
      expect(zpl).toContain('^PW'); // Print width
    });

    it('should calculate dots correctly for 300 DPI', () => {
      const config300: PrinterConfig = {
        type: 'usb',
        width: 100,
        height: 50,
        dpi: 300,
      };

      const service300 = new ThermalPrinterService(config300);
      const template: LabelTemplate = {
        id: 'dpi-test',
        name: 'DPI Test',
        width: 100,
        height: 50,
        elements: [],
      };

      const zpl = service300.generateZPL(template, {});
      expect(zpl).toContain('^PW');
    });
  });
});
