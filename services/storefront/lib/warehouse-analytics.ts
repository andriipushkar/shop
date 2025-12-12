/**
 * Warehouse Analytics Library
 * Легкі AI/ML алгоритми для аналітики складу
 * Працює повністю в браузері без серверного навантаження
 */

// ============================================
// ТИПИ ДАНИХ
// ============================================

export interface SalesData {
  date: string; // ISO date string
  productId: string;
  quantity: number;
  revenue: number;
}

export interface ProductSalesHistory {
  productId: string;
  productName: string;
  dailySales: { date: string; quantity: number; revenue: number }[];
}

export interface ForecastResult {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  forecast: { date: string; predicted: number; lower: number; upper: number }[];
  trend: 'growing' | 'stable' | 'declining';
  trendPercent: number;
  seasonalityIndex: number[];
  daysUntilStockout: number | null;
  recommendedReorderDate: string | null;
}

export interface ReorderPoint {
  productId: string;
  productName: string;
  currentStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  status: 'ok' | 'reorder_now' | 'critical' | 'overstock';
  daysOfStock: number;
}

export interface AnomalyAlert {
  id: string;
  productId: string;
  productName: string;
  type: 'spike' | 'drop' | 'zero_sales' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  expectedValue: number;
  actualValue: number;
  deviation: number; // у сигмах
  date: string;
  possibleCauses: string[];
}

export interface ABCXYZResult {
  productId: string;
  productName: string;
  abcClass: 'A' | 'B' | 'C';
  xyzClass: 'X' | 'Y' | 'Z';
  combinedClass: string;
  totalRevenue: number;
  revenueShare: number;
  salesVariation: number; // CV - коефіцієнт варіації
  recommendation: string;
  strategy: string;
}

export interface HotColdZone {
  zone: string;
  type: 'hot' | 'warm' | 'cold' | 'frozen';
  description: string;
  products: { productId: string; productName: string; turnoverRate: number }[];
  accessFrequency: number;
  recommendedLocation: string;
}

export interface WavePickingBatch {
  batchId: string;
  orders: string[];
  totalItems: number;
  totalProducts: number;
  estimatedTime: number; // хвилини
  route: { zone: string; products: { productId: string; quantity: number }[] }[];
  priority: 'express' | 'standard' | 'economy';
}

export interface ShipFromStoreResult {
  orderId: string;
  recommendedSource: {
    warehouseId: string;
    warehouseName: string;
    type: 'warehouse' | 'store';
    distance: number;
    hasAllItems: boolean;
    estimatedDeliveryDays: number;
    shippingCost: number;
  };
  alternatives: {
    warehouseId: string;
    warehouseName: string;
    score: number;
    reason: string;
  }[];
}

// ============================================
// 1. ПРОГНОЗУВАННЯ ПОПИТУ
// ============================================

/**
 * Розрахунок ковзного середнього (Moving Average)
 */
export function calculateMovingAverage(data: number[], window: number): number[] {
  if (data.length < window) return [];

  const result: number[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
}

/**
 * Розрахунок експоненціального згладжування
 */
export function exponentialSmoothing(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return [];

  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Виявлення тренду (лінійна регресія)
 */
export function detectTrend(data: number[]): { slope: number; intercept: number; trend: 'growing' | 'stable' | 'declining'; percent: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, trend: 'stable', percent: 0 };

  const xSum = (n * (n - 1)) / 2;
  const ySum = data.reduce((a, b) => a + b, 0);
  const xySum = data.reduce((sum, y, x) => sum + x * y, 0);
  const xxSum = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;

  const avgValue = ySum / n;
  const percent = avgValue !== 0 ? (slope * n / avgValue) * 100 : 0;

  let trend: 'growing' | 'stable' | 'declining' = 'stable';
  if (percent > 5) trend = 'growing';
  else if (percent < -5) trend = 'declining';

  return { slope, intercept, trend, percent };
}

/**
 * Розрахунок сезонності (місячні індекси)
 */
export function calculateSeasonality(salesByMonth: number[]): number[] {
  if (salesByMonth.length < 12) {
    // Якщо менше 12 місяців, повертаємо нейтральні індекси
    return new Array(12).fill(1);
  }

  const avg = salesByMonth.reduce((a, b) => a + b, 0) / salesByMonth.length;
  if (avg === 0) return new Array(12).fill(1);

  return salesByMonth.slice(0, 12).map(s => s / avg);
}

/**
 * Прогнозування попиту на N днів вперед
 */
export function forecastDemand(
  history: ProductSalesHistory,
  currentStock: number,
  daysAhead: number = 30,
  leadTimeDays: number = 7
): ForecastResult {
  const dailyQuantities = history.dailySales.map(s => s.quantity);

  // Середні продажі
  const avgDailySales = dailyQuantities.length > 0
    ? dailyQuantities.reduce((a, b) => a + b, 0) / dailyQuantities.length
    : 0;

  // Тренд
  const trendData = detectTrend(dailyQuantities.slice(-30)); // останні 30 днів

  // Сезонність (групуємо по місяцях)
  const monthlyTotals = new Array(12).fill(0);
  const monthlyCounts = new Array(12).fill(0);
  history.dailySales.forEach(s => {
    const month = new Date(s.date).getMonth();
    monthlyTotals[month] += s.quantity;
    monthlyCounts[month]++;
  });
  const monthlyAvg = monthlyTotals.map((total, i) => monthlyCounts[i] > 0 ? total / monthlyCounts[i] : 0);
  const seasonalityIndex = calculateSeasonality(monthlyAvg);

  // Прогноз
  const forecast: { date: string; predicted: number; lower: number; upper: number }[] = [];
  const today = new Date();

  // Стандартне відхилення для інтервалу довіри
  const stdDev = calculateStdDev(dailyQuantities);

  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);

    const monthIndex = futureDate.getMonth();
    const seasonalFactor = seasonalityIndex[monthIndex] || 1;

    // Прогноз = базовий * сезонність * тренд
    const trendAdjustment = 1 + (trendData.percent / 100) * (i / 30);
    const predicted = Math.max(0, Math.round(avgDailySales * seasonalFactor * trendAdjustment));

    // Інтервал довіри (95%)
    const margin = 1.96 * stdDev * Math.sqrt(i / 7); // зростає з часом

    forecast.push({
      date: futureDate.toISOString().split('T')[0],
      predicted,
      lower: Math.max(0, Math.round(predicted - margin)),
      upper: Math.round(predicted + margin),
    });
  }

  // Дні до закінчення запасів
  let remainingStock = currentStock;
  let daysUntilStockout: number | null = null;
  for (let i = 0; i < forecast.length; i++) {
    remainingStock -= forecast[i].predicted;
    if (remainingStock <= 0) {
      daysUntilStockout = i + 1;
      break;
    }
  }

  // Рекомендована дата замовлення
  let recommendedReorderDate: string | null = null;
  if (daysUntilStockout !== null && daysUntilStockout > leadTimeDays) {
    const reorderDate = new Date(today);
    reorderDate.setDate(today.getDate() + daysUntilStockout - leadTimeDays);
    recommendedReorderDate = reorderDate.toISOString().split('T')[0];
  } else if (daysUntilStockout !== null) {
    recommendedReorderDate = today.toISOString().split('T')[0]; // Замовляти зараз!
  }

  return {
    productId: history.productId,
    productName: history.productName,
    currentStock,
    avgDailySales: Math.round(avgDailySales * 100) / 100,
    forecast,
    trend: trendData.trend,
    trendPercent: Math.round(trendData.percent * 10) / 10,
    seasonalityIndex,
    daysUntilStockout,
    recommendedReorderDate,
  };
}

// ============================================
// 2. SMART REORDER POINT
// ============================================

/**
 * Розрахунок точки перезамовлення
 * Формула: Reorder Point = Safety Stock + (Avg Daily Sales × Lead Time)
 */
export function calculateReorderPoint(
  productId: string,
  productName: string,
  currentStock: number,
  salesHistory: number[], // денні продажі
  leadTimeDays: number = 7,
  serviceLevel: number = 0.95 // 95% рівень обслуговування
): ReorderPoint {
  const avgDailySales = salesHistory.length > 0
    ? salesHistory.reduce((a, b) => a + b, 0) / salesHistory.length
    : 0;

  const stdDev = calculateStdDev(salesHistory);

  // Z-score для рівня обслуговування
  const zScore = getZScore(serviceLevel);

  // Safety Stock = Z × σ × √(Lead Time)
  const safetyStock = Math.ceil(zScore * stdDev * Math.sqrt(leadTimeDays));

  // Reorder Point = Safety Stock + (Avg Daily Sales × Lead Time)
  const reorderPoint = Math.ceil(safetyStock + avgDailySales * leadTimeDays);

  // Economic Order Quantity (спрощена версія)
  // EOQ = √(2DS/H) де D = річний попит, S = вартість замовлення, H = вартість зберігання
  // Спрощено: замовляємо на 30 днів + safety stock
  const reorderQuantity = Math.ceil(avgDailySales * 30 + safetyStock);

  // Дні запасу
  const daysOfStock = avgDailySales > 0 ? Math.round(currentStock / avgDailySales) : 999;

  // Статус
  let status: 'ok' | 'reorder_now' | 'critical' | 'overstock' = 'ok';
  if (currentStock <= safetyStock) {
    status = 'critical';
  } else if (currentStock <= reorderPoint) {
    status = 'reorder_now';
  } else if (currentStock > reorderQuantity * 3) {
    status = 'overstock';
  }

  return {
    productId,
    productName,
    currentStock,
    avgDailySales: Math.round(avgDailySales * 100) / 100,
    leadTimeDays,
    safetyStock,
    reorderPoint,
    reorderQuantity,
    status,
    daysOfStock,
  };
}

/**
 * Масовий розрахунок точок перезамовлення
 */
export function calculateBulkReorderPoints(
  products: { id: string; name: string; stock: number; salesHistory: number[]; leadTime?: number }[],
  defaultLeadTime: number = 7
): ReorderPoint[] {
  return products.map(p => calculateReorderPoint(
    p.id,
    p.name,
    p.stock,
    p.salesHistory,
    p.leadTime || defaultLeadTime
  ));
}

// ============================================
// 3. ABC-XYZ АНАЛІЗ
// ============================================

/**
 * ABC класифікація за виручкою (Парето)
 */
export function classifyABC(products: { id: string; name: string; revenue: number }[]): Map<string, 'A' | 'B' | 'C'> {
  const sorted = [...products].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

  const result = new Map<string, 'A' | 'B' | 'C'>();
  let cumulative = 0;

  for (const product of sorted) {
    cumulative += product.revenue;
    const share = cumulative / totalRevenue;

    if (share <= 0.8) {
      result.set(product.id, 'A'); // Топ 80% виручки
    } else if (share <= 0.95) {
      result.set(product.id, 'B'); // Наступні 15%
    } else {
      result.set(product.id, 'C'); // Решта 5%
    }
  }

  return result;
}

/**
 * XYZ класифікація за стабільністю попиту
 */
export function classifyXYZ(products: { id: string; salesHistory: number[] }[]): Map<string, 'X' | 'Y' | 'Z'> {
  const result = new Map<string, 'X' | 'Y' | 'Z'>();

  for (const product of products) {
    const cv = calculateCV(product.salesHistory);

    if (cv <= 0.1) {
      result.set(product.id, 'X'); // Стабільний попит (CV ≤ 10%)
    } else if (cv <= 0.25) {
      result.set(product.id, 'Y'); // Помірні коливання (CV ≤ 25%)
    } else {
      result.set(product.id, 'Z'); // Нестабільний попит (CV > 25%)
    }
  }

  return result;
}

/**
 * Повний ABC-XYZ аналіз з рекомендаціями
 */
export function performABCXYZAnalysis(
  products: { id: string; name: string; revenue: number; salesHistory: number[] }[]
): ABCXYZResult[] {
  const abcMap = classifyABC(products);
  const xyzMap = classifyXYZ(products);
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

  const recommendations: Record<string, { recommendation: string; strategy: string }> = {
    'AX': {
      recommendation: 'Ключовий товар! Максимальна увага до запасів.',
      strategy: 'Just-in-Time поставки, щоденний моніторинг, автоматичне замовлення'
    },
    'AY': {
      recommendation: 'Важливий товар з помірними коливаннями.',
      strategy: 'Страховий запас 2 тижні, щотижневий моніторинг'
    },
    'AZ': {
      recommendation: 'Важливий, але непередбачуваний товар.',
      strategy: 'Збільшений страховий запас, аналіз причин коливань'
    },
    'BX': {
      recommendation: 'Стабільний товар середньої важливості.',
      strategy: 'Стандартні процедури закупівлі, місячне планування'
    },
    'BY': {
      recommendation: 'Середній товар з помірними коливаннями.',
      strategy: 'Страховий запас 3 тижні, двотижневий моніторинг'
    },
    'BZ': {
      recommendation: 'Середній товар з високою варіативністю.',
      strategy: 'Замовлення під потребу, уникати надлишків'
    },
    'CX': {
      recommendation: 'Стабільний товар низької важливості.',
      strategy: 'Рідкі великі замовлення, мінімізація витрат на управління'
    },
    'CY': {
      recommendation: 'Малозначний товар.',
      strategy: 'Розглянути аутсорсинг або видалення з асортименту'
    },
    'CZ': {
      recommendation: 'Кандидат на видалення з асортименту.',
      strategy: 'Аналіз доцільності, можливо прибрати'
    },
  };

  return products.map(p => {
    /* istanbul ignore next - defensive fallback, classifyABC always returns value */
    const abc = abcMap.get(p.id) || 'C';
    /* istanbul ignore next - defensive fallback, classifyXYZ always returns value */
    const xyz = xyzMap.get(p.id) || 'Z';
    const combined = `${abc}${xyz}`;
    const cv = calculateCV(p.salesHistory);
    /* istanbul ignore next - all valid combinations are covered */
    const rec = recommendations[combined] || { recommendation: '', strategy: '' };

    return {
      productId: p.id,
      productName: p.name,
      abcClass: abc,
      xyzClass: xyz,
      combinedClass: combined,
      totalRevenue: p.revenue,
      revenueShare: totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 10000) / 100 : 0,
      salesVariation: Math.round(cv * 100) / 100,
      recommendation: rec.recommendation,
      strategy: rec.strategy,
    };
  });
}

// ============================================
// 4. ANOMALY DETECTION
// ============================================

/**
 * Виявлення аномалій у продажах
 */
export function detectAnomalies(
  productId: string,
  productName: string,
  salesHistory: { date: string; quantity: number }[],
  sensitivity: number = 2 // кількість сигм для визначення аномалії
): AnomalyAlert[] {
  if (salesHistory.length < 7) return []; // Потрібно мінімум 7 днів

  const alerts: AnomalyAlert[] = [];
  const quantities = salesHistory.map(s => s.quantity);
  const mean = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const stdDev = calculateStdDev(quantities);

  // Перевіряємо останні записи
  const recentDays = Math.min(7, salesHistory.length);

  for (let i = salesHistory.length - recentDays; i < salesHistory.length; i++) {
    const sale = salesHistory[i];
    const zScore = stdDev > 0 ? (sale.quantity - mean) / stdDev : 0;

    // Spike (різке зростання)
    if (zScore > sensitivity) {
      alerts.push({
        id: `anomaly-${productId}-${sale.date}-spike`,
        productId,
        productName,
        type: 'spike',
        severity: zScore > 3 ? 'high' : 'medium',
        message: `Різке зростання продажів: ${sale.quantity} шт (звичайно ~${Math.round(mean)} шт)`,
        expectedValue: Math.round(mean),
        actualValue: sale.quantity,
        deviation: Math.round(zScore * 100) / 100,
        date: sale.date,
        possibleCauses: [
          'Акція або знижка',
          'Сезонний попит',
          'Вірусний маркетинг',
          'Помилка в даних',
        ],
      });
    }

    // Drop (різке падіння)
    if (zScore < -sensitivity && mean > 0) {
      alerts.push({
        id: `anomaly-${productId}-${sale.date}-drop`,
        productId,
        productName,
        type: 'drop',
        severity: zScore < -3 ? 'high' : 'medium',
        message: `Різке падіння продажів: ${sale.quantity} шт (звичайно ~${Math.round(mean)} шт)`,
        expectedValue: Math.round(mean),
        actualValue: sale.quantity,
        deviation: Math.round(Math.abs(zScore) * 100) / 100,
        date: sale.date,
        possibleCauses: [
          'Проблеми з наявністю',
          'Конкуренти',
          'Технічні проблеми на сайті',
          'Сезонне падіння',
        ],
      });
    }
  }

  // Zero sales для популярного товару
  const lastSales = salesHistory.slice(-7);
  const zeroSalesDays = lastSales.filter(s => s.quantity === 0).length;

  if (mean > 1 && zeroSalesDays >= 3) {
    alerts.push({
      id: `anomaly-${productId}-zero-sales`,
      productId,
      productName,
      type: 'zero_sales',
      severity: zeroSalesDays >= 5 ? 'critical' : 'high',
      message: `${zeroSalesDays} днів без продажів для популярного товару`,
      expectedValue: Math.round(mean * zeroSalesDays),
      actualValue: 0,
      deviation: zeroSalesDays,
      date: lastSales[lastSales.length - 1]?.date || '',
      possibleCauses: [
        'Товар закінчився',
        'Неправильна ціна',
        'Товар прихований на сайті',
        'Проблеми з карткою товару',
      ],
    });
  }

  return alerts;
}

/**
 * Масове виявлення аномалій
 */
export function detectBulkAnomalies(
  products: { id: string; name: string; salesHistory: { date: string; quantity: number }[] }[]
): AnomalyAlert[] {
  return products.flatMap(p => detectAnomalies(p.id, p.name, p.salesHistory));
}

// ============================================
// 5. HOT/COLD ZONE MAP
// ============================================

/**
 * Класифікація товарів за частотою обігу
 */
export function classifyHotColdZones(
  products: { id: string; name: string; turnoverRate: number; pickFrequency: number }[]
): HotColdZone[] {
  const sorted = [...products].sort((a, b) => b.turnoverRate - a.turnoverRate);

  const zones: HotColdZone[] = [
    {
      zone: 'A',
      type: 'hot',
      description: 'Найпопулярніші товари - біля входу/виходу',
      products: [],
      accessFrequency: 0,
      recommendedLocation: 'Рівень очей, біля пакувальної зони, перші ряди стелажів',
    },
    {
      zone: 'B',
      type: 'warm',
      description: 'Товари середньої популярності',
      products: [],
      accessFrequency: 0,
      recommendedLocation: 'Середні ряди, зручний доступ',
    },
    {
      zone: 'C',
      type: 'cold',
      description: 'Рідко запитувані товари',
      products: [],
      accessFrequency: 0,
      recommendedLocation: 'Дальні ряди, верхні/нижні полиці',
    },
    {
      zone: 'D',
      type: 'frozen',
      description: 'Дуже рідкі продажі або архів',
      products: [],
      accessFrequency: 0,
      recommendedLocation: 'Найдальша зона, мезонін, окремий склад',
    },
  ];

  const total = sorted.length;
  sorted.forEach((product, index) => {
    const percentile = index / total;

    let zoneIndex: number;
    if (percentile < 0.2) zoneIndex = 0; // Hot: топ 20%
    else if (percentile < 0.5) zoneIndex = 1; // Warm: 20-50%
    else if (percentile < 0.8) zoneIndex = 2; // Cold: 50-80%
    else zoneIndex = 3; // Frozen: 80-100%

    zones[zoneIndex].products.push({
      productId: product.id,
      productName: product.name,
      turnoverRate: product.turnoverRate,
    });
    zones[zoneIndex].accessFrequency += product.pickFrequency;
  });

  return zones;
}

// ============================================
// 6. WAVE PICKING
// ============================================

/**
 * Групування замовлень для wave picking
 */
export function createWavePickingBatches(
  orders: {
    orderId: string;
    priority: 'express' | 'standard' | 'economy';
    items: { productId: string; quantity: number; zone: string }[];
  }[],
  maxOrdersPerBatch: number = 10,
  maxItemsPerBatch: number = 50
): WavePickingBatch[] {
  // Сортуємо за пріоритетом
  const priorityOrder = { express: 0, standard: 1, economy: 2 };
  const sorted = [...orders].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const batches: WavePickingBatch[] = [];
  let currentBatch: typeof orders = [];
  let currentItems = 0;

  for (const order of sorted) {
    const orderItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

    // Перевіряємо ліміти
    if (
      currentBatch.length >= maxOrdersPerBatch ||
      currentItems + orderItems > maxItemsPerBatch
    ) {
      if (currentBatch.length > 0) {
        batches.push(createBatchFromOrders(currentBatch, batches.length + 1));
      }
      currentBatch = [];
      currentItems = 0;
    }

    currentBatch.push(order);
    currentItems += orderItems;
  }

  // Останній батч
  if (currentBatch.length > 0) {
    batches.push(createBatchFromOrders(currentBatch, batches.length + 1));
  }

  return batches;
}

function createBatchFromOrders(
  orders: { orderId: string; priority: 'express' | 'standard' | 'economy'; items: { productId: string; quantity: number; zone: string }[] }[],
  batchNumber: number
): WavePickingBatch {
  // Групуємо товари за зонами
  const zoneMap = new Map<string, Map<string, number>>();

  for (const order of orders) {
    for (const item of order.items) {
      if (!zoneMap.has(item.zone)) {
        zoneMap.set(item.zone, new Map());
      }
      const products = zoneMap.get(item.zone)!;
      products.set(item.productId, (products.get(item.productId) || 0) + item.quantity);
    }
  }

  // Сортуємо зони для оптимального маршруту (A -> B -> C -> D)
  const sortedZones = Array.from(zoneMap.keys()).sort();

  const route = sortedZones.map(zone => ({
    zone,
    products: Array.from(zoneMap.get(zone)!.entries()).map(([productId, quantity]) => ({
      productId,
      quantity,
    })),
  }));

  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const totalProducts = new Set(orders.flatMap(o => o.items.map(i => i.productId))).size;

  // Оцінка часу: 30 сек на товар + 1 хв на зону
  const estimatedTime = Math.ceil((totalItems * 0.5 + route.length) / 60 * 60);

  // Пріоритет батчу = найвищий пріоритет серед замовлень
  const priority = orders.some(o => o.priority === 'express') ? 'express' :
                   orders.some(o => o.priority === 'standard') ? 'standard' : 'economy';

  return {
    batchId: `WAVE-${batchNumber.toString().padStart(4, '0')}`,
    orders: orders.map(o => o.orderId),
    totalItems,
    totalProducts,
    estimatedTime,
    route,
    priority,
  };
}

// ============================================
// 7. SHIP FROM STORE
// ============================================

/**
 * Визначення оптимального джерела відправки
 */
export function findOptimalShipmentSource(
  orderId: string,
  orderItems: { productId: string; quantity: number }[],
  customerLocation: { lat: number; lng: number },
  warehouses: {
    id: string;
    name: string;
    type: 'warehouse' | 'store';
    location: { lat: number; lng: number };
    stock: Map<string, number>;
    shippingCostPerKm: number;
    processingTime: number; // години
  }[]
): ShipFromStoreResult {
  const alternatives: { warehouseId: string; warehouseName: string; score: number; reason: string }[] = [];

  // Оцінюємо кожен склад/магазин
  const scored = warehouses.map(warehouse => {
    // Відстань до клієнта
    const distance = calculateDistance(
      customerLocation.lat, customerLocation.lng,
      warehouse.location.lat, warehouse.location.lng
    );

    // Перевіряємо наявність
    let hasAllItems = true;
    let availableItems = 0;
    for (const item of orderItems) {
      const stock = warehouse.stock.get(item.productId) || 0;
      if (stock >= item.quantity) {
        availableItems++;
      } else {
        hasAllItems = false;
      }
    }

    // Вартість доставки
    const shippingCost = Math.round(distance * warehouse.shippingCostPerKm);

    // Час доставки (1 день на 100 км + обробка)
    const deliveryDays = Math.ceil(distance / 100) + Math.ceil(warehouse.processingTime / 24);

    // Загальна оцінка (менше = краще)
    // Формула: відстань * 0.3 + вартість * 0.3 + (немає товарів ? 1000 : 0) + час * 10
    const score = distance * 0.3 + shippingCost * 0.3 + (hasAllItems ? 0 : 1000) + deliveryDays * 10;

    return {
      warehouse,
      distance,
      hasAllItems,
      shippingCost,
      deliveryDays,
      score,
      availableItems,
    };
  });

  // Сортуємо за оцінкою
  scored.sort((a, b) => a.score - b.score);

  const best = scored[0];

  // Альтернативи
  for (let i = 1; i < Math.min(4, scored.length); i++) {
    const alt = scored[i];
    let reason = '';

    if (!alt.hasAllItems) {
      reason = `Не всі товари в наявності (${alt.availableItems}/${orderItems.length})`;
    } else if (alt.distance > best.distance * 1.5) {
      reason = `Більша відстань (+${Math.round(alt.distance - best.distance)} км)`;
    } else if (alt.shippingCost > best.shippingCost) {
      reason = `Дорожча доставка (+${alt.shippingCost - best.shippingCost} ₴)`;
    } else {
      reason = `Довший час обробки`;
    }

    alternatives.push({
      warehouseId: alt.warehouse.id,
      warehouseName: alt.warehouse.name,
      score: Math.round(alt.score),
      reason,
    });
  }

  return {
    orderId,
    recommendedSource: {
      warehouseId: best.warehouse.id,
      warehouseName: best.warehouse.name,
      type: best.warehouse.type,
      distance: Math.round(best.distance),
      hasAllItems: best.hasAllItems,
      estimatedDeliveryDays: best.deliveryDays,
      shippingCost: best.shippingCost,
    },
    alternatives,
  };
}

// ============================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ============================================

/**
 * Розрахунок стандартного відхилення
 */
export function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Розрахунок коефіцієнта варіації (CV)
 */
export function calculateCV(data: number[]): number {
  if (data.length < 2) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  if (mean === 0) return 0;

  const stdDev = calculateStdDev(data);
  return stdDev / mean;
}

/**
 * Z-score для заданого рівня довіри
 */
function getZScore(confidence: number): number {
  // Спрощена таблиця Z-scores
  const zScores: Record<number, number> = {
    0.90: 1.28,
    0.95: 1.645,
    0.99: 2.33,
  };

  return zScores[confidence] || 1.645;
}

/**
 * Розрахунок відстані між двома точками (формула Гаверсина)
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Радіус Землі в км
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Генерація тестових даних для демонстрації
 */
export function generateMockSalesHistory(
  productId: string,
  days: number = 90,
  baseAvg: number = 10,
  variance: number = 0.3
): { date: string; quantity: number }[] {
  const history: { date: string; quantity: number }[] = [];
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Сезонність (більше продажів у вихідні)
    const dayOfWeek = date.getDay();
    const weekendBoost = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;

    // Випадкова варіація
    const randomFactor = 1 + (Math.random() - 0.5) * 2 * variance;

    // Тренд (невелике зростання)
    const trendFactor = 1 + (days - i) / days * 0.1;

    const quantity = Math.max(0, Math.round(baseAvg * weekendBoost * randomFactor * trendFactor));

    history.push({
      date: date.toISOString().split('T')[0],
      quantity,
    });
  }

  return history;
}
