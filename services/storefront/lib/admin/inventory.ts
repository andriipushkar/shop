/**
 * Inventory Management System
 * Stock tracking, movements, write-offs, and inventory operations
 */

// ==================== TYPES ====================

export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productImage?: string;
  categoryId: string;
  categoryName: string;
  warehouseId: string;
  warehouseName: string;
  locationCode?: string; // Shelf/bin location
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  costPrice: number;
  lastStockTakeDate?: Date;
  lastMovementDate?: Date;
  status: InventoryStatus;
}

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstock' | 'discontinued';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  isActive: boolean;
  isDefault: boolean;
  type: WarehouseType;
  capacity: number;
  currentOccupancy: number;
  contactPerson?: string;
  contactPhone?: string;
  createdAt: Date;
}

export type WarehouseType = 'main' | 'retail' | 'fulfillment' | 'returns' | 'transit';

export interface StockMovement {
  id: string;
  type: MovementType;
  productId: string;
  productName: string;
  productSku: string;
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason: MovementReason;
  referenceType?: ReferenceType;
  referenceId?: string;
  notes?: string;
  performedBy: string;
  performedByName: string;
  createdAt: Date;
  costPrice?: number;
  totalCost?: number;
}

export type MovementType =
  | 'receipt' // Receiving goods
  | 'shipment' // Shipping to customer
  | 'transfer' // Between warehouses
  | 'adjustment' // Manual adjustment
  | 'write_off' // Damaged/expired goods
  | 'return' // Customer returns
  | 'reserve' // Reserved for order
  | 'unreserve'; // Released reservation

export type MovementReason =
  | 'purchase_order'
  | 'customer_order'
  | 'customer_return'
  | 'damaged'
  | 'expired'
  | 'lost'
  | 'theft'
  | 'stock_count'
  | 'transfer'
  | 'initial_stock'
  | 'production'
  | 'other';

export type ReferenceType = 'order' | 'purchase_order' | 'return' | 'stock_take' | 'transfer';

export interface StockTake {
  id: string;
  warehouseId: string;
  warehouseName: string;
  status: StockTakeStatus;
  type: StockTakeType;
  categoryId?: string;
  categoryName?: string;
  locationFilter?: string;
  items: StockTakeItem[];
  totalItems: number;
  countedItems: number;
  discrepancies: number;
  startedAt: Date;
  completedAt?: Date;
  startedBy: string;
  startedByName: string;
  completedBy?: string;
  completedByName?: string;
  notes?: string;
}

export type StockTakeStatus = 'draft' | 'in_progress' | 'pending_review' | 'completed' | 'cancelled';
export type StockTakeType = 'full' | 'partial' | 'cycle_count' | 'spot_check';

export interface StockTakeItem {
  id: string;
  stockTakeId: string;
  productId: string;
  productName: string;
  productSku: string;
  locationCode?: string;
  expectedQuantity: number;
  countedQuantity?: number;
  discrepancy: number;
  discrepancyReason?: string;
  status: StockTakeItemStatus;
  countedAt?: Date;
  countedBy?: string;
}

export type StockTakeItemStatus = 'pending' | 'counted' | 'recounted' | 'verified';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  shippingCost: number;
  total: number;
  currency: string;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'ordered'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string;
  productSku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  status: PurchaseOrderItemStatus;
}

export type PurchaseOrderItemStatus = 'pending' | 'partially_received' | 'received' | 'cancelled';

export interface Supplier {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country: string;
  contactPerson?: string;
  paymentTerms?: string;
  leadTimeDays: number;
  isActive: boolean;
  rating?: number;
  notes?: string;
  createdAt: Date;
}

export interface InventoryReport {
  generatedAt: Date;
  warehouseId?: string;
  totalProducts: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  averageTurnover: number;
  categoryBreakdown: CategoryInventory[];
  topMovers: ProductMovement[];
  slowMovers: ProductMovement[];
}

export interface CategoryInventory {
  categoryId: string;
  categoryName: string;
  productCount: number;
  totalQuantity: number;
  totalValue: number;
  percentOfTotal: number;
}

export interface ProductMovement {
  productId: string;
  productName: string;
  productSku: string;
  movementCount: number;
  totalQuantity: number;
  averageMonthly: number;
}

export interface InventoryAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  currentQuantity: number;
  threshold: number;
  message: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export type AlertType = 'low_stock' | 'out_of_stock' | 'overstock' | 'expiring_soon' | 'slow_moving';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

// ==================== INPUT TYPES ====================

export interface CreateMovementInput {
  type: MovementType;
  productId: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  quantity: number;
  reason: MovementReason;
  referenceType?: ReferenceType;
  referenceId?: string;
  notes?: string;
  costPrice?: number;
}

export interface CreateStockTakeInput {
  warehouseId: string;
  type: StockTakeType;
  categoryId?: string;
  locationFilter?: string;
  notes?: string;
}

export interface UpdateStockTakeItemInput {
  itemId: string;
  countedQuantity: number;
  discrepancyReason?: string;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  warehouseId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  expectedDeliveryDate?: Date;
  notes?: string;
}

export interface ReceivePurchaseOrderInput {
  purchaseOrderId: string;
  items: { itemId: string; receivedQuantity: number }[];
  notes?: string;
}

export interface InventoryFilters {
  warehouseId?: string;
  categoryId?: string;
  status?: InventoryStatus;
  search?: string;
  lowStockOnly?: boolean;
  outOfStockOnly?: boolean;
}

// ==================== CONSTANTS ====================

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, { en: string; uk: string; color: string }> = {
  in_stock: { en: 'In Stock', uk: 'В наявності', color: '#10b981' },
  low_stock: { en: 'Low Stock', uk: 'Мало залишків', color: '#f59e0b' },
  out_of_stock: { en: 'Out of Stock', uk: 'Немає в наявності', color: '#ef4444' },
  overstock: { en: 'Overstock', uk: 'Надлишок', color: '#8b5cf6' },
  discontinued: { en: 'Discontinued', uk: 'Знято з продажу', color: '#6b7280' },
};

export const MOVEMENT_TYPE_LABELS: Record<MovementType, { en: string; uk: string; icon: string }> = {
  receipt: { en: 'Receipt', uk: 'Прихід', icon: 'arrow-down' },
  shipment: { en: 'Shipment', uk: 'Відвантаження', icon: 'arrow-up' },
  transfer: { en: 'Transfer', uk: 'Переміщення', icon: 'arrows-right-left' },
  adjustment: { en: 'Adjustment', uk: 'Коригування', icon: 'pencil' },
  write_off: { en: 'Write-off', uk: 'Списання', icon: 'trash' },
  return: { en: 'Return', uk: 'Повернення', icon: 'arrow-uturn-left' },
  reserve: { en: 'Reserve', uk: 'Резервування', icon: 'lock-closed' },
  unreserve: { en: 'Unreserve', uk: 'Зняття резерву', icon: 'lock-open' },
};

export const MOVEMENT_REASON_LABELS: Record<MovementReason, { en: string; uk: string }> = {
  purchase_order: { en: 'Purchase Order', uk: 'Замовлення постачальнику' },
  customer_order: { en: 'Customer Order', uk: 'Замовлення клієнта' },
  customer_return: { en: 'Customer Return', uk: 'Повернення клієнта' },
  damaged: { en: 'Damaged', uk: 'Пошкоджено' },
  expired: { en: 'Expired', uk: 'Прострочено' },
  lost: { en: 'Lost', uk: 'Втрачено' },
  theft: { en: 'Theft', uk: 'Крадіжка' },
  stock_count: { en: 'Stock Count', uk: 'Інвентаризація' },
  transfer: { en: 'Transfer', uk: 'Переміщення' },
  initial_stock: { en: 'Initial Stock', uk: 'Початковий залишок' },
  production: { en: 'Production', uk: 'Виробництво' },
  other: { en: 'Other', uk: 'Інше' },
};

export const STOCK_TAKE_STATUS_LABELS: Record<StockTakeStatus, { en: string; uk: string; color: string }> = {
  draft: { en: 'Draft', uk: 'Чернетка', color: '#6b7280' },
  in_progress: { en: 'In Progress', uk: 'В процесі', color: '#3b82f6' },
  pending_review: { en: 'Pending Review', uk: 'Очікує перевірки', color: '#f59e0b' },
  completed: { en: 'Completed', uk: 'Завершено', color: '#10b981' },
  cancelled: { en: 'Cancelled', uk: 'Скасовано', color: '#ef4444' },
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, { en: string; uk: string; color: string }> = {
  draft: { en: 'Draft', uk: 'Чернетка', color: '#6b7280' },
  pending_approval: { en: 'Pending Approval', uk: 'Очікує схвалення', color: '#f59e0b' },
  approved: { en: 'Approved', uk: 'Схвалено', color: '#3b82f6' },
  ordered: { en: 'Ordered', uk: 'Замовлено', color: '#8b5cf6' },
  partially_received: { en: 'Partially Received', uk: 'Частково отримано', color: '#06b6d4' },
  received: { en: 'Received', uk: 'Отримано', color: '#10b981' },
  cancelled: { en: 'Cancelled', uk: 'Скасовано', color: '#ef4444' },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate inventory status based on quantity and thresholds
 */
export function calculateInventoryStatus(
  quantity: number,
  minStockLevel: number,
  maxStockLevel: number
): InventoryStatus {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= minStockLevel) return 'low_stock';
  if (quantity > maxStockLevel) return 'overstock';
  return 'in_stock';
}

/**
 * Calculate available quantity
 */
export function calculateAvailableQuantity(quantity: number, reservedQuantity: number): number {
  return Math.max(0, quantity - reservedQuantity);
}

/**
 * Calculate reorder suggestion
 */
export function shouldReorder(item: InventoryItem): boolean {
  return item.availableQuantity <= item.reorderPoint;
}

/**
 * Calculate suggested reorder quantity
 */
export function calculateReorderQuantity(item: InventoryItem): number {
  if (item.availableQuantity > item.reorderPoint) return 0;

  // Order up to max stock level
  const needed = item.maxStockLevel - item.quantity;
  // But at least the configured reorder quantity
  return Math.max(needed, item.reorderQuantity);
}

/**
 * Calculate inventory value
 */
export function calculateInventoryValue(items: InventoryItem[]): number {
  return items.reduce((total, item) => total + item.quantity * item.costPrice, 0);
}

/**
 * Calculate stock turnover rate
 */
export function calculateTurnoverRate(
  costOfGoodsSold: number,
  averageInventoryValue: number
): number {
  if (averageInventoryValue === 0) return 0;
  return costOfGoodsSold / averageInventoryValue;
}

/**
 * Calculate days of stock remaining
 */
export function calculateDaysOfStock(
  currentQuantity: number,
  averageDailySales: number
): number | null {
  if (averageDailySales <= 0) return null;
  return Math.floor(currentQuantity / averageDailySales);
}

/**
 * Format inventory value as currency
 */
export function formatInventoryValue(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Validate movement input
 */
export function validateMovementInput(input: CreateMovementInput): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.productId) {
    errors.productId = 'Оберіть товар';
  }

  if (input.quantity <= 0) {
    errors.quantity = 'Кількість має бути більше 0';
  }

  if (input.type === 'transfer') {
    if (!input.fromWarehouseId) {
      errors.fromWarehouseId = 'Оберіть склад-джерело';
    }
    if (!input.toWarehouseId) {
      errors.toWarehouseId = 'Оберіть склад призначення';
    }
    if (input.fromWarehouseId === input.toWarehouseId) {
      errors.toWarehouseId = 'Склади мають бути різними';
    }
  }

  if (input.type === 'receipt' && !input.toWarehouseId) {
    errors.toWarehouseId = 'Оберіть склад';
  }

  if (input.type === 'shipment' && !input.fromWarehouseId) {
    errors.fromWarehouseId = 'Оберіть склад';
  }

  return errors;
}

/**
 * Calculate stock take progress
 */
export function calculateStockTakeProgress(stockTake: StockTake): number {
  if (stockTake.totalItems === 0) return 0;
  return (stockTake.countedItems / stockTake.totalItems) * 100;
}

/**
 * Calculate stock take discrepancy value
 */
export function calculateDiscrepancyValue(
  items: StockTakeItem[],
  getItemCost: (productId: string) => number
): number {
  return items.reduce((total, item) => {
    const cost = getItemCost(item.productId);
    return total + item.discrepancy * cost;
  }, 0);
}

/**
 * Generate SKU
 */
export function generateSku(categoryCode: string, productId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const randomPart = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${categoryCode}-${timestamp}${randomPart}`;
}

/**
 * Generate location code
 */
export function generateLocationCode(
  warehouseCode: string,
  aisle: string,
  shelf: string,
  bin: string
): string {
  return `${warehouseCode}-${aisle}${shelf}-${bin}`;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch inventory list
 */
export async function fetchInventory(filters?: InventoryFilters): Promise<InventoryItem[]> {
  const params = new URLSearchParams();

  if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
  if (filters?.categoryId) params.set('categoryId', filters.categoryId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.lowStockOnly) params.set('lowStockOnly', 'true');
  if (filters?.outOfStockOnly) params.set('outOfStockOnly', 'true');

  const response = await fetch(`/api/admin/inventory?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch inventory');
  }

  return response.json();
}

/**
 * Fetch single inventory item
 */
export async function fetchInventoryItem(id: string): Promise<InventoryItem> {
  const response = await fetch(`/api/admin/inventory/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch inventory item');
  }

  return response.json();
}

/**
 * Update inventory item
 */
export async function updateInventoryItem(
  id: string,
  updates: Partial<Pick<InventoryItem, 'minStockLevel' | 'maxStockLevel' | 'reorderPoint' | 'reorderQuantity' | 'locationCode'>>
): Promise<InventoryItem> {
  const response = await fetch(`/api/admin/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error('Failed to update inventory item');
  }

  return response.json();
}

/**
 * Create stock movement
 */
export async function createMovement(input: CreateMovementInput): Promise<StockMovement> {
  const response = await fetch('/api/admin/inventory/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create movement');
  }

  return response.json();
}

/**
 * Fetch stock movements
 */
export async function fetchMovements(filters?: {
  productId?: string;
  warehouseId?: string;
  type?: MovementType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<StockMovement[]> {
  const params = new URLSearchParams();

  if (filters?.productId) params.set('productId', filters.productId);
  if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.startDate) params.set('startDate', filters.startDate.toISOString());
  if (filters?.endDate) params.set('endDate', filters.endDate.toISOString());
  if (filters?.limit) params.set('limit', filters.limit.toString());

  const response = await fetch(`/api/admin/inventory/movements?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch movements');
  }

  return response.json();
}

/**
 * Fetch warehouses
 */
export async function fetchWarehouses(): Promise<Warehouse[]> {
  const response = await fetch('/api/admin/warehouses');

  if (!response.ok) {
    throw new Error('Failed to fetch warehouses');
  }

  return response.json();
}

/**
 * Create warehouse
 */
export async function createWarehouse(input: Omit<Warehouse, 'id' | 'currentOccupancy' | 'createdAt'>): Promise<Warehouse> {
  const response = await fetch('/api/admin/warehouses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create warehouse');
  }

  return response.json();
}

/**
 * Create stock take
 */
export async function createStockTake(input: CreateStockTakeInput): Promise<StockTake> {
  const response = await fetch('/api/admin/inventory/stock-takes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create stock take');
  }

  return response.json();
}

/**
 * Fetch stock takes
 */
export async function fetchStockTakes(filters?: {
  warehouseId?: string;
  status?: StockTakeStatus;
}): Promise<StockTake[]> {
  const params = new URLSearchParams();

  if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
  if (filters?.status) params.set('status', filters.status);

  const response = await fetch(`/api/admin/inventory/stock-takes?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch stock takes');
  }

  return response.json();
}

/**
 * Update stock take item
 */
export async function updateStockTakeItem(
  stockTakeId: string,
  input: UpdateStockTakeItemInput
): Promise<StockTakeItem> {
  const response = await fetch(`/api/admin/inventory/stock-takes/${stockTakeId}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to update stock take item');
  }

  return response.json();
}

/**
 * Complete stock take
 */
export async function completeStockTake(stockTakeId: string): Promise<StockTake> {
  const response = await fetch(`/api/admin/inventory/stock-takes/${stockTakeId}/complete`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to complete stock take');
  }

  return response.json();
}

/**
 * Fetch purchase orders
 */
export async function fetchPurchaseOrders(filters?: {
  supplierId?: string;
  status?: PurchaseOrderStatus;
}): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams();

  if (filters?.supplierId) params.set('supplierId', filters.supplierId);
  if (filters?.status) params.set('status', filters.status);

  const response = await fetch(`/api/admin/inventory/purchase-orders?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch purchase orders');
  }

  return response.json();
}

/**
 * Create purchase order
 */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  const response = await fetch('/api/admin/inventory/purchase-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to create purchase order');
  }

  return response.json();
}

/**
 * Receive purchase order items
 */
export async function receivePurchaseOrder(input: ReceivePurchaseOrderInput): Promise<PurchaseOrder> {
  const response = await fetch(`/api/admin/inventory/purchase-orders/${input.purchaseOrderId}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error('Failed to receive purchase order');
  }

  return response.json();
}

/**
 * Fetch suppliers
 */
export async function fetchSuppliers(): Promise<Supplier[]> {
  const response = await fetch('/api/admin/suppliers');

  if (!response.ok) {
    throw new Error('Failed to fetch suppliers');
  }

  return response.json();
}

/**
 * Fetch inventory alerts
 */
export async function fetchInventoryAlerts(): Promise<InventoryAlert[]> {
  const response = await fetch('/api/admin/inventory/alerts');

  if (!response.ok) {
    throw new Error('Failed to fetch inventory alerts');
  }

  return response.json();
}

/**
 * Acknowledge inventory alert
 */
export async function acknowledgeAlert(alertId: string): Promise<void> {
  const response = await fetch(`/api/admin/inventory/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to acknowledge alert');
  }
}

/**
 * Fetch inventory report
 */
export async function fetchInventoryReport(warehouseId?: string): Promise<InventoryReport> {
  const params = new URLSearchParams();
  if (warehouseId) params.set('warehouseId', warehouseId);

  const response = await fetch(`/api/admin/inventory/report?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch inventory report');
  }

  return response.json();
}

/**
 * Export inventory
 */
export async function exportInventory(
  format: 'csv' | 'excel',
  filters?: InventoryFilters
): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('format', format);

  if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
  if (filters?.categoryId) params.set('categoryId', filters.categoryId);
  if (filters?.status) params.set('status', filters.status);

  const response = await fetch(`/api/admin/inventory/export?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to export inventory');
  }

  return response.blob();
}

/**
 * Bulk update inventory
 */
export async function bulkUpdateInventory(
  updates: { id: string; quantity?: number; minStockLevel?: number; maxStockLevel?: number }[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  const response = await fetch('/api/admin/inventory/bulk-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to bulk update inventory');
  }

  return response.json();
}
