/**
 * Dropshipping Supplier Service
 * Кабінет постачальника для дропшипінгу
 */

interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  edrpou?: string; // ЄДРПОУ код
  status: 'pending' | 'active' | 'suspended';
  commissionRate: number; // Комісія платформи (%)
  paymentTermDays: number;
  autoApprove: boolean; // Автоматичне схвалення товарів
  apiKey?: string;
  webhookUrl?: string;
  createdAt: Date;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  sku: string;
  name: string;
  description: string;
  price: number; // Ціна постачальника
  retailPrice?: number; // Рекомендована роздрібна ціна
  stock: number;
  category: string;
  brand?: string;
  images: string[];
  attributes: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  lastStockUpdate: Date;
}

export interface SupplierOrder {
  id: string;
  supplierId: string;
  platformOrderId: string;
  items: SupplierOrderItem[];
  shippingAddress: Address;
  status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  supplierTotal: number; // Сума постачальнику
  platformCommission: number; // Комісія платформи
  createdAt: Date;
}

export interface SupplierOrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

export interface SupplierRegistration {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  edrpou?: string;
  description?: string;
  websiteUrl?: string;
}

export interface CreateProduct {
  sku: string;
  name: string;
  description: string;
  price: number;
  retailPrice?: number;
  stock: number;
  category: string;
  brand?: string;
  images: string[];
  attributes?: Record<string, string>;
}

export interface ProductFilters {
  category?: string;
  status?: 'pending' | 'approved' | 'rejected';
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface OrderFilters {
  status?: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface StockUpdate {
  sku: string;
  stock: number;
  price?: number;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  updated: number;
  errors: string[];
  timestamp: Date;
}

export interface TrackingInfo {
  trackingNumber: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: Date;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface EarningsReport {
  totalEarnings: number;
  totalOrders: number;
  totalCommission: number;
  netEarnings: number;
  periodStart: Date;
  periodEnd: Date;
  breakdown: {
    date: string;
    orders: number;
    earnings: number;
    commission: number;
  }[];
}

export interface Payout {
  id: string;
  supplierId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  method: 'bank_transfer' | 'paypal' | 'card';
}

export interface PayoutRequest {
  id: string;
  amount: number;
  status: 'pending';
  requestedAt: Date;
}

export class SupplierService {
  private apiUrl: string;

  constructor(apiUrl: string = '/api/supplier') {
    this.apiUrl = apiUrl;
  }

  // Supplier management
  async registerSupplier(data: SupplierRegistration): Promise<Supplier> {
    const response = await fetch(`${this.apiUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Помилка реєстрації постачальника');
    }

    return response.json();
  }

  async getSupplier(supplierId: string): Promise<Supplier> {
    const response = await fetch(`${this.apiUrl}/profile?id=${supplierId}`);

    if (!response.ok) {
      throw new Error('Помилка отримання профілю постачальника');
    }

    return response.json();
  }

  async updateSupplier(supplierId: string, data: Partial<Supplier>): Promise<Supplier> {
    const response = await fetch(`${this.apiUrl}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, ...data }),
    });

    if (!response.ok) {
      throw new Error('Помилка оновлення профілю');
    }

    return response.json();
  }

  async suspendSupplier(supplierId: string, reason: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, reason }),
    });

    if (!response.ok) {
      throw new Error('Помилка призупинення постачальника');
    }
  }

  // Product management
  async addProduct(supplierId: string, product: CreateProduct): Promise<SupplierProduct> {
    const response = await fetch(`${this.apiUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, ...product }),
    });

    if (!response.ok) {
      throw new Error('Помилка додавання товару');
    }

    return response.json();
  }

  async updateProduct(productId: string, data: Partial<SupplierProduct>): Promise<SupplierProduct> {
    const response = await fetch(`${this.apiUrl}/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Помилка оновлення товару');
    }

    return response.json();
  }

  async deleteProduct(productId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/products/${productId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Помилка видалення товару');
    }
  }

  async getProducts(supplierId: string, filters?: ProductFilters): Promise<SupplierProduct[]> {
    const params = new URLSearchParams({ supplierId });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`${this.apiUrl}/products?${params}`);

    if (!response.ok) {
      throw new Error('Помилка отримання товарів');
    }

    return response.json();
  }

  // Bulk import
  async importProducts(supplierId: string, file: File, format: 'csv' | 'xlsx' | 'xml'): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('supplierId', supplierId);
    formData.append('format', format);

    const response = await fetch(`${this.apiUrl}/products/import`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Помилка імпорту товарів');
    }

    return response.json();
  }

  async exportProducts(supplierId: string, format: 'csv' | 'xlsx'): Promise<Blob> {
    const response = await fetch(`${this.apiUrl}/products/export?supplierId=${supplierId}&format=${format}`);

    if (!response.ok) {
      throw new Error('Помилка експорту товарів');
    }

    return response.blob();
  }

  // Stock management
  async updateStock(supplierId: string, updates: StockUpdate[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, updates }),
    });

    if (!response.ok) {
      throw new Error('Помилка оновлення залишків');
    }
  }

  async syncStockFromFeed(supplierId: string, feedUrl: string): Promise<SyncResult> {
    const response = await fetch(`${this.apiUrl}/stock/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, feedUrl }),
    });

    if (!response.ok) {
      throw new Error('Помилка синхронізації залишків');
    }

    return response.json();
  }

  // Order management
  async getSupplierOrders(supplierId: string, filters?: OrderFilters): Promise<SupplierOrder[]> {
    const params = new URLSearchParams({ supplierId });

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`${this.apiUrl}/orders?${params}`);

    if (!response.ok) {
      throw new Error('Помилка отримання замовлень');
    }

    return response.json();
  }

  async confirmOrder(orderId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/orders/${orderId}/confirm`, {
      method: 'PUT',
    });

    if (!response.ok) {
      throw new Error('Помилка підтвердження замовлення');
    }
  }

  async shipOrder(orderId: string, trackingInfo: TrackingInfo): Promise<void> {
    const response = await fetch(`${this.apiUrl}/orders/${orderId}/ship`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trackingInfo),
    });

    if (!response.ok) {
      throw new Error('Помилка відправки замовлення');
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      throw new Error('Помилка скасування замовлення');
    }
  }

  // Financial
  async getEarnings(supplierId: string, period: DateRange): Promise<EarningsReport> {
    const params = new URLSearchParams({
      supplierId,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    });

    const response = await fetch(`${this.apiUrl}/earnings?${params}`);

    if (!response.ok) {
      throw new Error('Помилка отримання звіту про прибутки');
    }

    return response.json();
  }

  async getPendingPayouts(supplierId: string): Promise<Payout[]> {
    const response = await fetch(`${this.apiUrl}/payouts?supplierId=${supplierId}&status=pending`);

    if (!response.ok) {
      throw new Error('Помилка отримання виплат');
    }

    return response.json();
  }

  async requestPayout(supplierId: string, amount: number): Promise<PayoutRequest> {
    const response = await fetch(`${this.apiUrl}/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, amount }),
    });

    if (!response.ok) {
      throw new Error('Помилка запиту на виплату');
    }

    return response.json();
  }
}

// Default export
export default SupplierService;
