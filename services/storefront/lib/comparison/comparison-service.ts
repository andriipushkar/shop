/**
 * Product Comparison Service
 * Manages comparison logic with localStorage persistence
 */

import { Product } from '../api';

export interface ComparisonProduct extends Product {
  category?: {
    id: string;
    name: string;
  };
  attributes?: Record<string, string | number | boolean>;
  rating?: number;
  reviewCount?: number;
  brand?: string;
}

export interface ComparisonState {
  products: ComparisonProduct[];
  categoryId?: string;
  lastUpdated: string;
}

export interface ComparisonAttribute {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'rating';
  values: (string | number | boolean | null)[];
  hasDifference: boolean;
}

const STORAGE_KEY = 'shop_comparison';
const MAX_PRODUCTS = 4;

/**
 * Comparison Service Class
 */
export class ComparisonService {
  private static instance: ComparisonService;

  private constructor() {}

  static getInstance(): ComparisonService {
    if (!ComparisonService.instance) {
      ComparisonService.instance = new ComparisonService();
    }
    return ComparisonService.instance;
  }

  /**
   * Get current comparison state from localStorage
   */
  getState(): ComparisonState | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const state: ComparisonState = JSON.parse(stored);
      return state;
    } catch (error) {
      console.error('Error reading comparison state:', error);
      return null;
    }
  }

  /**
   * Save comparison state to localStorage
   */
  private saveState(state: ComparisonState): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      this.notifyListeners();
    } catch (error) {
      console.error('Error saving comparison state:', error);
    }
  }

  /**
   * Add product to comparison
   */
  addProduct(product: ComparisonProduct): {
    success: boolean;
    error?: string;
  } {
    const state = this.getState();
    const products = state?.products || [];

    // Check if already in comparison
    if (products.some(p => p.id === product.id)) {
      return { success: false, error: 'Товар вже доданий до порівняння' };
    }

    // Check max limit
    if (products.length >= MAX_PRODUCTS) {
      return {
        success: false,
        error: `Можна порівнювати максимум ${MAX_PRODUCTS} товари`,
      };
    }

    // Check category compatibility
    if (products.length > 0 && state?.categoryId) {
      if (product.category?.id !== state.categoryId) {
        return {
          success: false,
          error: 'Можна порівнювати тільки товари з однієї категорії',
        };
      }
    }

    const newState: ComparisonState = {
      products: [...products, product],
      categoryId: product.category?.id || state?.categoryId,
      lastUpdated: new Date().toISOString(),
    };

    this.saveState(newState);
    return { success: true };
  }

  /**
   * Remove product from comparison
   */
  removeProduct(productId: string): void {
    const state = this.getState();
    if (!state) return;

    const products = state.products.filter(p => p.id !== productId);

    const newState: ComparisonState = {
      products,
      categoryId: products.length > 0 ? state.categoryId : undefined,
      lastUpdated: new Date().toISOString(),
    };

    this.saveState(newState);
  }

  /**
   * Clear all products from comparison
   */
  clear(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Check if product is in comparison
   */
  isInComparison(productId: string): boolean {
    const state = this.getState();
    return state?.products.some(p => p.id === productId) || false;
  }

  /**
   * Get product count
   */
  getCount(): number {
    const state = this.getState();
    return state?.products.length || 0;
  }

  /**
   * Check if can add more products
   */
  canAddMore(): boolean {
    return this.getCount() < MAX_PRODUCTS;
  }

  /**
   * Get maximum products allowed
   */
  getMaxProducts(): number {
    return MAX_PRODUCTS;
  }

  /**
   * Get all products in comparison
   */
  getProducts(): ComparisonProduct[] {
    const state = this.getState();
    return state?.products || [];
  }

  /**
   * Extract comparable attributes from products
   */
  getComparableAttributes(products: ComparisonProduct[]): ComparisonAttribute[] {
    if (products.length === 0) return [];

    const attributes: ComparisonAttribute[] = [];

    // Standard attributes
    const standardAttrs = [
      { key: 'price', label: 'Ціна', type: 'number' as const },
      { key: 'brand', label: 'Бренд', type: 'text' as const },
      { key: 'rating', label: 'Рейтинг', type: 'rating' as const },
      { key: 'reviewCount', label: 'Кількість відгуків', type: 'number' as const },
      { key: 'stock', label: 'Наявність', type: 'number' as const },
    ];

    standardAttrs.forEach(attr => {
      const values = products.map(p => {
        const value = (p as any)[attr.key];
        return value !== undefined ? value : null;
      });

      const hasDifference = this.checkDifference(values);

      attributes.push({
        key: attr.key,
        label: attr.label,
        type: attr.type,
        values,
        hasDifference,
      });
    });

    // EAV attributes (from product.attributes)
    const eavKeys = new Set<string>();
    products.forEach(p => {
      if (p.attributes) {
        Object.keys(p.attributes).forEach(key => eavKeys.add(key));
      }
    });

    eavKeys.forEach(key => {
      const values = products.map(p => {
        const value = p.attributes?.[key];
        return value !== undefined ? value : null;
      });

      const hasDifference = this.checkDifference(values);

      // Determine type based on values
      const type = this.inferAttributeType(values);

      attributes.push({
        key: `attr_${key}`,
        label: this.formatAttributeLabel(key),
        type,
        values,
        hasDifference,
      });
    });

    return attributes;
  }

  /**
   * Check if values have differences
   */
  private checkDifference(values: (string | number | boolean | null)[]): boolean {
    const nonNullValues = values.filter(v => v !== null);
    if (nonNullValues.length <= 1) return false;

    const first = nonNullValues[0];
    return nonNullValues.some(v => v !== first);
  }

  /**
   * Infer attribute type from values
   */
  private inferAttributeType(
    values: (string | number | boolean | null)[]
  ): 'text' | 'number' | 'boolean' {
    const nonNullValues = values.filter(v => v !== null);
    if (nonNullValues.length === 0) return 'text';

    const firstValue = nonNullValues[0];

    if (typeof firstValue === 'boolean') return 'boolean';
    if (typeof firstValue === 'number') return 'number';
    return 'text';
  }

  /**
   * Format attribute label
   */
  private formatAttributeLabel(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Generate shareable comparison URL
   */
  getShareableUrl(): string {
    const state = this.getState();
    if (!state || state.products.length === 0) return '';

    const productIds = state.products.map(p => p.id).join(',');
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/compare?ids=${encodeURIComponent(productIds)}`;
  }

  /**
   * Load comparison from URL params
   */
  async loadFromUrl(productIds: string[]): Promise<ComparisonProduct[]> {
    // This would typically fetch products from API
    // For now, return empty array - implement based on your API
    return [];
  }

  // Event listeners for state changes
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Export singleton instance
export const comparisonService = ComparisonService.getInstance();
