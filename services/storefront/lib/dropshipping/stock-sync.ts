/**
 * Stock Synchronization Service
 * Автоматична синхронізація залишків
 */

import { StockUpdate, SyncResult } from './supplier-service';
import * as xml2js from 'xml2js';

export interface StockFeed {
  id: string;
  supplierId: string;
  feedUrl: string;
  format: 'csv' | 'xml' | 'yml' | 'json';
  updateInterval: number; // minutes
  lastSync?: Date;
  lastSyncStatus?: 'success' | 'error';
  errorMessage?: string;
  fieldMapping: FieldMapping;
  enabled: boolean;
}

export interface FieldMapping {
  sku: string;
  stock: string;
  price?: string;
  name?: string;
  [key: string]: string | undefined;
}

export interface ParsedProduct {
  sku: string;
  stock: number;
  price?: number;
  name?: string;
}

export class StockSyncService {
  private feeds: Map<string, StockFeed> = new Map();

  /**
   * Configure feed for supplier
   * Налаштувати фід для постачальника
   */
  async configureFeed(config: StockFeed): Promise<void> {
    // Validate feed URL
    if (!this.isValidUrl(config.feedUrl)) {
      throw new Error('Невірний URL фіду');
    }

    // Test feed before saving
    try {
      await this.syncNow(config.supplierId, config);
    } catch (error) {
      throw new Error(`Помилка тестування фіду: ${error}`);
    }

    this.feeds.set(config.supplierId, config);
  }

  /**
   * Get feed configuration
   * Отримати налаштування фіду
   */
  getFeed(supplierId: string): StockFeed | undefined {
    return this.feeds.get(supplierId);
  }

  /**
   * Remove feed configuration
   * Видалити налаштування фіду
   */
  removeFeed(supplierId: string): void {
    this.feeds.delete(supplierId);
  }

  /**
   * Manual sync now
   * Ручна синхронізація зараз
   */
  async syncNow(supplierId: string, feedConfig?: StockFeed): Promise<SyncResult> {
    const config = feedConfig || this.feeds.get(supplierId);

    if (!config) {
      throw new Error('Конфігурація фіду не знайдена');
    }

    const startTime = new Date();

    try {
      // Fetch feed content
      const content = await this.fetchFeed(config.feedUrl);

      // Parse based on format
      let updates: StockUpdate[];
      switch (config.format) {
        case 'csv':
          updates = this.parseCSV(content, config.fieldMapping);
          break;
        case 'xml':
          updates = await this.parseXML(content, config.fieldMapping);
          break;
        case 'yml':
          updates = await this.parseYML(content, config.fieldMapping);
          break;
        case 'json':
          updates = this.parseJSON(content, config.fieldMapping);
          break;
        default:
          throw new Error(`Непідтримуваний формат: ${config.format}`);
      }

      // Update feed status
      config.lastSync = startTime;
      config.lastSyncStatus = 'success';
      config.errorMessage = undefined;
      this.feeds.set(supplierId, config);

      return {
        success: true,
        updated: updates.length,
        errors: [],
        timestamp: startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update feed status
      config.lastSync = startTime;
      config.lastSyncStatus = 'error';
      config.errorMessage = errorMessage;
      this.feeds.set(supplierId, config);

      return {
        success: false,
        updated: 0,
        errors: [errorMessage],
        timestamp: startTime,
      };
    }
  }

  /**
   * Parse CSV format
   * Розібрати формат CSV
   */
  parseCSV(content: string, mapping: FieldMapping): StockUpdate[] {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      throw new Error('Порожній CSV файл');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim());

    // Find column indexes
    const skuIndex = header.indexOf(mapping.sku);
    const stockIndex = header.indexOf(mapping.stock);
    const priceIndex = mapping.price ? header.indexOf(mapping.price) : -1;

    if (skuIndex === -1 || stockIndex === -1) {
      throw new Error('Не знайдено обов\'язкові колонки');
    }

    const updates: StockUpdate[] = [];

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());

      if (values.length < header.length) {
        continue; // Skip invalid rows
      }

      const sku = values[skuIndex];
      const stock = parseInt(values[stockIndex], 10);

      if (!sku || isNaN(stock)) {
        continue; // Skip invalid data
      }

      const update: StockUpdate = { sku, stock };

      if (priceIndex !== -1) {
        const price = parseFloat(values[priceIndex]);
        if (!isNaN(price)) {
          update.price = price;
        }
      }

      updates.push(update);
    }

    return updates;
  }

  /**
   * Parse XML format
   * Розібрати формат XML
   */
  async parseXML(content: string, mapping: FieldMapping): Promise<StockUpdate[]> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(content);

    // Navigate to products array
    let products: any[] = [];

    // Common XML structures
    if (result.catalog?.products?.product) {
      products = Array.isArray(result.catalog.products.product)
        ? result.catalog.products.product
        : [result.catalog.products.product];
    } else if (result.products?.product) {
      products = Array.isArray(result.products.product)
        ? result.products.product
        : [result.products.product];
    } else if (result.offers?.offer) {
      products = Array.isArray(result.offers.offer)
        ? result.offers.offer
        : [result.offers.offer];
    }

    const updates: StockUpdate[] = [];

    for (const product of products) {
      const sku = this.getNestedValue(product, mapping.sku);
      const stockStr = this.getNestedValue(product, mapping.stock);
      const stock = parseInt(stockStr, 10);

      if (!sku || isNaN(stock)) {
        continue;
      }

      const update: StockUpdate = { sku, stock };

      if (mapping.price) {
        const priceStr = this.getNestedValue(product, mapping.price);
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          update.price = price;
        }
      }

      updates.push(update);
    }

    return updates;
  }

  /**
   * Parse YML (Yandex Market Language) format
   * Розібрати формат YML
   */
  async parseYML(content: string, mapping: FieldMapping): Promise<StockUpdate[]> {
    // YML is XML-based
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(content);

    let offers: any[] = [];

    if (result.yml_catalog?.shop?.offers?.offer) {
      offers = Array.isArray(result.yml_catalog.shop.offers.offer)
        ? result.yml_catalog.shop.offers.offer
        : [result.yml_catalog.shop.offers.offer];
    }

    const updates: StockUpdate[] = [];

    for (const offer of offers) {
      // YML typically uses 'id' for SKU and 'available' for stock status
      const sku = offer.$.id || offer.id;
      const available = offer.$.available === 'true';
      const stock = available ? 1 : 0; // Simple availability check

      if (!sku) {
        continue;
      }

      const update: StockUpdate = { sku, stock };

      if (offer.price) {
        const price = parseFloat(offer.price);
        if (!isNaN(price)) {
          update.price = price;
        }
      }

      updates.push(update);
    }

    return updates;
  }

  /**
   * Parse JSON format
   * Розібрати формат JSON
   */
  parseJSON(content: string, mapping: FieldMapping): StockUpdate[] {
    const data = JSON.parse(content);

    // Handle array or object with products array
    let products: any[] = Array.isArray(data) ? data : data.products || data.items || [];

    const updates: StockUpdate[] = [];

    for (const product of products) {
      const sku = this.getNestedValue(product, mapping.sku);
      const stockStr = this.getNestedValue(product, mapping.stock);
      const stock = parseInt(stockStr, 10);

      if (!sku || isNaN(stock)) {
        continue;
      }

      const update: StockUpdate = { sku, stock };

      if (mapping.price) {
        const priceStr = this.getNestedValue(product, mapping.price);
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          update.price = price;
        }
      }

      updates.push(update);
    }

    return updates;
  }

  /**
   * Scheduled sync (called by cron)
   * Планова синхронізація
   */
  async runScheduledSync(): Promise<void> {
    const now = new Date();

    for (const [supplierId, config] of this.feeds.entries()) {
      if (!config.enabled) {
        continue;
      }

      // Check if sync is needed
      const lastSync = config.lastSync || new Date(0);
      const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);

      if (minutesSinceLastSync >= config.updateInterval) {
        try {
          await this.syncNow(supplierId);
        } catch (error) {
          console.error(`Sync failed for supplier ${supplierId}:`, error);
        }
      }
    }
  }

  /**
   * Webhook handler for real-time updates
   * Обробник webhook для оновлень в реальному часі
   */
  async handleStockWebhook(supplierId: string, updates: StockUpdate[]): Promise<void> {
    // Validate supplier exists
    const feed = this.feeds.get(supplierId);
    if (!feed) {
      throw new Error('Постачальник не знайдений');
    }

    // Validate updates
    const validUpdates = updates.filter(u => u.sku && typeof u.stock === 'number');

    if (validUpdates.length === 0) {
      throw new Error('Немає валідних оновлень');
    }

    // Update last sync time
    feed.lastSync = new Date();
    feed.lastSyncStatus = 'success';
    this.feeds.set(supplierId, feed);

    // Process updates (would typically update database here)
    console.log(`Webhook received ${validUpdates.length} stock updates for supplier ${supplierId}`);
  }

  /**
   * Fetch feed content from URL
   * Завантажити вміст фіду з URL
   */
  private async fetchFeed(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Get nested value from object using dot notation
   * Отримати вкладене значення з об'єкта
   */
  private getNestedValue(obj: any, path: string): string {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return '';
      }
    }

    return String(value || '');
  }

  /**
   * Validate URL
   * Перевірити URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all feeds
   * Отримати всі фіди
   */
  getAllFeeds(): StockFeed[] {
    return Array.from(this.feeds.values());
  }

  /**
   * Get feeds by status
   * Отримати фіди за статусом
   */
  getFeedsByStatus(status: 'success' | 'error'): StockFeed[] {
    return Array.from(this.feeds.values()).filter(f => f.lastSyncStatus === status);
  }
}

// Default export
export default StockSyncService;
