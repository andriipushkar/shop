/**
 * Tests for Inventory Management System
 */

import {
  calculateInventoryStatus,
  calculateAvailableQuantity,
  shouldReorder,
  calculateReorderQuantity,
  calculateInventoryValue,
  calculateTurnoverRate,
  calculateDaysOfStock,
  formatInventoryValue,
  validateMovementInput,
  calculateStockTakeProgress,
  generateSku,
  generateLocationCode,
  INVENTORY_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  InventoryItem,
  CreateMovementInput,
  StockTake,
} from '../../../lib/admin/inventory';

describe('Inventory Management System', () => {
  // Sample inventory item
  const createSampleItem = (overrides?: Partial<InventoryItem>): InventoryItem => ({
    id: 'inv-1',
    productId: 'prod-1',
    productName: 'Test Product',
    productSku: 'TST-001',
    productImage: 'image.jpg',
    categoryId: 'cat-1',
    categoryName: 'Category 1',
    warehouseId: 'wh-1',
    warehouseName: 'Main Warehouse',
    locationCode: 'A1-01',
    quantity: 100,
    reservedQuantity: 10,
    availableQuantity: 90,
    minStockLevel: 20,
    maxStockLevel: 200,
    reorderPoint: 30,
    reorderQuantity: 50,
    costPrice: 500,
    status: 'in_stock',
    ...overrides,
  });

  describe('calculateInventoryStatus', () => {
    it('should return out_of_stock for 0 quantity', () => {
      const status = calculateInventoryStatus(0, 20, 200);
      expect(status).toBe('out_of_stock');
    });

    it('should return low_stock when below minimum', () => {
      const status = calculateInventoryStatus(15, 20, 200);
      expect(status).toBe('low_stock');
    });

    it('should return in_stock for normal quantity', () => {
      const status = calculateInventoryStatus(100, 20, 200);
      expect(status).toBe('in_stock');
    });

    it('should return overstock when above maximum', () => {
      const status = calculateInventoryStatus(250, 20, 200);
      expect(status).toBe('overstock');
    });

    it('should return low_stock at exact minimum', () => {
      const status = calculateInventoryStatus(20, 20, 200);
      expect(status).toBe('low_stock');
    });

    it('should return in_stock at exact maximum', () => {
      const status = calculateInventoryStatus(200, 20, 200);
      expect(status).toBe('in_stock');
    });
  });

  describe('calculateAvailableQuantity', () => {
    it('should subtract reserved from total', () => {
      const available = calculateAvailableQuantity(100, 20);
      expect(available).toBe(80);
    });

    it('should not return negative', () => {
      const available = calculateAvailableQuantity(10, 20);
      expect(available).toBe(0);
    });

    it('should return full quantity when no reserved', () => {
      const available = calculateAvailableQuantity(100, 0);
      expect(available).toBe(100);
    });
  });

  describe('shouldReorder', () => {
    it('should return true when below reorder point', () => {
      const item = createSampleItem({
        availableQuantity: 25,
        reorderPoint: 30,
      });

      expect(shouldReorder(item)).toBe(true);
    });

    it('should return false when above reorder point', () => {
      const item = createSampleItem({
        availableQuantity: 50,
        reorderPoint: 30,
      });

      expect(shouldReorder(item)).toBe(false);
    });

    it('should return true at exact reorder point', () => {
      const item = createSampleItem({
        availableQuantity: 30,
        reorderPoint: 30,
      });

      expect(shouldReorder(item)).toBe(true);
    });
  });

  describe('calculateReorderQuantity', () => {
    it('should return 0 when above reorder point', () => {
      const item = createSampleItem({
        availableQuantity: 50,
        reorderPoint: 30,
      });

      expect(calculateReorderQuantity(item)).toBe(0);
    });

    it('should calculate quantity to reach max stock', () => {
      const item = createSampleItem({
        quantity: 20,
        availableQuantity: 20,
        reorderPoint: 30,
        maxStockLevel: 200,
        reorderQuantity: 50,
      });

      const reorderQty = calculateReorderQuantity(item);

      // Should order up to max: 200 - 20 = 180
      // But minimum is reorderQuantity (50)
      expect(reorderQty).toBe(180);
    });

    it('should respect minimum reorder quantity', () => {
      const item = createSampleItem({
        quantity: 180,
        availableQuantity: 25,
        reorderPoint: 30,
        maxStockLevel: 200,
        reorderQuantity: 50,
      });

      const reorderQty = calculateReorderQuantity(item);

      // Max - current = 200 - 180 = 20, but minimum is 50
      expect(reorderQty).toBe(50);
    });
  });

  describe('calculateInventoryValue', () => {
    it('should calculate total value correctly', () => {
      const items = [
        createSampleItem({ quantity: 100, costPrice: 500 }),
        createSampleItem({ quantity: 50, costPrice: 1000 }),
      ];

      const value = calculateInventoryValue(items);

      expect(value).toBe(100 * 500 + 50 * 1000); // 100000
    });

    it('should return 0 for empty array', () => {
      const value = calculateInventoryValue([]);
      expect(value).toBe(0);
    });

    it('should handle items with 0 quantity', () => {
      const items = [
        createSampleItem({ quantity: 0, costPrice: 500 }),
      ];

      const value = calculateInventoryValue(items);
      expect(value).toBe(0);
    });
  });

  describe('calculateTurnoverRate', () => {
    it('should calculate turnover rate', () => {
      const rate = calculateTurnoverRate(1000000, 100000);
      expect(rate).toBe(10); // 1M / 100K = 10
    });

    it('should return 0 for zero inventory', () => {
      const rate = calculateTurnoverRate(1000000, 0);
      expect(rate).toBe(0);
    });
  });

  describe('calculateDaysOfStock', () => {
    it('should calculate days remaining', () => {
      const days = calculateDaysOfStock(100, 10);
      expect(days).toBe(10); // 100 / 10 = 10 days
    });

    it('should return null for zero sales', () => {
      const days = calculateDaysOfStock(100, 0);
      expect(days).toBeNull();
    });

    it('should floor the result', () => {
      const days = calculateDaysOfStock(100, 7);
      expect(days).toBe(14); // 100 / 7 = 14.28 -> 14
    });
  });

  describe('formatInventoryValue', () => {
    it('should format as currency', () => {
      const formatted = formatInventoryValue(100000);

      expect(formatted).toContain('100');
      expect(formatted).toContain('₴');
    });

    it('should handle large values', () => {
      const formatted = formatInventoryValue(1000000);

      expect(formatted).toContain('1');
      expect(formatted).toContain('000');
      expect(formatted).toContain('000');
    });
  });

  describe('validateMovementInput', () => {
    it('should pass for valid receipt', () => {
      const input: CreateMovementInput = {
        type: 'receipt',
        productId: 'prod-1',
        toWarehouseId: 'wh-1',
        quantity: 50,
        reason: 'purchase_order',
      };

      const errors = validateMovementInput(input);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should fail for missing product', () => {
      const input: CreateMovementInput = {
        type: 'receipt',
        productId: '',
        toWarehouseId: 'wh-1',
        quantity: 50,
        reason: 'purchase_order',
      };

      const errors = validateMovementInput(input);
      expect(errors.productId).toBeTruthy();
    });

    it('should fail for zero quantity', () => {
      const input: CreateMovementInput = {
        type: 'receipt',
        productId: 'prod-1',
        toWarehouseId: 'wh-1',
        quantity: 0,
        reason: 'purchase_order',
      };

      const errors = validateMovementInput(input);
      expect(errors.quantity).toBeTruthy();
    });

    it('should fail for negative quantity', () => {
      const input: CreateMovementInput = {
        type: 'receipt',
        productId: 'prod-1',
        toWarehouseId: 'wh-1',
        quantity: -10,
        reason: 'purchase_order',
      };

      const errors = validateMovementInput(input);
      expect(errors.quantity).toBeTruthy();
    });

    it('should require both warehouses for transfer', () => {
      const input: CreateMovementInput = {
        type: 'transfer',
        productId: 'prod-1',
        quantity: 50,
        reason: 'transfer',
      };

      const errors = validateMovementInput(input);
      expect(errors.fromWarehouseId).toBeTruthy();
      expect(errors.toWarehouseId).toBeTruthy();
    });

    it('should fail for transfer to same warehouse', () => {
      const input: CreateMovementInput = {
        type: 'transfer',
        productId: 'prod-1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-1',
        quantity: 50,
        reason: 'transfer',
      };

      const errors = validateMovementInput(input);
      expect(errors.toWarehouseId).toBeTruthy();
    });

    it('should require source warehouse for shipment', () => {
      const input: CreateMovementInput = {
        type: 'shipment',
        productId: 'prod-1',
        quantity: 50,
        reason: 'customer_order',
      };

      const errors = validateMovementInput(input);
      expect(errors.fromWarehouseId).toBeTruthy();
    });
  });

  describe('calculateStockTakeProgress', () => {
    it('should calculate progress percentage', () => {
      const stockTake: StockTake = {
        id: 'st-1',
        warehouseId: 'wh-1',
        warehouseName: 'Main',
        status: 'in_progress',
        type: 'full',
        items: [],
        totalItems: 100,
        countedItems: 50,
        discrepancies: 5,
        startedAt: new Date(),
        startedBy: 'admin',
        startedByName: 'Admin',
      };

      const progress = calculateStockTakeProgress(stockTake);
      expect(progress).toBe(50);
    });

    it('should return 0 for empty stock take', () => {
      const stockTake: StockTake = {
        id: 'st-1',
        warehouseId: 'wh-1',
        warehouseName: 'Main',
        status: 'draft',
        type: 'full',
        items: [],
        totalItems: 0,
        countedItems: 0,
        discrepancies: 0,
        startedAt: new Date(),
        startedBy: 'admin',
        startedByName: 'Admin',
      };

      const progress = calculateStockTakeProgress(stockTake);
      expect(progress).toBe(0);
    });

    it('should return 100 for completed stock take', () => {
      const stockTake: StockTake = {
        id: 'st-1',
        warehouseId: 'wh-1',
        warehouseName: 'Main',
        status: 'completed',
        type: 'full',
        items: [],
        totalItems: 100,
        countedItems: 100,
        discrepancies: 3,
        startedAt: new Date(),
        startedBy: 'admin',
        startedByName: 'Admin',
      };

      const progress = calculateStockTakeProgress(stockTake);
      expect(progress).toBe(100);
    });
  });

  describe('generateSku', () => {
    it('should generate SKU with category prefix', () => {
      const sku = generateSku('ELEC', 'prod-123');

      expect(sku.startsWith('ELEC-')).toBe(true);
    });

    it('should generate unique SKUs', () => {
      const skus = new Set<string>();

      for (let i = 0; i < 100; i++) {
        skus.add(generateSku('CAT', `prod-${i}`));
      }

      expect(skus.size).toBe(100);
    });

    it('should contain uppercase random parts', () => {
      const sku = generateSku('TEST', 'prod-1');
      const parts = sku.split('-');

      // The second part (timestamp + random) should be uppercase
      expect(parts[1]).toBe(parts[1].toUpperCase());
    });
  });

  describe('generateLocationCode', () => {
    it('should generate valid location code', () => {
      const code = generateLocationCode('WH1', 'A', '01', '003');

      expect(code).toBe('WH1-A01-003');
    });

    it('should combine all parts', () => {
      const code = generateLocationCode('MAIN', 'B', '12', '015');

      expect(code).toContain('MAIN');
      expect(code).toContain('B');
      expect(code).toContain('12');
      expect(code).toContain('015');
    });
  });

  describe('INVENTORY_STATUS_LABELS', () => {
    it('should have all statuses', () => {
      expect(INVENTORY_STATUS_LABELS.in_stock).toBeDefined();
      expect(INVENTORY_STATUS_LABELS.low_stock).toBeDefined();
      expect(INVENTORY_STATUS_LABELS.out_of_stock).toBeDefined();
      expect(INVENTORY_STATUS_LABELS.overstock).toBeDefined();
      expect(INVENTORY_STATUS_LABELS.discontinued).toBeDefined();
    });

    it('should have all required properties', () => {
      Object.values(INVENTORY_STATUS_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
        expect(label.color).toBeTruthy();
      });
    });
  });

  describe('MOVEMENT_TYPE_LABELS', () => {
    it('should have all movement types', () => {
      expect(MOVEMENT_TYPE_LABELS.receipt).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.shipment).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.transfer).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.adjustment).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.write_off).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.return).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.reserve).toBeDefined();
      expect(MOVEMENT_TYPE_LABELS.unreserve).toBeDefined();
    });

    it('should have all required properties', () => {
      Object.values(MOVEMENT_TYPE_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
        expect(label.icon).toBeTruthy();
      });
    });
  });
});
