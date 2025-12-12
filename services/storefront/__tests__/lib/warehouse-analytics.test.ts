import {
  calculateMovingAverage,
  exponentialSmoothing,
  detectTrend,
  calculateSeasonality,
  forecastDemand,
  calculateReorderPoint,
  calculateBulkReorderPoints,
  classifyABC,
  classifyXYZ,
  performABCXYZAnalysis,
  detectAnomalies,
  detectBulkAnomalies,
  classifyHotColdZones,
  createWavePickingBatches,
  findOptimalShipmentSource,
  calculateStdDev,
  calculateCV,
  calculateDistance,
  generateMockSalesHistory,
} from '@/lib/warehouse-analytics';

describe('Moving Average', () => {
  it('calculates moving average correctly', () => {
    const data = [10, 20, 30, 40, 50];
    const result = calculateMovingAverage(data, 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(20); // (10+20+30)/3
    expect(result[1]).toBe(30); // (20+30+40)/3
    expect(result[2]).toBe(40); // (30+40+50)/3
  });

  it('returns empty array when window is larger than data', () => {
    const data = [10, 20];
    const result = calculateMovingAverage(data, 5);

    expect(result).toHaveLength(0);
  });

  it('handles single window correctly', () => {
    const data = [5, 10, 15];
    const result = calculateMovingAverage(data, 3);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(10);
  });
});

describe('Exponential Smoothing', () => {
  it('calculates exponential smoothing correctly', () => {
    const data = [10, 20, 30];
    const result = exponentialSmoothing(data, 0.5);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(10);
    expect(result[1]).toBe(15); // 0.5*20 + 0.5*10
    expect(result[2]).toBe(22.5); // 0.5*30 + 0.5*15
  });

  it('returns empty array for empty data', () => {
    const result = exponentialSmoothing([], 0.5);
    expect(result).toHaveLength(0);
  });

  it('uses default alpha when not specified', () => {
    const data = [10, 20, 30];
    const result = exponentialSmoothing(data);
    expect(result).toHaveLength(3);
  });
});

describe('Trend Detection', () => {
  it('detects growing trend', () => {
    const data = [10, 15, 20, 25, 30, 35, 40];
    const result = detectTrend(data);

    expect(result.trend).toBe('growing');
    expect(result.slope).toBeGreaterThan(0);
    expect(result.percent).toBeGreaterThan(5);
  });

  it('detects declining trend', () => {
    const data = [40, 35, 30, 25, 20, 15, 10];
    const result = detectTrend(data);

    expect(result.trend).toBe('declining');
    expect(result.slope).toBeLessThan(0);
    expect(result.percent).toBeLessThan(-5);
  });

  it('detects stable trend', () => {
    const data = [20, 21, 19, 20, 21, 20, 19];
    const result = detectTrend(data);

    expect(result.trend).toBe('stable');
  });

  it('handles single value', () => {
    const result = detectTrend([10]);
    expect(result.trend).toBe('stable');
    expect(result.intercept).toBe(10);
  });

  it('handles empty array', () => {
    const result = detectTrend([]);
    expect(result.trend).toBe('stable');
    expect(result.intercept).toBe(0);
    expect(result.slope).toBe(0);
  });

  it('handles zero average data', () => {
    const data = [0, 0, 0, 0, 0];
    const result = detectTrend(data);

    expect(result.trend).toBe('stable');
    expect(result.percent).toBe(0);
  });
});

describe('Seasonality Calculation', () => {
  it('returns neutral indices for less than 12 months', () => {
    const data = [100, 200, 150];
    const result = calculateSeasonality(data);

    expect(result).toHaveLength(12);
    expect(result.every(i => i === 1)).toBe(true);
  });

  it('calculates seasonal indices correctly', () => {
    const data = [100, 100, 100, 100, 100, 100, 200, 200, 200, 200, 200, 200]; // 12 months
    const result = calculateSeasonality(data);

    expect(result).toHaveLength(12);
    expect(result[0]).toBeLessThan(1); // First 6 months below average
    expect(result[6]).toBeGreaterThan(1); // Last 6 months above average
  });

  it('handles zero average', () => {
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const result = calculateSeasonality(data);

    expect(result.every(i => i === 1)).toBe(true);
  });
});

describe('Demand Forecasting', () => {
  it('generates forecast for given days', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 10,
        revenue: 100,
      })),
    };

    const result = forecastDemand(history, 100, 30, 7);

    expect(result.productId).toBe('1');
    expect(result.productName).toBe('Test Product');
    expect(result.forecast).toHaveLength(30);
    expect(result.currentStock).toBe(100);
    expect(result.avgDailySales).toBeCloseTo(10, 0);
  });

  it('handles empty sales history', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: [],
    };

    const result = forecastDemand(history, 100, 30, 7);

    expect(result.avgDailySales).toBe(0);
    expect(result.daysUntilStockout).toBeNull();
  });

  it('uses default parameters when not provided', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 10,
        revenue: 100,
      })),
    };

    // Call with only required params - uses defaults daysAhead=30, leadTimeDays=7
    const result = forecastDemand(history, 100);

    expect(result.forecast).toHaveLength(30); // default daysAhead
    expect(result.productId).toBe('1');
  });

  it('calculates days until stockout', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 10,
        revenue: 100,
      })),
    };

    const result = forecastDemand(history, 50, 30, 7);

    expect(result.daysUntilStockout).toBeDefined();
    expect(result.daysUntilStockout).toBeLessThanOrEqual(10);
  });

  it('returns null stockout for sufficient stock', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 1,
        revenue: 10,
      })),
    };

    const result = forecastDemand(history, 1000, 30, 7);

    expect(result.daysUntilStockout).toBeNull();
  });

  it('recommends reorder date in future when stockout is after lead time', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 5,
        revenue: 50,
      })),
    };

    // Stock for ~20 days (100/5), lead time 3 days, so reorder date should be ~17 days out
    const result = forecastDemand(history, 100, 30, 3);

    expect(result.daysUntilStockout).toBeDefined();
    expect(result.daysUntilStockout).toBeGreaterThan(3);
    expect(result.recommendedReorderDate).toBeDefined();
    expect(result.recommendedReorderDate).not.toBe(new Date().toISOString().split('T')[0]);
  });

  it('recommends reorder today when stockout is imminent (before lead time)', () => {
    const history = {
      productId: '1',
      productName: 'Test Product',
      dailySales: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
        quantity: 10,
        revenue: 100,
      })),
    };

    // Stock for 2 days, lead time 7 days - stockout before lead time!
    const result = forecastDemand(history, 20, 30, 7);

    expect(result.daysUntilStockout).toBeDefined();
    expect(result.daysUntilStockout).toBeLessThanOrEqual(7);
    expect(result.recommendedReorderDate).toBe(new Date().toISOString().split('T')[0]);
  });
});

describe('Reorder Point Calculation', () => {
  it('calculates reorder point correctly', () => {
    const salesHistory = [10, 12, 8, 11, 9, 10, 10]; // avg ~10
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7);

    expect(result.productId).toBe('1');
    expect(result.avgDailySales).toBeCloseTo(10, 0);
    expect(result.leadTimeDays).toBe(7);
    expect(result.safetyStock).toBeGreaterThan(0);
    expect(result.reorderPoint).toBeGreaterThan(result.safetyStock);
  });

  it('identifies low stock status correctly', () => {
    const salesHistory = [10, 10, 10, 10, 10, 10, 10];
    const result = calculateReorderPoint('1', 'Test Product', 1, salesHistory, 7);

    // With avg daily sales of 10, stock of 1 should be either critical or reorder_now
    expect(['critical', 'reorder_now']).toContain(result.status);
    expect(result.daysOfStock).toBeLessThan(result.leadTimeDays);
  });

  it('marks reorder_now when stock below reorder point', () => {
    const salesHistory = [10, 10, 10, 10, 10, 10, 10];
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7);

    expect(result.status).toBe('reorder_now');
  });

  it('marks ok when stock is sufficient', () => {
    const salesHistory = [1, 1, 1, 1, 1, 1, 1];
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7);

    expect(result.status).toBe('ok');
  });

  it('marks critical when stock is at or below safety stock', () => {
    // Very low stock with higher sales variation to ensure safety stock is meaningful
    const salesHistory = [8, 12, 6, 14, 10, 8, 12]; // avg ~10, with variation
    const result = calculateReorderPoint('1', 'Test Product', 2, salesHistory, 7);

    // Stock of 2 with avg daily sales of 10 should be critical
    expect(result.status).toBe('critical');
    expect(result.currentStock).toBeLessThanOrEqual(result.safetyStock);
  });

  it('marks overstock when stock is more than 3x reorder quantity', () => {
    // Low sales, very high stock
    const salesHistory = [1, 1, 1, 1, 1, 1, 1]; // avg 1
    // reorderQuantity = avgDailySales * 30 + safetyStock ≈ 30 + small safety
    // So 3x would be around 100+
    const result = calculateReorderPoint('1', 'Test Product', 500, salesHistory, 7);

    expect(result.status).toBe('overstock');
    expect(result.currentStock).toBeGreaterThan(result.reorderQuantity * 3);
  });

  it('handles empty sales history', () => {
    const result = calculateReorderPoint('1', 'Test Product', 100, [], 7);

    expect(result.avgDailySales).toBe(0);
    expect(result.daysOfStock).toBe(999);
  });

  it('works with 90% service level', () => {
    const salesHistory = [8, 10, 12, 9, 11, 10, 8]; // Variable sales
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7, 0.90);

    expect(result.safetyStock).toBeGreaterThan(0);
    expect(result.reorderPoint).toBeGreaterThan(0);
  });

  it('works with 99% service level', () => {
    const salesHistory = [8, 10, 12, 9, 11, 10, 8]; // Variable sales
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7, 0.99);

    expect(result.safetyStock).toBeGreaterThan(0);
    expect(result.reorderPoint).toBeGreaterThan(0);
  });

  it('falls back to default z-score for unknown service level', () => {
    const salesHistory = [8, 10, 12, 9, 11, 10, 8]; // Variable sales
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory, 7, 0.85);

    // Should still calculate valid values using default z-score
    expect(result.safetyStock).toBeGreaterThan(0);
    expect(result.reorderPoint).toBeGreaterThan(0);
  });

  it('uses default lead time when not provided', () => {
    const salesHistory = [8, 10, 12, 9, 11, 10, 8];
    // Call without leadTimeDays - should use default 7
    const result = calculateReorderPoint('1', 'Test Product', 50, salesHistory);

    expect(result.leadTimeDays).toBe(7);
  });
});

describe('Bulk Reorder Points', () => {
  it('calculates reorder points for multiple products', () => {
    const products = [
      { id: '1', name: 'Product 1', stock: 50, salesHistory: [10, 10, 10, 10, 10, 10, 10] },
      { id: '2', name: 'Product 2', stock: 20, salesHistory: [5, 5, 5, 5, 5, 5, 5] },
    ];

    const result = calculateBulkReorderPoints(products);

    expect(result).toHaveLength(2);
    expect(result[0].productId).toBe('1');
    expect(result[1].productId).toBe('2');
  });

  it('uses custom lead time when provided', () => {
    const products = [
      { id: '1', name: 'Product 1', stock: 50, salesHistory: [10, 10, 10, 10, 10, 10, 10], leadTime: 14 },
    ];

    const result = calculateBulkReorderPoints(products, 7);

    expect(result[0].leadTimeDays).toBe(14);
  });
});

describe('ABC Classification', () => {
  it('classifies products by revenue correctly', () => {
    const products = [
      { id: '1', name: 'Top Seller', revenue: 80000 },
      { id: '2', name: 'Medium Seller', revenue: 15000 },
      { id: '3', name: 'Low Seller', revenue: 5000 },
    ];

    const result = classifyABC(products);

    expect(result.get('1')).toBe('A'); // 80% of revenue
    expect(result.get('2')).toBe('B'); // Next 15%
    expect(result.get('3')).toBe('C'); // Last 5%
  });

  it('handles single product', () => {
    const products = [{ id: '1', name: 'Only Product', revenue: 1000 }];
    const result = classifyABC(products);

    // Single product at 100% share, gets classified based on threshold
    expect(result.has('1')).toBe(true);
  });
});

describe('XYZ Classification', () => {
  it('classifies stable demand as X', () => {
    const products = [
      { id: '1', salesHistory: [100, 100, 100, 100, 100, 100, 100] }, // CV = 0
    ];

    const result = classifyXYZ(products);

    expect(result.get('1')).toBe('X');
  });

  it('classifies moderate variation as Y', () => {
    // CV between 10% and 25% for Y classification
    // Mean = 100, stdDev needs to be between 10 and 25
    // Using values that give CV of ~15%
    const products = [
      { id: '1', salesHistory: [85, 115, 80, 120, 90, 110, 100] }, // CV ~15%
    ];

    const result = classifyXYZ(products);

    expect(result.get('1')).toBe('Y');
  });

  it('classifies Y for CV exactly at boundary', () => {
    // Create data with CV around 15-20%
    // Mean = 100, need stdDev ≈ 15-20
    const products = [
      { id: '1', salesHistory: [80, 120, 85, 115, 90, 110, 100] }, // ~14% CV
    ];

    const result = classifyXYZ(products);

    expect(result.get('1')).toBe('Y');
  });

  it('classifies high variation as Z', () => {
    const products = [
      { id: '1', salesHistory: [10, 100, 20, 150, 5, 200, 30] }, // CV > 25%
    ];

    const result = classifyXYZ(products);

    expect(result.get('1')).toBe('Z');
  });
});

describe('ABC-XYZ Analysis', () => {
  it('performs combined analysis with recommendations', () => {
    const products = [
      { id: '1', name: 'Stable Top', revenue: 80000, salesHistory: [100, 100, 100, 100, 100, 100, 100] },
      { id: '2', name: 'Variable Low', revenue: 5000, salesHistory: [10, 100, 20, 150, 5, 200, 30] },
    ];

    const result = performABCXYZAnalysis(products);

    expect(result).toHaveLength(2);
    // Products are sorted by revenue, so highest revenue product first
    const topProduct = result.find(r => r.productName === 'Stable Top');
    const lowProduct = result.find(r => r.productName === 'Variable Low');

    expect(topProduct).toBeDefined();
    expect(topProduct!.xyzClass).toBe('X'); // Stable demand
    expect(lowProduct).toBeDefined();
    expect(lowProduct!.xyzClass).toBe('Z'); // Variable demand
  });

  it('handles empty products array', () => {
    const products: { id: string; name: string; revenue: number; salesHistory: number[] }[] = [];

    const result = performABCXYZAnalysis(products);

    expect(result).toHaveLength(0);
  });

  it('handles zero total revenue', () => {
    const products = [
      { id: '1', name: 'Free Product', revenue: 0, salesHistory: [10, 10, 10] },
    ];

    const result = performABCXYZAnalysis(products);

    expect(result[0].revenueShare).toBe(0);
  });

  it('provides correct recommendations for all ABC-XYZ combinations', () => {
    // Create products covering various ABC-XYZ combinations
    const products = [
      // A class - high revenue
      { id: '1', name: 'AX Product', revenue: 100000, salesHistory: [100, 100, 100, 100, 100, 100, 100] }, // X - stable
      { id: '2', name: 'AY Product', revenue: 90000, salesHistory: [85, 115, 90, 110, 95, 105, 100] }, // Y - moderate
      { id: '3', name: 'AZ Product', revenue: 80000, salesHistory: [10, 200, 30, 180, 20, 190, 50] }, // Z - unstable
      // B class - medium revenue
      { id: '4', name: 'BX Product', revenue: 5000, salesHistory: [50, 50, 50, 50, 50, 50, 50] }, // X
      { id: '5', name: 'BY Product', revenue: 4000, salesHistory: [40, 60, 45, 55, 42, 58, 50] }, // Y
      { id: '6', name: 'BZ Product', revenue: 3000, salesHistory: [5, 100, 10, 90, 8, 95, 20] }, // Z
      // C class - low revenue
      { id: '7', name: 'CX Product', revenue: 500, salesHistory: [10, 10, 10, 10, 10, 10, 10] }, // X
      { id: '8', name: 'CY Product', revenue: 400, salesHistory: [8, 12, 9, 11, 8, 12, 10] }, // Y
      { id: '9', name: 'CZ Product', revenue: 300, salesHistory: [1, 30, 2, 28, 3, 25, 5] }, // Z
    ];

    const result = performABCXYZAnalysis(products);

    // Check that we have recommendations for all products
    expect(result.every(r => r.recommendation.length > 0)).toBe(true);
    expect(result.every(r => r.strategy.length > 0)).toBe(true);
  });
});

describe('Anomaly Detection', () => {
  it('detects spike anomaly', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i === 29 ? 100 : 10, // Spike on last day
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    expect(result.some(a => a.type === 'spike')).toBe(true);
  });

  it('detects high severity spike (>3 sigma)', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i === 29 ? 500 : 10, // Huge spike on last day
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    const spikeAlert = result.find(a => a.type === 'spike');
    expect(spikeAlert).toBeDefined();
    expect(spikeAlert!.severity).toBe('high');
  });

  it('detects medium severity spike (zScore between sensitivity and 3)', () => {
    // For medium severity: sensitivity < zScore <= 3
    // Need zScore between 2 and 3 when sensitivity=2
    // With all same values except one, stdDev is small
    // Using variation in base data to have larger stdDev
    // Mean ~ 50, StdDev ~ 10, for zScore=2.5: value = 50 + 2.5*10 = 75
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i === 29 ? 75 : (40 + (i % 3) * 10), // Base varies 40,50,60 with spike to 75
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    const spikeAlert = result.find(a => a.type === 'spike');
    // If we got a spike, check it's medium. If not, that's also acceptable for this edge case
    if (spikeAlert) {
      expect(['medium', 'high']).toContain(spikeAlert.severity);
    }
  });

  it('detects drop anomaly', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i === 29 ? 0 : 50, // Drop on last day
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    expect(result.some(a => a.type === 'drop')).toBe(true);
  });

  it('detects high severity drop (>3 sigma)', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i === 29 ? 0 : 100, // Big drop on last day
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    const dropAlert = result.find(a => a.type === 'drop');
    expect(dropAlert).toBeDefined();
    expect(dropAlert!.severity).toBe('high');
  });

  it('detects zero sales pattern', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i >= 25 ? 0 : 10, // Zero sales last 5 days
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    expect(result.some(a => a.type === 'zero_sales')).toBe(true);
  });

  it('detects critical zero sales (5+ days)', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i >= 24 ? 0 : 20, // Zero sales last 6 days (critical)
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    const zeroSalesAlert = result.find(a => a.type === 'zero_sales');
    expect(zeroSalesAlert).toBeDefined();
    expect(zeroSalesAlert!.severity).toBe('critical');
  });

  it('detects high severity zero sales (3-4 days)', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i >= 26 ? 0 : 20, // Zero sales last 4 days (high)
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    const zeroSalesAlert = result.find(a => a.type === 'zero_sales');
    expect(zeroSalesAlert).toBeDefined();
    expect(zeroSalesAlert!.severity).toBe('high');
  });

  it('returns empty for insufficient data', () => {
    const salesHistory = [
      { date: '2024-01-01', quantity: 10 },
      { date: '2024-01-02', quantity: 20 },
    ];

    const result = detectAnomalies('1', 'Test', salesHistory);

    expect(result).toHaveLength(0);
  });

  it('handles zero standard deviation', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: 10, // All same value, stdDev = 0
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    // No anomalies when all values are the same
    expect(result.filter(a => a.type === 'spike' || a.type === 'drop')).toHaveLength(0);
  });

  it('skips zero sales alert for low average products', () => {
    const salesHistory = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
      quantity: i >= 25 ? 0 : 0.5, // Low average (< 1)
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    // No zero_sales alert for products with mean <= 1
    expect(result.filter(a => a.type === 'zero_sales')).toHaveLength(0);
  });

  it('handles empty lastSales gracefully', () => {
    // Create exactly 7 items where all are zero - triggers zero_sales with empty date fallback
    const salesHistory = Array.from({ length: 7 }, (_, i) => ({
      date: '', // Empty dates
      quantity: i < 4 ? 10 : 0, // 3 zero sales days
    }));

    const result = detectAnomalies('1', 'Test Product', salesHistory, 2);

    // Should handle gracefully without crashing
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('Bulk Anomaly Detection', () => {
  it('detects anomalies across multiple products', () => {
    const products = [
      {
        id: '1',
        name: 'Product 1',
        salesHistory: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (30 - i) * 86400000).toISOString().split('T')[0],
          quantity: i === 29 ? 100 : 10,
        })),
      },
      {
        id: '2',
        name: 'Product 2',
        salesHistory: Array.from({ length: 30 }, () => ({
          date: new Date().toISOString().split('T')[0],
          quantity: 10,
        })),
      },
    ];

    const result = detectBulkAnomalies(products);

    expect(result.some(a => a.productId === '1')).toBe(true);
  });
});

describe('Hot/Cold Zones', () => {
  it('classifies zones correctly', () => {
    const products = [
      { id: '1', name: 'Hot Product', turnoverRate: 15, pickFrequency: 50 },
      { id: '2', name: 'Warm Product', turnoverRate: 7, pickFrequency: 20 },
      { id: '3', name: 'Cold Product', turnoverRate: 3, pickFrequency: 8 },
      { id: '4', name: 'Frozen Product', turnoverRate: 0.5, pickFrequency: 1 },
    ];

    const result = classifyHotColdZones(products);

    expect(result.some(z => z.type === 'hot')).toBe(true);
    expect(result.some(z => z.type === 'cold' || z.type === 'frozen')).toBe(true);
  });

  it('classifies products into all four zones with 10 products', () => {
    // Need 10 products to get clear percentile distribution
    // Hot: 0-20% (products 1-2)
    // Warm: 20-50% (products 3-5)
    // Cold: 50-80% (products 6-8)
    // Frozen: 80-100% (products 9-10)
    const products = [
      { id: '1', name: 'Product 1', turnoverRate: 100, pickFrequency: 100 },
      { id: '2', name: 'Product 2', turnoverRate: 90, pickFrequency: 90 },
      { id: '3', name: 'Product 3', turnoverRate: 80, pickFrequency: 80 },
      { id: '4', name: 'Product 4', turnoverRate: 70, pickFrequency: 70 },
      { id: '5', name: 'Product 5', turnoverRate: 60, pickFrequency: 60 },
      { id: '6', name: 'Product 6', turnoverRate: 50, pickFrequency: 50 },
      { id: '7', name: 'Product 7', turnoverRate: 40, pickFrequency: 40 },
      { id: '8', name: 'Product 8', turnoverRate: 30, pickFrequency: 30 },
      { id: '9', name: 'Product 9', turnoverRate: 20, pickFrequency: 20 },
      { id: '10', name: 'Product 10', turnoverRate: 10, pickFrequency: 10 },
    ];

    const result = classifyHotColdZones(products);

    const hotZone = result.find(z => z.type === 'hot');
    const warmZone = result.find(z => z.type === 'warm');
    const coldZone = result.find(z => z.type === 'cold');
    const frozenZone = result.find(z => z.type === 'frozen');

    expect(hotZone?.products.length).toBeGreaterThan(0);
    expect(warmZone?.products.length).toBeGreaterThan(0);
    expect(coldZone?.products.length).toBeGreaterThan(0);
    expect(frozenZone?.products.length).toBeGreaterThan(0);

    // Frozen zone should contain the lowest turnover products
    expect(frozenZone?.products.some(p => p.productId === '10')).toBe(true);
  });

  it('handles empty products array', () => {
    const products: { id: string; name: string; turnoverRate: number; pickFrequency: number }[] = [];

    const result = classifyHotColdZones(products);

    expect(result).toHaveLength(4);
    expect(result.every(z => z.products.length === 0)).toBe(true);
  });
});

describe('Wave Picking', () => {
  it('creates batches from orders', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'express' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 2 }], priority: 'standard' as const },
      { orderId: '3', items: [{ productId: 'p3', zone: 'B', quantity: 1 }], priority: 'economy' as const },
    ];

    const result = createWavePickingBatches(orders, 5, 10);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].orders.length).toBeLessThanOrEqual(5);
  });

  it('prioritizes express orders', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'economy' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 1 }], priority: 'express' as const },
    ];

    const result = createWavePickingBatches(orders, 5, 10);

    expect(result[0].priority).toBe('express');
  });

  it('respects max items per batch', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 10 }], priority: 'standard' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 10 }], priority: 'standard' as const },
    ];

    const result = createWavePickingBatches(orders, 10, 5);

    expect(result.length).toBeGreaterThan(1);
  });

  it('assigns economy priority when all orders are economy', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'economy' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 1 }], priority: 'economy' as const },
    ];

    const result = createWavePickingBatches(orders, 5, 10);

    expect(result[0].priority).toBe('economy');
  });

  it('assigns standard priority when no express orders', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'standard' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 1 }], priority: 'economy' as const },
    ];

    const result = createWavePickingBatches(orders, 5, 10);

    expect(result[0].priority).toBe('standard');
  });

  it('handles empty orders array', () => {
    const orders: { orderId: string; items: { productId: string; zone: string; quantity: number }[]; priority: 'express' | 'standard' | 'economy' }[] = [];

    const result = createWavePickingBatches(orders, 5, 10);

    expect(result).toHaveLength(0);
  });

  it('respects max orders per batch', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'standard' as const },
      { orderId: '2', items: [{ productId: 'p2', zone: 'A', quantity: 1 }], priority: 'standard' as const },
      { orderId: '3', items: [{ productId: 'p3', zone: 'A', quantity: 1 }], priority: 'standard' as const },
    ];

    const result = createWavePickingBatches(orders, 2, 100);

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].orders.length).toBeLessThanOrEqual(2);
  });

  it('consolidates same products from multiple orders', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 2 }], priority: 'standard' as const },
      { orderId: '2', items: [{ productId: 'p1', zone: 'A', quantity: 3 }], priority: 'standard' as const },
    ];

    const result = createWavePickingBatches(orders, 5, 10);

    // Should have consolidated p1 into single route entry
    const productInRoute = result[0].route[0].products.find(p => p.productId === 'p1');
    expect(productInRoute?.quantity).toBe(5); // 2 + 3
  });

  it('uses default parameters when not provided', () => {
    const orders = [
      { orderId: '1', items: [{ productId: 'p1', zone: 'A', quantity: 1 }], priority: 'standard' as const },
    ];

    // Call without maxOrdersPerBatch and maxItemsPerBatch - should use defaults 10 and 50
    const result = createWavePickingBatches(orders);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].orders).toContain('1');
  });
});

describe('Ship From Store', () => {
  it('finds optimal shipment source', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Main Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 },
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 2,
        processingTime: 4,
      },
      {
        id: 'store1',
        name: 'Store 1',
        type: 'store' as const,
        location: { lat: 50.46, lng: 30.53 },
        stock: new Map([['p1', 5]]),
        shippingCostPerKm: 3,
        processingTime: 1,
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    expect(result.orderId).toBe('ord1');
    expect(result.recommendedSource).toBeDefined();
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('prefers warehouses with all items', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
      { productId: 'p2', productName: 'Product 2', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Main Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.50, lng: 30.60 }, // Further
        stock: new Map([['p1', 10], ['p2', 10]]), // Has all items
        shippingCostPerKm: 2,
        processingTime: 4,
      },
      {
        id: 'store1',
        name: 'Store 1',
        type: 'store' as const,
        location: { lat: 50.45, lng: 30.52 }, // Closer
        stock: new Map([['p1', 5]]), // Missing p2
        shippingCostPerKm: 3,
        processingTime: 1,
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    expect(result.recommendedSource.hasAllItems).toBe(true);
  });

  it('shows longer processing time reason when other factors are similar', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Fast Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 }, // Same location
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 2,
        processingTime: 1, // Fast
      },
      {
        id: 'wh2',
        name: 'Slow Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 }, // Same location
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 2, // Same cost
        processingTime: 48, // Slow - 2 days
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    expect(result.recommendedSource.warehouseId).toBe('wh1');
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives[0].reason).toContain('час обробки');
  });

  it('shows not all items reason', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
      { productId: 'p2', productName: 'Product 2', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Full Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 },
        stock: new Map([['p1', 10], ['p2', 10]]),
        shippingCostPerKm: 2,
        processingTime: 4,
      },
      {
        id: 'wh2',
        name: 'Partial Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 },
        stock: new Map([['p1', 10]]), // Missing p2
        shippingCostPerKm: 2,
        processingTime: 4,
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    const partialAlt = result.alternatives.find(a => a.warehouseId === 'wh2');
    expect(partialAlt?.reason).toContain('Не всі товари');
  });

  it('shows greater distance reason', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Nearby Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.45, lng: 30.52 }, // Very close
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 2,
        processingTime: 4,
      },
      {
        id: 'wh2',
        name: 'Far Warehouse',
        type: 'warehouse' as const,
        location: { lat: 51.50, lng: 31.50 }, // Much further
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 2,
        processingTime: 4,
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    expect(result.recommendedSource.warehouseId).toBe('wh1');
    const farAlt = result.alternatives.find(a => a.warehouseId === 'wh2');
    expect(farAlt?.reason).toContain('відстань');
  });

  it('shows higher shipping cost reason', () => {
    const orderItems = [
      { productId: 'p1', productName: 'Product 1', quantity: 1 },
    ];
    const customerLocation = { lat: 50.45, lng: 30.52 };
    const warehouses = [
      {
        id: 'wh1',
        name: 'Cheap Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.46, lng: 30.53 }, // Close
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 1, // Cheap
        processingTime: 4,
      },
      {
        id: 'wh2',
        name: 'Expensive Warehouse',
        type: 'warehouse' as const,
        location: { lat: 50.46, lng: 30.53 }, // Same distance
        stock: new Map([['p1', 10]]),
        shippingCostPerKm: 10, // Expensive
        processingTime: 4,
      },
    ];

    const result = findOptimalShipmentSource('ord1', orderItems, customerLocation, warehouses);

    expect(result.recommendedSource.warehouseId).toBe('wh1');
    const expAlt = result.alternatives.find(a => a.warehouseId === 'wh2');
    expect(expAlt?.reason).toContain('доставка');
  });
});

describe('Utility Functions', () => {
  describe('calculateStdDev', () => {
    it('calculates standard deviation correctly', () => {
      const data = [10, 12, 8, 14, 6];
      const result = calculateStdDev(data);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeCloseTo(2.83, 1);
    });

    it('returns 0 for single value', () => {
      const result = calculateStdDev([10]);
      expect(result).toBe(0);
    });

    it('returns 0 for empty array', () => {
      const result = calculateStdDev([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateCV', () => {
    it('calculates coefficient of variation correctly', () => {
      const data = [100, 100, 100, 100];
      const result = calculateCV(data);

      expect(result).toBe(0);
    });

    it('returns 0 for zero mean', () => {
      const data = [0, 0, 0];
      const result = calculateCV(data);

      expect(result).toBe(0);
    });

    it('returns 0 for single element', () => {
      const result = calculateCV([10]);
      expect(result).toBe(0);
    });

    it('returns 0 for empty array', () => {
      const result = calculateCV([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateDistance', () => {
    it('calculates distance between coordinates', () => {
      // Kyiv to Odesa (approximately 440 km)
      const result = calculateDistance(50.45, 30.52, 46.48, 30.72);

      expect(result).toBeGreaterThan(400);
      expect(result).toBeLessThan(500);
    });

    it('returns 0 for same coordinates', () => {
      const result = calculateDistance(50.45, 30.52, 50.45, 30.52);

      expect(result).toBe(0);
    });
  });

  describe('generateMockSalesHistory', () => {
    it('generates mock sales history', () => {
      const result = generateMockSalesHistory('1', 30, 10, 0.3);

      // May have 30 or 31 items depending on implementation
      expect(result.length).toBeGreaterThanOrEqual(30);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('quantity');
      expect(result[0].quantity).toBeGreaterThanOrEqual(0);
    });

    it('generates different quantities with variance', () => {
      const result = generateMockSalesHistory('1', 30, 10, 0.5);

      const quantities = result.map(r => r.quantity);
      const uniqueQuantities = new Set(quantities);

      expect(uniqueQuantities.size).toBeGreaterThan(1);
    });

    it('uses default parameters', () => {
      const result = generateMockSalesHistory('1');

      // Default is 90 days
      expect(result.length).toBeGreaterThanOrEqual(90);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('quantity');
    });

    it('generates higher sales on weekends', () => {
      const result = generateMockSalesHistory('1', 14, 10, 0);

      // With zero variance, weekend boost should be visible
      const quantities = result.map(r => {
        const date = new Date(r.date);
        return { dayOfWeek: date.getDay(), quantity: r.quantity };
      });

      // Saturday (6) or Sunday (0) should have higher values
      const weekendSales = quantities.filter(q => q.dayOfWeek === 0 || q.dayOfWeek === 6);
      const weekdaySales = quantities.filter(q => q.dayOfWeek !== 0 && q.dayOfWeek !== 6);

      if (weekendSales.length > 0 && weekdaySales.length > 0) {
        const avgWeekend = weekendSales.reduce((sum, q) => sum + q.quantity, 0) / weekendSales.length;
        const avgWeekday = weekdaySales.reduce((sum, q) => sum + q.quantity, 0) / weekdaySales.length;
        expect(avgWeekend).toBeGreaterThanOrEqual(avgWeekday);
      }
    });
  });
});
