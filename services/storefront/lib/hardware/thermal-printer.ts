/**
 * Thermal Printer Integration
 * Друк етикеток та чеків на термопринтери
 * Zebra, Xprinter, TSC, Brother
 */

'use client';

export interface PrinterConfig {
  type: 'usb' | 'network' | 'bluetooth';
  address?: string; // IP for network, or device path
  port?: number;
  width: number; // Label width in mm
  height: number; // Label height in mm
  dpi: 203 | 300;
  model?: 'zebra' | 'tsc' | 'xprinter' | 'brother' | 'generic';
}

export interface LabelTemplate {
  id: string;
  name: string;
  width: number; // in mm
  height: number; // in mm
  elements: LabelElement[];
}

export type LabelElement =
  | {
      type: 'text';
      x: number;
      y: number;
      content: string;
      fontSize: number;
      bold?: boolean;
      font?: string;
      rotation?: 0 | 90 | 180 | 270;
    }
  | {
      type: 'barcode';
      x: number;
      y: number;
      data: string;
      symbology: 'EAN13' | 'CODE128' | 'QR' | 'CODE39';
      height: number;
      showText?: boolean;
      width?: number;
    }
  | {
      type: 'qrcode';
      x: number;
      y: number;
      data: string;
      size: number;
      errorCorrection?: 'L' | 'M' | 'Q' | 'H';
    }
  | {
      type: 'image';
      x: number;
      y: number;
      src: string;
      width: number;
      height: number;
    }
  | {
      type: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      thickness: number;
    }
  | {
      type: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      thickness: number;
      filled?: boolean;
    };

export interface ShippingLabel {
  sender: {
    name: string;
    phone: string;
    address: string;
    city?: string;
  };
  recipient: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  trackingNumber: string;
  barcode: string;
  weight?: number;
  cod?: number; // Cash on delivery
  carrier: string;
  carrierLogo?: string;
  deliveryDate?: string;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  invoiceNumber: string;
  date: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod?: string;
  footer?: string;
}

export interface PrinterInfo {
  name: string;
  type: 'usb' | 'network' | 'bluetooth';
  status: 'ready' | 'busy' | 'offline' | 'error';
  model?: string;
}

export class ThermalPrinterService {
  private config: PrinterConfig;
  private connected = false;
  private socket: WebSocket | null = null;

  constructor(config: PrinterConfig) {
    this.config = config;
  }

  /**
   * Connect to printer
   */
  async connect(config?: PrinterConfig): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      if (this.config.type === 'network') {
        await this.connectNetwork();
      } else if (this.config.type === 'usb') {
        await this.connectUSB();
      } else if (this.config.type === 'bluetooth') {
        await this.connectBluetooth();
      }

      this.connected = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to printer:', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Connect via network
   */
  private async connectNetwork(): Promise<void> {
    const { address, port } = this.config;
    if (!address) {
      throw new Error('Network address not specified');
    }

    // In real implementation, this would connect via WebSocket to a print server
    // or use a native printer driver
    console.log(`Connecting to network printer at ${address}:${port || 9100}`);
  }

  /**
   * Connect via USB (WebUSB)
   */
  private async connectUSB(): Promise<void> {
    if (!navigator.usb) {
      throw new Error('WebUSB not supported in this browser');
    }

    // Request USB device
    // In production, this would use WebUSB API
    console.log('Requesting USB printer...');
  }

  /**
   * Connect via Bluetooth
   */
  private async connectBluetooth(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth not supported in this browser');
    }

    // Request Bluetooth device
    console.log('Requesting Bluetooth printer...');
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Print raw ZPL/TSPL commands
   */
  async printRaw(commands: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Printer not connected');
    }

    // In production, send to printer via appropriate connection
    console.log('Printing raw commands:', commands);
  }

  /**
   * Print label from template
   */
  async printLabel(template: LabelTemplate, data: Record<string, string>): Promise<void> {
    const model = this.config.model || 'zebra';

    let commands: string;
    if (model === 'zebra') {
      commands = this.generateZPL(template, data);
    } else if (model === 'tsc') {
      commands = this.generateTSPL(template, data);
    } else {
      throw new Error(`Unsupported printer model: ${model}`);
    }

    await this.printRaw(commands);
  }

  /**
   * Print shipping label (Nova Poshta style)
   */
  async printShippingLabel(label: ShippingLabel): Promise<void> {
    const template: LabelTemplate = {
      id: 'shipping-label',
      name: 'Shipping Label',
      width: 100,
      height: 150,
      elements: [
        // Header
        {
          type: 'text',
          x: 10,
          y: 10,
          content: label.carrier,
          fontSize: 24,
          bold: true,
        },

        // Tracking number
        {
          type: 'text',
          x: 10,
          y: 40,
          content: `№ ${label.trackingNumber}`,
          fontSize: 16,
        },

        // Barcode
        {
          type: 'barcode',
          x: 10,
          y: 60,
          data: label.barcode,
          symbology: 'CODE128',
          height: 60,
          showText: true,
        },

        // Divider line
        {
          type: 'line',
          x1: 10,
          y1: 130,
          x2: 90,
          y2: 130,
          thickness: 2,
        },

        // Sender
        {
          type: 'text',
          x: 10,
          y: 140,
          content: 'Відправник:',
          fontSize: 10,
          bold: true,
        },
        {
          type: 'text',
          x: 10,
          y: 155,
          content: label.sender.name,
          fontSize: 12,
        },
        {
          type: 'text',
          x: 10,
          y: 170,
          content: label.sender.phone,
          fontSize: 10,
        },

        // Divider line
        {
          type: 'line',
          x1: 10,
          y1: 185,
          x2: 90,
          y2: 185,
          thickness: 2,
        },

        // Recipient
        {
          type: 'text',
          x: 10,
          y: 195,
          content: 'Одержувач:',
          fontSize: 10,
          bold: true,
        },
        {
          type: 'text',
          x: 10,
          y: 210,
          content: label.recipient.name,
          fontSize: 14,
          bold: true,
        },
        {
          type: 'text',
          x: 10,
          y: 225,
          content: label.recipient.phone,
          fontSize: 12,
        },
        {
          type: 'text',
          x: 10,
          y: 240,
          content: label.recipient.city,
          fontSize: 14,
          bold: true,
        },
        {
          type: 'text',
          x: 10,
          y: 255,
          content: label.recipient.address,
          fontSize: 10,
        },

        // Additional info
        ...(label.weight
          ? [
              {
                type: 'text' as const,
                x: 10,
                y: 280,
                content: `Вага: ${label.weight} кг`,
                fontSize: 10,
              },
            ]
          : []),

        ...(label.cod
          ? [
              {
                type: 'text' as const,
                x: 10,
                y: 295,
                content: `Накладений платіж: ${label.cod} грн`,
                fontSize: 12,
                bold: true,
              },
            ]
          : []),
      ],
    };

    await this.printLabel(template, {});
  }

  /**
   * Print product label
   */
  async printProductLabel(product: {
    name: string;
    sku: string;
    barcode: string;
    price: number;
    location?: string;
  }): Promise<void> {
    const template: LabelTemplate = {
      id: 'product-label',
      name: 'Product Label',
      width: 60,
      height: 40,
      elements: [
        // Product name
        {
          type: 'text',
          x: 5,
          y: 5,
          content: product.name,
          fontSize: 12,
          bold: true,
        },

        // SKU
        {
          type: 'text',
          x: 5,
          y: 20,
          content: `SKU: ${product.sku}`,
          fontSize: 8,
        },

        // Barcode
        {
          type: 'barcode',
          x: 5,
          y: 30,
          data: product.barcode,
          symbology: 'EAN13',
          height: 40,
          showText: true,
        },

        // Price
        {
          type: 'text',
          x: 5,
          y: 75,
          content: `${product.price.toFixed(2)} грн`,
          fontSize: 16,
          bold: true,
        },

        // Location
        ...(product.location
          ? [
              {
                type: 'text' as const,
                x: 5,
                y: 95,
                content: `Місце: ${product.location}`,
                fontSize: 8,
              },
            ]
          : []),
      ],
    };

    await this.printLabel(template, {});
  }

  /**
   * Print receipt
   */
  async printReceipt(receipt: ReceiptData): Promise<void> {
    const escpos = this.generateESCPOS(receipt);
    await this.printRaw(new TextDecoder().decode(escpos));
  }

  /**
   * Generate ZPL code for Zebra printers
   */
  generateZPL(template: LabelTemplate, data: Record<string, string>): string {
    const dpmm = this.config.dpi / 25.4; // dots per mm
    const labelWidthDots = Math.round(template.width * dpmm);
    const labelHeightDots = Math.round(template.height * dpmm);

    let zpl = '^XA\n'; // Start format
    zpl += `^PW${labelWidthDots}\n`; // Print width
    zpl += `^LL${labelHeightDots}\n`; // Label length

    template.elements.forEach((element) => {
      const x = Math.round(element.x * dpmm);
      const y = Math.round(element.y * dpmm);

      switch (element.type) {
        case 'text': {
          const content = this.replaceVariables(element.content, data);
          const fontSize = Math.round(element.fontSize * dpmm);
          zpl += `^FO${x},${y}\n`;
          zpl += `^A0N,${fontSize},${fontSize}\n`;
          zpl += `^FD${content}^FS\n`;
          break;
        }

        case 'barcode': {
          const barcodeData = this.replaceVariables(element.data, data);
          const height = Math.round(element.height * dpmm);
          const symbology = this.getZPLBarcodeType(element.symbology);
          zpl += `^FO${x},${y}\n`;
          zpl += `^BY2,3,${height}\n`;
          zpl += `^${symbology}N,${height},${element.showText ? 'Y' : 'N'}\n`;
          zpl += `^FD${barcodeData}^FS\n`;
          break;
        }

        case 'qrcode': {
          const qrData = this.replaceVariables(element.data, data);
          const size = element.size || 3;
          zpl += `^FO${x},${y}\n`;
          zpl += `^BQN,2,${size}\n`;
          zpl += `^FDQA,${qrData}^FS\n`;
          break;
        }

        case 'line': {
          const x2 = Math.round(element.x2 * dpmm);
          const y2 = Math.round(element.y2 * dpmm);
          const thickness = Math.round(element.thickness * dpmm);
          const width = Math.abs(x2 - x);
          const height = Math.abs(y2 - y);
          zpl += `^FO${x},${y}\n`;
          zpl += `^GB${width},${height},${thickness}^FS\n`;
          break;
        }

        case 'rectangle': {
          const width = Math.round(element.width * dpmm);
          const height = Math.round(element.height * dpmm);
          const thickness = Math.round(element.thickness * dpmm);
          zpl += `^FO${x},${y}\n`;
          zpl += `^GB${width},${height},${thickness}^FS\n`;
          break;
        }
      }
    });

    zpl += '^XZ\n'; // End format
    return zpl;
  }

  /**
   * Generate TSPL code for TSC printers
   */
  generateTSPL(template: LabelTemplate, data: Record<string, string>): string {
    const dpmm = this.config.dpi / 25.4;
    const labelWidthDots = Math.round(template.width * dpmm);
    const labelHeightDots = Math.round(template.height * dpmm);

    let tspl = `SIZE ${template.width} mm, ${template.height} mm\n`;
    tspl += `GAP 2 mm, 0 mm\n`;
    tspl += `DIRECTION 1\n`;
    tspl += `REFERENCE 0,0\n`;
    tspl += `OFFSET 0 mm\n`;
    tspl += `SET PEEL OFF\n`;
    tspl += `SET CUTTER OFF\n`;
    tspl += `SET PARTIAL_CUTTER OFF\n`;
    tspl += `SET TEAR ON\n`;
    tspl += `CLS\n`;

    template.elements.forEach((element) => {
      const x = Math.round(element.x * dpmm);
      const y = Math.round(element.y * dpmm);

      switch (element.type) {
        case 'text': {
          const content = this.replaceVariables(element.content, data);
          const fontSize = Math.round(element.fontSize * dpmm);
          tspl += `TEXT ${x},${y},"0",0,1,1,"${content}"\n`;
          break;
        }

        case 'barcode': {
          const barcodeData = this.replaceVariables(element.data, data);
          const height = Math.round(element.height * dpmm);
          const symbology = this.getTSPLBarcodeType(element.symbology);
          tspl += `BARCODE ${x},${y},"${symbology}",${height},1,0,2,2,"${barcodeData}"\n`;
          break;
        }

        case 'qrcode': {
          const qrData = this.replaceVariables(element.data, data);
          const size = element.size || 5;
          tspl += `QRCODE ${x},${y},M,${size},A,0,"${qrData}"\n`;
          break;
        }
      }
    });

    tspl += `PRINT 1,1\n`;
    return tspl;
  }

  /**
   * Generate ESC/POS for receipt printers
   */
  generateESCPOS(receipt: ReceiptData): Uint8Array {
    const commands: number[] = [];

    // Initialize
    commands.push(0x1b, 0x40); // ESC @

    // Set alignment center
    commands.push(0x1b, 0x61, 0x01);

    // Store name (bold, large)
    commands.push(0x1b, 0x21, 0x30); // Double height/width
    this.addText(commands, receipt.storeName);
    commands.push(0x0a); // Line feed

    // Normal size
    commands.push(0x1b, 0x21, 0x00);

    // Store info
    if (receipt.storeAddress) {
      this.addText(commands, receipt.storeAddress);
      commands.push(0x0a);
    }
    if (receipt.storePhone) {
      this.addText(commands, receipt.storePhone);
      commands.push(0x0a);
    }

    commands.push(0x0a); // Empty line

    // Alignment left
    commands.push(0x1b, 0x61, 0x00);

    // Invoice number and date
    this.addText(commands, `Чек: ${receipt.invoiceNumber}`);
    commands.push(0x0a);
    this.addText(commands, `Дата: ${receipt.date}`);
    commands.push(0x0a);

    // Divider
    this.addText(commands, '-'.repeat(48));
    commands.push(0x0a);

    // Items
    receipt.items.forEach((item) => {
      const name = this.truncate(item.name, 30);
      const qty = item.quantity.toString();
      const price = item.price.toFixed(2);
      const total = item.total.toFixed(2);

      this.addText(commands, name);
      commands.push(0x0a);
      this.addText(commands, `  ${qty} x ${price} = ${total} грн`);
      commands.push(0x0a);
    });

    // Divider
    this.addText(commands, '-'.repeat(48));
    commands.push(0x0a);

    // Totals
    this.addText(commands, `Підсумок: ${receipt.subtotal.toFixed(2)} грн`);
    commands.push(0x0a);

    if (receipt.discount) {
      this.addText(commands, `Знижка: -${receipt.discount.toFixed(2)} грн`);
      commands.push(0x0a);
    }

    if (receipt.tax) {
      this.addText(commands, `ПДВ: ${receipt.tax.toFixed(2)} грн`);
      commands.push(0x0a);
    }

    // Total (bold)
    commands.push(0x1b, 0x21, 0x08); // Bold
    this.addText(commands, `ВСЬОГО: ${receipt.total.toFixed(2)} грн`);
    commands.push(0x1b, 0x21, 0x00); // Normal
    commands.push(0x0a);

    if (receipt.paymentMethod) {
      commands.push(0x0a);
      this.addText(commands, `Оплата: ${receipt.paymentMethod}`);
      commands.push(0x0a);
    }

    // Footer
    if (receipt.footer) {
      commands.push(0x0a);
      commands.push(0x1b, 0x61, 0x01); // Center
      this.addText(commands, receipt.footer);
      commands.push(0x0a);
    }

    // Cut paper
    commands.push(0x0a, 0x0a, 0x0a);
    commands.push(0x1d, 0x56, 0x41, 0x00); // GS V

    return new Uint8Array(commands);
  }

  /**
   * Helper: Add text to ESC/POS command array
   */
  private addText(commands: number[], text: string): void {
    for (let i = 0; i < text.length; i++) {
      commands.push(text.charCodeAt(i));
    }
  }

  /**
   * Helper: Truncate text
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Replace template variables
   */
  private replaceVariables(text: string, data: Record<string, string>): string {
    let result = text;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  /**
   * Helper: Get ZPL barcode type
   */
  private getZPLBarcodeType(symbology: string): string {
    const types: Record<string, string> = {
      EAN13: 'BE',
      CODE128: 'BC',
      QR: 'BQ',
      CODE39: 'B3',
    };
    return types[symbology] || 'BC';
  }

  /**
   * Helper: Get TSPL barcode type
   */
  private getTSPLBarcodeType(symbology: string): string {
    const types: Record<string, string> = {
      EAN13: 'EAN13',
      CODE128: '128',
      CODE39: '39',
    };
    return types[symbology] || '128';
  }
}

/**
 * WebUSB printer connection (Chrome only)
 */
export class WebUSBPrinter {
  private device: USBDevice | null = null;

  async requestDevice(): Promise<USBDevice | null> {
    if (!navigator.usb) {
      throw new Error('WebUSB not supported');
    }

    try {
      this.device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x0a5f }, // Zebra
          { vendorId: 0x1504 }, // TSC
          { vendorId: 0x0483 }, // Xprinter
        ],
      });
      return this.device;
    } catch (error) {
      console.error('Failed to request USB device:', error);
      return null;
    }
  }

  async connect(device: USBDevice): Promise<void> {
    this.device = device;

    try {
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);
    } catch (error) {
      console.error('Failed to connect to USB device:', error);
      throw error;
    }
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error('No device connected');
    }

    try {
      // Find OUT endpoint
      const interfaces = this.device.configuration?.interfaces || [];
      const iface = interfaces[0];
      const alternate = iface.alternates[0];
      const endpoint = alternate.endpoints.find((ep) => ep.direction === 'out');

      if (!endpoint) {
        throw new Error('No OUT endpoint found');
      }

      await this.device.transferOut(endpoint.endpointNumber, data);
    } catch (error) {
      console.error('Failed to print:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
      } catch (error) {
        console.error('Failed to disconnect:', error);
      }
      this.device = null;
    }
  }
}
