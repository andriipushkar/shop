# Довідник API

## Імпорт

```typescript
import {
  forecastDemand,
  generateMockSalesHistory,
  calculateReorderPoint,
  performABCXYZAnalysis,
  detectAnomalies,
  classifyHotColdZones,
  createWavePickingBatches,
  findOptimalShipmentSource,
} from '@/lib/warehouse-analytics';
```

## Функції прогнозування

### forecastDemand

Прогнозує попит на товар.

```typescript
function forecastDemand(
  history: ProductSalesHistory,
  currentStock: number,
  daysAhead: number,
  leadTimeDays: number
): ForecastResult
```

### generateMockSalesHistory

Генерує тестові дані.

```typescript
function generateMockSalesHistory(
  productId: string,
  days: number
): ProductSalesHistory
```

## Функції перезамовлення

### calculateReorderPoint

Розраховує точку перезамовлення.

```typescript
function calculateReorderPoint(
  productId: string,
  productName: string,
  currentStock: number,
  salesHistory: number[],
  leadTimeDays: number,
  serviceLevel: number
): ReorderPoint
```

## Функції ABC-XYZ

### performABCXYZAnalysis

Виконує ABC-XYZ аналіз.

```typescript
function performABCXYZAnalysis(
  products: ABCXYZInput[]
): ABCXYZResult[]
```

## Функції аномалій

### detectAnomalies

Виявляє аномалії в продажах.

```typescript
function detectAnomalies(
  productId: string,
  productName: string,
  salesHistory: SalesData[],
  sensitivity: number
): AnomalyAlert[]
```

## Функції зон

### classifyHotColdZones

Класифікує зони складу.

```typescript
function classifyHotColdZones(
  products: ZoneProduct[]
): HotColdZone[]
```

## Функції хвильового збору

### createWavePickingBatches

Формує хвилі для збору.

```typescript
function createWavePickingBatches(
  orders: Order[],
  maxOrdersPerBatch: number,
  maxItemsPerBatch: number
): WavePickingBatch[]
```

## Функції відвантаження

### findOptimalShipmentSource

Знаходить оптимальне джерело.

```typescript
function findOptimalShipmentSource(
  orderId: string,
  orderItems: OrderItem[],
  customerLocation: Location,
  warehouses: Warehouse[]
): ShipFromStoreResult
```

## Константи

```typescript
// Z-коефіцієнти для рівнів сервісу
const SERVICE_LEVEL_Z = {
  0.90: 1.28,
  0.95: 1.65,
  0.98: 2.05,
  0.99: 2.33
};

// Пороги класифікації зон
const ZONE_THRESHOLDS = {
  hot: 10,
  warm: 5,
  cold: 2
};
```
