# Hardware Integration

Система інтеграції з апаратним забезпеченням: принтери чеків, етикеток, сканери штрих-кодів.

## Overview

Модуль hardware забезпечує:
- Друк чеків на термопринтерах
- Друк етикеток (цінники, штрих-коди)
- Інтеграція зі сканерами штрих-кодів
- Підтримка грошових скриньок
- Ваги та інше торгове обладнання

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    HARDWARE INTEGRATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │  Hardware    │                                               │
│  │  Service     │                                               │
│  └──────┬───────┘                                               │
│         │                                                       │
│         │  Device Abstraction Layer                             │
│         │                                                       │
│  ┌──────┴──────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  ▼              ▼              ▼              ▼              │   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │   │
│  │Receipt │  │ Label  │  │Barcode │  │  Cash  │           │   │
│  │Printer │  │Printer │  │Scanner │  │ Drawer │           │   │
│  │        │  │        │  │        │  │        │           │   │
│  │- Epson │  │- Zebra │  │- USB   │  │- RJ11  │           │   │
│  │- Star  │  │- TSC   │  │- BT    │  │- Serial│           │   │
│  │- Custom│  │- Godex │  │        │  │        │           │   │
│  └────────┘  └────────┘  └────────┘  └────────┘           │   │
│                                                                  │
│  Connection Types:                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                       │
│  │ USB  │  │Serial│  │ BT   │  │Network│                       │
│  └──────┘  └──────┘  └──────┘  └──────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Supported Devices

### Receipt Printers

| Brand | Models | Connection | Protocol |
|-------|--------|------------|----------|
| Epson | TM-T20III, TM-T88VI | USB, Network | ESC/POS |
| Star | TSP100, TSP650 | USB, Network | StarPRNT |
| Custom | KUBE II | USB | ESC/POS |
| Bixolon | SRP-350III | USB, Network | ESC/POS |

### Label Printers

| Brand | Models | Connection | Protocol |
|-------|--------|------------|----------|
| Zebra | ZD420, ZT230 | USB, Network | ZPL |
| TSC | TE200, TTP-244 | USB | TSPL |
| Godex | G500, EZ2050 | USB | EZPL |

### Barcode Scanners

| Brand | Models | Connection |
|-------|--------|------------|
| Honeywell | Voyager 1400g | USB |
| Zebra | DS2208, DS9308 | USB |
| Datalogic | QuickScan QD2430 | USB |

## Configuration

```bash
# Receipt Printer
RECEIPT_PRINTER_ENABLED=true
RECEIPT_PRINTER_TYPE=epson_escpos
RECEIPT_PRINTER_CONNECTION=usb
RECEIPT_PRINTER_PORT=/dev/usb/lp0
RECEIPT_PRINTER_PAPER_WIDTH=80         # mm

# Label Printer
LABEL_PRINTER_ENABLED=true
LABEL_PRINTER_TYPE=zebra_zpl
LABEL_PRINTER_CONNECTION=network
LABEL_PRINTER_IP=192.168.1.100
LABEL_PRINTER_PORT=9100
LABEL_SIZE=57x32                       # mm

# Cash Drawer
CASH_DRAWER_ENABLED=true
CASH_DRAWER_CONNECTION=printer         # Connected via printer RJ11
CASH_DRAWER_PULSE=100                  # ms

# Scanner
SCANNER_MODE=keyboard                  # keyboard, hid, serial
```

## Usage

### Initialize Hardware Service

```typescript
import { hardwareService } from '@/lib/hardware';

// Initialize with config
await hardwareService.initialize({
  receiptPrinter: {
    type: 'epson_escpos',
    connection: 'usb',
    port: '/dev/usb/lp0',
  },
  labelPrinter: {
    type: 'zebra_zpl',
    connection: 'network',
    ip: '192.168.1.100',
    port: 9100,
  },
  cashDrawer: {
    enabled: true,
    connection: 'printer',
  },
});

// Check device status
const status = await hardwareService.getStatus();
console.log('Receipt printer:', status.receiptPrinter);  // 'online' | 'offline'
console.log('Label printer:', status.labelPrinter);
console.log('Cash drawer:', status.cashDrawer);
```

### Print Receipt

```typescript
// Print POS receipt
await hardwareService.printReceipt({
  header: {
    storeName: 'My Shop',
    address: 'м. Київ, вул. Хрещатик, 1',
    phone: '044-123-45-67',
  },
  items: [
    {
      name: 'iPhone 15 Pro',
      quantity: 1,
      price: 45000,
      total: 45000,
    },
    {
      name: 'Чохол для iPhone',
      quantity: 2,
      price: 500,
      discount: 100,
      total: 900,
    },
  ],
  totals: {
    subtotal: 45900,
    discount: 100,
    tax: 7650,
    total: 45900,
  },
  payment: {
    method: 'card',
    amount: 45900,
    change: 0,
  },
  footer: {
    message: 'Дякуємо за покупку!',
    fiscalCode: '1234567890',
    qrCode: 'https://receipt.tax.gov.ua/...',
  },
});
```

### Print Label

```typescript
// Print price label
await hardwareService.printLabel({
  type: 'price_tag',
  size: '57x32',
  data: {
    productName: 'iPhone 15 Pro',
    price: 45000,
    oldPrice: 48000,
    barcode: '4823012345678',
    sku: 'IPHONE15PRO-256',
  },
});

// Print barcode label
await hardwareService.printLabel({
  type: 'barcode',
  size: '40x20',
  data: {
    barcode: '4823012345678',
    text: 'IPHONE15PRO-256',
  },
});

// Batch print labels
await hardwareService.printLabels({
  type: 'price_tag',
  products: productIds,
  copies: 2,
});
```

### Open Cash Drawer

```typescript
// Open drawer
await hardwareService.openCashDrawer();

// Open with delay (for coin dispensing)
await hardwareService.openCashDrawer({ pulseMs: 200 });
```

### Barcode Scanner

```typescript
// Listen for scans (keyboard mode)
hardwareService.onBarcodeScan((barcode) => {
  console.log('Scanned:', barcode);
  // Look up product
  const product = await findProductByBarcode(barcode);
  if (product) {
    addToCart(product);
  }
});

// Manual barcode lookup
const barcode = await hardwareService.waitForScan({ timeout: 30000 });
```

## ESC/POS Commands

### Receipt Formatting

```typescript
// Low-level ESC/POS
const escpos = hardwareService.getEscPos();

escpos.initialize();
escpos.setAlignment('center');
escpos.setBold(true);
escpos.setTextSize(2, 2);
escpos.text('MY SHOP');
escpos.setBold(false);
escpos.setTextSize(1, 1);
escpos.newLine();
escpos.setAlignment('left');
escpos.text('м. Київ, вул. Хрещатик, 1');
escpos.newLine();
escpos.separator('-');
// ... items
escpos.separator('=');
escpos.setAlignment('right');
escpos.setBold(true);
escpos.text('ВСЬОГО: 45900.00 грн');
escpos.newLine(3);
escpos.setAlignment('center');
escpos.printQR('https://receipt.tax.gov.ua/...', 6);
escpos.cut();

await escpos.send();
```

## ZPL Commands

### Label Templates

```typescript
// Price tag template (ZPL)
const zpl = `
^XA
^FO20,20^A0N,30,30^FD{{productName}}^FS
^FO20,60^A0N,50,50^FD{{price}} грн^FS
^FO20,120^BY2^BCN,80,Y,N,N^FD{{barcode}}^FS
^XZ
`;

await hardwareService.printZPL(zpl, {
  productName: 'iPhone 15 Pro',
  price: '45 000',
  barcode: '4823012345678',
});
```

## Web USB (Browser)

```typescript
// Request USB device access
const printer = await hardwareService.requestUSBDevice({
  filters: [
    { vendorId: 0x04b8 }, // Epson
    { vendorId: 0x0519 }, // Star
  ],
});

// Print via WebUSB
await printer.print(receiptData);
```

## API Endpoints

```
GET  /api/v1/hardware/status           # Device status
POST /api/v1/hardware/receipt/print    # Print receipt
POST /api/v1/hardware/label/print      # Print label
POST /api/v1/hardware/label/batch      # Batch print labels
POST /api/v1/hardware/drawer/open      # Open cash drawer
GET  /api/v1/hardware/templates        # Label templates
POST /api/v1/hardware/templates        # Create template
```

### Print Receipt Request

```json
POST /api/v1/hardware/receipt/print
{
  "printerId": "pos-1",
  "receipt": {
    "items": [...],
    "totals": {...},
    "payment": {...}
  }
}
```

## Print Server

For network printing from browser:

```bash
# Start print server
docker run -d \
  --name print-server \
  -p 9100:9100 \
  -v /dev:/dev \
  --privileged \
  shop/print-server
```

```typescript
// Connect to print server
const printServer = new PrintServer('ws://localhost:9100');

await printServer.printReceipt(receipt);
```

## Troubleshooting

### Printer Not Found

```bash
# List USB devices (Linux)
lsusb

# Check permissions
sudo chmod 666 /dev/usb/lp0

# Add user to lp group
sudo usermod -a -G lp $USER
```

### Print Quality Issues

- Check paper width setting
- Clean print head
- Check paper alignment
- Verify correct driver/protocol

### Scanner Not Working

- Check USB connection
- Verify HID mode settings
- Program scanner for correct keyboard layout

## Best Practices

1. **Error handling** - Always handle printer offline
2. **Print queue** - Queue prints during offline
3. **Paper checks** - Monitor paper status
4. **Regular maintenance** - Clean print heads
5. **Test prints** - Test after setup
6. **Fallback** - Have backup printing method

## See Also

- [POS System](./WAREHOUSE.md#pos-point-of-sale)
- [Fiscal Integration](./FISCAL.md)
- [Mobile Scanner](./WAREHOUSE.md#mobile-scanner)
