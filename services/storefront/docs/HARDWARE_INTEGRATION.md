# Hardware Integration Module

Модуль інтеграції складського обладнання - сканерів штрих-кодів та термопринтерів.

## Можливості

### Сканери штрих-кодів

- **Keyboard Wedge** - підтримка звичайних USB сканерів
- **DataWedge** - інтеграція з професійними ТЗД (Zebra, Honeywell, Datalogic)
- Автоматичне визначення типу сканування vs ручне введення
- Валідація штрих-кодів
- Історія сканування
- Підтримка різних форматів: EAN-13, EAN-8, CODE128, QR

### Термопринтери

- **Zebra** (ZPL) - найпопулярніші етикеткові принтери
- **TSC** (TSPL) - доступні етикеткові принтери
- **Xprinter, Brother** - чекові принтери (ESC/POS)
- Друк накладних (Nova Poshta стиль)
- Друк товарних етикеток
- Друк чеків
- WebUSB підтримка (Chrome)
- Локальний принт-сервер для enterprise

## Структура файлів

```
lib/hardware/
├── datawedge.ts           # DataWedge інтеграція для ТЗД
├── keyboard-wedge.ts      # Keyboard Wedge для USB сканерів
├── thermal-printer.ts     # Термопринтери (ZPL, TSPL, ESC/POS)
└── print-server.ts        # Клієнт локального принт-сервера

app/api/hardware/
├── printers/
│   ├── route.ts           # CRUD принтерів
│   └── [id]/route.ts      # Операції з окремим принтером
└── print/
    ├── route.ts           # Загальний друк
    ├── label/route.ts     # Друк накладних
    └── product-label/route.ts  # Друк товарних етикеток

components/hardware/
├── ScannerInput.tsx       # Компонент вводу зі сканера
└── PrintButton.tsx        # Кнопка друку

app/admin/settings/hardware/
└── page.tsx               # Сторінка налаштувань
```

## Швидкий старт

### 1. Налаштування сканера

```tsx
import { ScannerInput } from '@/components/hardware/ScannerInput';

function MyComponent() {
  const handleScan = (barcode: string) => {
    console.log('Scanned:', barcode);
    // Обробити штрих-код
  };

  return (
    <ScannerInput
      onScan={handleScan}
      validate={(barcode) => {
        // Валідація (необов'язково)
        if (barcode.length < 8) {
          return 'Штрих-код занадто короткий';
        }
        return true;
      }}
      showHistory={true}
    />
  );
}
```

### 2. Використання сканера в формі

```tsx
import { InlineScannerInput } from '@/components/hardware/ScannerInput';

function ProductForm() {
  const [barcode, setBarcode] = useState('');

  return (
    <InlineScannerInput
      value={barcode}
      onChange={setBarcode}
      placeholder="Скануйте штрих-код"
    />
  );
}
```

### 3. Друк етикеток

```tsx
import { PrintButton } from '@/components/hardware/PrintButton';

function ShippingLabelComponent() {
  const generateLabel = async () => {
    const response = await fetch('/api/hardware/print/label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: {
          sender: {
            name: 'Інтернет-магазин',
            phone: '+380501234567',
            address: 'вул. Хрещатик, 1',
          },
          recipient: {
            name: 'Іван Іваненко',
            phone: '+380671234567',
            address: 'вул. Соборна, 10',
            city: 'Київ',
          },
          trackingNumber: '59001234567890',
          barcode: '59001234567890',
          carrier: 'Нова Пошта',
        },
      }),
    });

    return await response.json();
  };

  return (
    <PrintButton
      label="Друк накладної"
      content={generateLabel}
      printerType="label"
      onSuccess={(jobId) => console.log('Printed:', jobId)}
    />
  );
}
```

### 4. Друк товарних етикеток

```tsx
function ProductLabelButton({ product }: { product: Product }) {
  const handlePrint = async () => {
    const response = await fetch('/api/hardware/print/product-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price,
          location: product.warehouseLocation,
        },
        copies: 2, // Друк 2 копій
      }),
    });

    return await response.json();
  };

  return (
    <PrintButton
      label="Друк етикетки"
      content={handlePrint}
      printerType="label"
      size="sm"
    />
  );
}
```

## Hooks для сканерів

### useKeyboardScanner

Автоматичне підключення keyboard wedge сканера:

```tsx
import { useKeyboardScanner } from '@/lib/hardware/keyboard-wedge';

function Component() {
  const scanner = useKeyboardScanner({
    minLength: 8,
    maxLength: 13,
    onlyNumeric: true, // Тільки цифри (для EAN)
    timeout: 100, // Таймаут між символами
  });

  useEffect(() => {
    if (scanner.lastScan) {
      console.log('Scanned:', scanner.lastScan);
      scanner.clearLastScan();
    }
  }, [scanner.lastScan]);

  return <div>Scan count: {scanner.scanCount}</div>;
}
```

### useDataWedge

Для професійних ТЗД (Zebra, Honeywell):

```tsx
import { useDataWedge } from '@/lib/hardware/datawedge';

function Component() {
  const { lastScan, isAvailable, triggerScan } = useDataWedge({
    profileName: 'MyApp',
  });

  useEffect(() => {
    if (lastScan) {
      console.log('Scanned:', lastScan.data);
      console.log('Symbology:', lastScan.symbology);
    }
  }, [lastScan]);

  return (
    <div>
      {isAvailable ? (
        <button onClick={triggerScan}>Сканувати</button>
      ) : (
        <span>DataWedge недоступний</span>
      )}
    </div>
  );
}
```

## Робота з принтерами

### Налаштування принтера

1. Відкрийте `/admin/settings/hardware`
2. Перейдіть на вкладку "Принтери"
3. Натисніть "Додати принтер"
4. Заповніть форму:
   - Назва (наприклад: "Zebra ZD420")
   - Тип: Етикетки / Чеки
   - Підключення: Мережа / USB / Bluetooth
   - IP адреса (для мережевих): 192.168.1.100
   - Розмір етикетки: 100x150мм
   - DPI: 203 або 300
   - Модель: Zebra (ZPL) / TSC (TSPL) / Xprinter
5. Натисніть "Тестувати" для перевірки

### Генерація ZPL для Zebra

```typescript
import { ThermalPrinterService } from '@/lib/hardware/thermal-printer';

const printer = new ThermalPrinterService({
  type: 'network',
  address: '192.168.1.100',
  port: 9100,
  width: 100,
  height: 150,
  dpi: 203,
  model: 'zebra',
});

await printer.connect();

// Друк товарної етикетки
await printer.printProductLabel({
  name: 'Товар 123',
  sku: 'SKU-001',
  barcode: '4820024700016',
  price: 299.99,
  location: 'A-12-03',
});
```

### Генерація TSPL для TSC

```typescript
const printer = new ThermalPrinterService({
  type: 'network',
  address: '192.168.1.101',
  width: 100,
  height: 150,
  dpi: 203,
  model: 'tsc',
});

const template = {
  id: 'custom',
  name: 'Custom Label',
  width: 100,
  height: 150,
  elements: [
    { type: 'text', x: 10, y: 10, content: 'Hello', fontSize: 24 },
    { type: 'barcode', x: 10, y: 50, data: '123456789', symbology: 'CODE128', height: 50 },
  ],
};

const tspl = printer.generateTSPL(template, {});
console.log(tspl);
```

### Друк чеків (ESC/POS)

```typescript
const receipt = {
  storeName: 'Інтернет-магазин',
  storeAddress: 'вул. Хрещатик, 1, Київ',
  storePhone: '+380501234567',
  invoiceNumber: 'INV-2024-001',
  date: new Date().toLocaleString('uk-UA'),
  items: [
    { name: 'Товар 1', quantity: 2, price: 100, total: 200 },
    { name: 'Товар 2', quantity: 1, price: 150, total: 150 },
  ],
  subtotal: 350,
  tax: 58.33,
  total: 408.33,
  paymentMethod: 'Готівка',
  footer: 'Дякуємо за покупку!',
};

const escpos = printer.generateESCPOS(receipt);
await printer.printRaw(new TextDecoder().decode(escpos));
```

## Локальний принт-сервер (Enterprise)

Для друку без діалогових вікон браузера використовуйте локальний принт-сервер.

### Встановлення сервера

```bash
# Node.js implementation (приклад)
npm install -g warehouse-print-server

# Запуск
warehouse-print-server --port 9100
```

### Використання клієнта

```typescript
import { PrintServerClient } from '@/lib/hardware/print-server';

const client = new PrintServerClient({
  serverUrl: 'http://localhost:9100',
  apiKey: 'your-api-key', // Опціонально
});

// Отримати список принтерів
const printers = await client.getPrinters();

// Друк
const job = await client.printLabel('Zebra ZD420', zplContent);
console.log('Job ID:', job.id);

// Перевірка статусу
const status = await client.getJobStatus(job.id);
console.log('Status:', status.status);

// Очікування завершення
const completed = await client.waitForCompletion(job.id);
```

### Auto-discovery

```typescript
import { PrintServerDiscovery } from '@/lib/hardware/print-server';

// Автоматичний пошук сервера
const serverUrl = await PrintServerDiscovery.discover();

if (serverUrl) {
  console.log('Print server found at:', serverUrl);
} else {
  console.log('Print server not found');
}
```

## API Reference

### POST /api/hardware/printers

Додати новий принтер.

**Body:**
```json
{
  "name": "Zebra ZD420",
  "type": "label",
  "connection": "network",
  "address": "192.168.1.100",
  "port": 9100,
  "width": 100,
  "height": 150,
  "dpi": 203,
  "model": "zebra",
  "default": true,
  "enabled": true
}
```

### GET /api/hardware/printers

Отримати список принтерів.

**Query params:**
- `type` - фільтр по типу (label, receipt, thermal)
- `enabled` - тільки увімкнені (true/false)

### DELETE /api/hardware/printers/{id}

Видалити принтер.

### POST /api/hardware/print

Відправити завдання на друк.

**Body:**
```json
{
  "printerId": "printer_123",
  "content": "^XA^FO50,50^A0N,50,50^FDHello^FS^XZ",
  "type": "zpl",
  "copies": 1
}
```

### POST /api/hardware/print/label

Друк накладної.

**Body:**
```json
{
  "printerName": "Zebra ZD420",
  "label": {
    "sender": { "name": "...", "phone": "...", "address": "..." },
    "recipient": { "name": "...", "phone": "...", "address": "...", "city": "..." },
    "trackingNumber": "59001234567890",
    "barcode": "59001234567890",
    "carrier": "Нова Пошта"
  }
}
```

### POST /api/hardware/print/product-label

Друк товарної етикетки.

**Body:**
```json
{
  "printerName": "Zebra ZD420",
  "product": {
    "name": "Товар 123",
    "sku": "SKU-001",
    "barcode": "4820024700016",
    "price": 299.99,
    "location": "A-12-03"
  },
  "copies": 2
}
```

## Підтримувані пристрої

### Сканери

- **Zebra** DS2208, DS4308, DS8100, TC52, TC57
- **Honeywell** Voyager 1200g, Xenon 1900, CT40
- **Datalogic** QuickScan QBT2131, Gryphon GBT4500
- **Symbol/Motorola** LS2208, LI4278
- Будь-які USB сканери з keyboard wedge

### Принтери

#### Етикеткові (ZPL)
- **Zebra** ZD220, ZD420, ZD620, ZT411, ZT510
- **TSC** TTP-244, TTP-342, TTP-644

#### Чекові (ESC/POS)
- **Xprinter** XP-80, XP-58
- **Epson** TM-T20, TM-T82
- **Star** TSP100, TSP650

## Troubleshooting

### Сканер не працює

1. **Перевірте режим сканера**: переконайтесь, що сканер в режимі Keyboard Wedge (HID)
2. **USB підключення**: деякі сканери потребують налаштування через утиліту виробника
3. **Налаштування швидкості**: збільште `timeout` в конфігурації

### Принтер не друкує

1. **IP адреса**: перевірте ping до принтера
2. **Порт**: стандартний порт 9100 (RAW), для деяких 9101
3. **Мова принтера**: переконайтесь що використовуєте правильну мову (ZPL/TSPL)
4. **Тестування**: використовуйте кнопку "Тестувати" в налаштуваннях

### WebUSB не працює

1. Працює тільки в Chrome/Edge
2. Потрібен HTTPS (або localhost)
3. Користувач має надати дозвіл

## Безпека

- API принтерів доступний тільки авторизованим користувачам
- Print server має використовувати API ключ
- В production використовуйте HTTPS
- Локальний print server - тільки для довірених мереж

## Ліцензія

MIT License

---

**Автор:** Warehouse Management System
**Версія:** 1.0.0
**Дата:** 2024
