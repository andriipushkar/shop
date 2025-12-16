/**
 * Shop Platform SDK for Node.js
 * Enables partners to integrate with Shop marketplace in minutes
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// =============================================================================
// TYPES
// =============================================================================

export interface ShopClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  categoryId: string;
  images: string[];
  variants?: ProductVariant[];
  inventory: number;
  status: 'active' | 'draft' | 'archived';
  attributes?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  inventory: number;
  options: Record<string, string>;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  categoryId: string;
  images?: string[];
  inventory?: number;
  attributes?: Record<string, string>;
}

export interface ListProductsParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  status?: string;
  search?: string;
}

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerEmail: string;
  customerName: string;
  shippingAddress: Address;
  billingAddress: Address;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  since?: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  active: boolean;
  createdAt: string;
}

export type WebhookEvent =
  | 'order.created'
  | 'order.paid'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'inventory.low';

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  description?: string;
  image?: string;
}

// =============================================================================
// CLIENT
// =============================================================================

export class ShopClient {
  private client: AxiosInstance;

  public products: ProductsAPI;
  public orders: OrdersAPI;
  public webhooks: WebhooksAPI;
  public categories: CategoriesAPI;

  constructor(config: ShopClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.shop.com/v1',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'shop-node-sdk/1.0.0',
      },
    });

    // Initialize API modules
    this.products = new ProductsAPI(this.client);
    this.orders = new OrdersAPI(this.client);
    this.webhooks = new WebhooksAPI(this.client);
    this.categories = new CategoriesAPI(this.client);
  }
}

// =============================================================================
// PRODUCTS API
// =============================================================================

class ProductsAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Create a new product
   */
  async create(input: CreateProductInput): Promise<Product> {
    const { data } = await this.client.post<Product>('/products', input);
    return data;
  }

  /**
   * Get a product by ID
   */
  async get(id: string): Promise<Product> {
    const { data } = await this.client.get<Product>(`/products/${id}`);
    return data;
  }

  /**
   * Update a product
   */
  async update(id: string, input: Partial<CreateProductInput>): Promise<Product> {
    const { data } = await this.client.put<Product>(`/products/${id}`, input);
    return data;
  }

  /**
   * Delete a product
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(`/products/${id}`);
  }

  /**
   * List products with optional filters
   */
  async list(params?: ListProductsParams): Promise<PaginatedList<Product>> {
    const { data } = await this.client.get<PaginatedList<Product>>('/products', { params });
    return data;
  }

  /**
   * Update product inventory
   */
  async updateInventory(id: string, quantity: number): Promise<void> {
    await this.client.patch(`/products/${id}/inventory`, { inventory: quantity });
  }

  /**
   * Bulk create products
   */
  async bulkCreate(products: CreateProductInput[]): Promise<Product[]> {
    const { data } = await this.client.post<Product[]>('/products/bulk', { products });
    return data;
  }

  /**
   * Bulk update inventory
   */
  async bulkUpdateInventory(updates: Array<{ id: string; quantity: number }>): Promise<void> {
    await this.client.patch('/products/inventory/bulk', { updates });
  }
}

// =============================================================================
// ORDERS API
// =============================================================================

class OrdersAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Get an order by ID
   */
  async get(id: string): Promise<Order> {
    const { data } = await this.client.get<Order>(`/orders/${id}`);
    return data;
  }

  /**
   * List orders with optional filters
   */
  async list(params?: ListOrdersParams): Promise<PaginatedList<Order>> {
    const { data } = await this.client.get<PaginatedList<Order>>('/orders', { params });
    return data;
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const { data } = await this.client.patch<Order>(`/orders/${id}/status`, { status });
    return data;
  }

  /**
   * Add tracking information to an order
   */
  async addTracking(id: string, carrier: string, trackingNumber: string): Promise<void> {
    await this.client.post(`/orders/${id}/tracking`, {
      carrier,
      tracking_number: trackingNumber,
    });
  }

  /**
   * Add fulfillment to an order
   */
  async fulfill(id: string, items: Array<{ itemId: string; quantity: number }>): Promise<void> {
    await this.client.post(`/orders/${id}/fulfill`, { items });
  }

  /**
   * Cancel an order
   */
  async cancel(id: string, reason?: string): Promise<Order> {
    const { data } = await this.client.post<Order>(`/orders/${id}/cancel`, { reason });
    return data;
  }

  /**
   * Refund an order
   */
  async refund(id: string, amount?: number, reason?: string): Promise<Order> {
    const { data } = await this.client.post<Order>(`/orders/${id}/refund`, { amount, reason });
    return data;
  }
}

// =============================================================================
// WEBHOOKS API
// =============================================================================

class WebhooksAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * Create a new webhook
   */
  async create(url: string, events: WebhookEvent[]): Promise<Webhook> {
    const { data } = await this.client.post<Webhook>('/webhooks', { url, events });
    return data;
  }

  /**
   * Delete a webhook
   */
  async delete(id: string): Promise<void> {
    await this.client.delete(`/webhooks/${id}`);
  }

  /**
   * List webhooks
   */
  async list(): Promise<Webhook[]> {
    const { data } = await this.client.get<Webhook[]>('/webhooks');
    return data;
  }

  /**
   * Update a webhook
   */
  async update(id: string, updates: { url?: string; events?: WebhookEvent[]; active?: boolean }): Promise<Webhook> {
    const { data } = await this.client.patch<Webhook>(`/webhooks/${id}`, updates);
    return data;
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}

// =============================================================================
// CATEGORIES API
// =============================================================================

class CategoriesAPI {
  constructor(private client: AxiosInstance) {}

  /**
   * List all categories
   */
  async list(): Promise<Category[]> {
    const { data } = await this.client.get<Category[]>('/categories');
    return data;
  }

  /**
   * Get a category by ID
   */
  async get(id: string): Promise<Category> {
    const { data } = await this.client.get<Category>(`/categories/${id}`);
    return data;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default ShopClient;

// Webhook event constants
export const WebhookEvents = {
  ORDER_CREATED: 'order.created' as WebhookEvent,
  ORDER_PAID: 'order.paid' as WebhookEvent,
  ORDER_SHIPPED: 'order.shipped' as WebhookEvent,
  ORDER_DELIVERED: 'order.delivered' as WebhookEvent,
  ORDER_CANCELLED: 'order.cancelled' as WebhookEvent,
  PRODUCT_CREATED: 'product.created' as WebhookEvent,
  PRODUCT_UPDATED: 'product.updated' as WebhookEvent,
  PRODUCT_DELETED: 'product.deleted' as WebhookEvent,
  INVENTORY_LOW: 'inventory.low' as WebhookEvent,
};
