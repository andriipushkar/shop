/**
 * Unit tests for Comparison Service
 */

import {
  ComparisonService,
  comparisonService,
  ComparisonProduct,
} from '@/lib/comparison/comparison-service';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ComparisonService', () => {
  let service: ComparisonService;

  const mockProduct1: ComparisonProduct = {
    id: 'prod-1',
    name: 'Смартфон Samsung Galaxy S23',
    price: 25000,
    sku: 'SAM-S23-001',
    stock: 10,
    image_url: '/images/samsung-s23.jpg',
    category: { id: 'cat-1-1', name: 'Смартфони' },
    brand: 'Samsung',
    rating: 4.5,
    reviewCount: 120,
    attributes: {
      screen_size: 6.1,
      processor: 'Snapdragon 8 Gen 2',
      ram: 8,
      storage: 256,
      camera_main: 50,
      '5g_support': true,
    },
  };

  const mockProduct2: ComparisonProduct = {
    id: 'prod-2',
    name: 'Смартфон iPhone 15',
    price: 35000,
    sku: 'APL-IP15-001',
    stock: 5,
    image_url: '/images/iphone-15.jpg',
    category: { id: 'cat-1-1', name: 'Смартфони' },
    brand: 'Apple',
    rating: 4.8,
    reviewCount: 200,
    attributes: {
      screen_size: 6.1,
      processor: 'A16 Bionic',
      ram: 6,
      storage: 128,
      camera_main: 48,
      '5g_support': true,
    },
  };

  const mockProduct3: ComparisonProduct = {
    id: 'prod-3',
    name: 'Смартфон Xiaomi 13 Pro',
    price: 22000,
    sku: 'XIA-13P-001',
    stock: 8,
    image_url: '/images/xiaomi-13.jpg',
    category: { id: 'cat-1-1', name: 'Смартфони' },
    brand: 'Xiaomi',
    rating: 4.3,
    reviewCount: 85,
    attributes: {
      screen_size: 6.73,
      processor: 'Snapdragon 8 Gen 2',
      ram: 12,
      storage: 256,
      camera_main: 50,
      '5g_support': true,
    },
  };

  const mockProduct4: ComparisonProduct = {
    id: 'prod-4',
    name: 'Смартфон Google Pixel 8',
    price: 28000,
    sku: 'GOO-PIX8-001',
    stock: 6,
    category: { id: 'cat-1-1', name: 'Смартфони' },
    brand: 'Google',
    rating: 4.6,
    reviewCount: 95,
  };

  const mockProduct5: ComparisonProduct = {
    id: 'prod-5',
    name: 'Смартфон OnePlus 11',
    price: 24000,
    sku: 'ONP-11-001',
    stock: 12,
    category: { id: 'cat-1-1', name: 'Смартфони' },
    brand: 'OnePlus',
    rating: 4.4,
    reviewCount: 70,
  };

  const mockProductDifferentCategory: ComparisonProduct = {
    id: 'prod-laptop',
    name: 'Ноутбук Dell XPS 15',
    price: 45000,
    sku: 'DEL-XPS15-001',
    stock: 3,
    category: { id: 'cat-1-3', name: 'Ноутбуки' },
    brand: 'Dell',
  };

  beforeEach(() => {
    localStorageMock.clear();
    service = ComparisonService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ComparisonService.getInstance();
      const instance2 = ComparisonService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('addProduct', () => {
    it('should add a product successfully', () => {
      const result = service.addProduct(mockProduct1);
      expect(result.success).toBe(true);
      expect(service.getCount()).toBe(1);
    });

    it('should not add duplicate product', () => {
      service.addProduct(mockProduct1);
      const result = service.addProduct(mockProduct1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('вже доданий');
      expect(service.getCount()).toBe(1);
    });

    it('should not add more than 4 products', () => {
      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);
      service.addProduct(mockProduct3);
      service.addProduct(mockProduct4);

      const result = service.addProduct(mockProduct5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('максимум');
      expect(service.getCount()).toBe(4);
    });

    it('should not add product from different category', () => {
      service.addProduct(mockProduct1);
      const result = service.addProduct(mockProductDifferentCategory);
      expect(result.success).toBe(false);
      expect(result.error).toContain('однієї категорії');
    });

    it('should persist to localStorage', () => {
      service.addProduct(mockProduct1);
      const stored = localStorageMock.getItem('shop_comparison');
      expect(stored).toBeTruthy();

      const state = JSON.parse(stored!);
      expect(state.products).toHaveLength(1);
      expect(state.products[0].id).toBe('prod-1');
    });
  });

  describe('removeProduct', () => {
    it('should remove product successfully', () => {
      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);
      expect(service.getCount()).toBe(2);

      service.removeProduct('prod-1');
      expect(service.getCount()).toBe(1);
      expect(service.isInComparison('prod-1')).toBe(false);
      expect(service.isInComparison('prod-2')).toBe(true);
    });

    it('should update localStorage after removal', () => {
      service.addProduct(mockProduct1);
      service.removeProduct('prod-1');

      const stored = localStorageMock.getItem('shop_comparison');
      const state = JSON.parse(stored!);
      expect(state.products).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all products', () => {
      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);
      service.addProduct(mockProduct3);

      service.clear();
      expect(service.getCount()).toBe(0);
      expect(service.getProducts()).toHaveLength(0);
    });

    it('should remove from localStorage', () => {
      service.addProduct(mockProduct1);
      service.clear();

      const stored = localStorageMock.getItem('shop_comparison');
      expect(stored).toBeNull();
    });
  });

  describe('isInComparison', () => {
    it('should return true for added product', () => {
      service.addProduct(mockProduct1);
      expect(service.isInComparison('prod-1')).toBe(true);
    });

    it('should return false for not added product', () => {
      expect(service.isInComparison('prod-999')).toBe(false);
    });
  });

  describe('getCount and canAddMore', () => {
    it('should return correct count', () => {
      expect(service.getCount()).toBe(0);
      service.addProduct(mockProduct1);
      expect(service.getCount()).toBe(1);
      service.addProduct(mockProduct2);
      expect(service.getCount()).toBe(2);
    });

    it('should correctly report canAddMore', () => {
      expect(service.canAddMore()).toBe(true);

      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);
      service.addProduct(mockProduct3);
      expect(service.canAddMore()).toBe(true);

      service.addProduct(mockProduct4);
      expect(service.canAddMore()).toBe(false);
    });
  });

  describe('getProducts', () => {
    it('should return all products', () => {
      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);

      const products = service.getProducts();
      expect(products).toHaveLength(2);
      expect(products[0].id).toBe('prod-1');
      expect(products[1].id).toBe('prod-2');
    });

    it('should return empty array when no products', () => {
      const products = service.getProducts();
      expect(products).toHaveLength(0);
    });
  });

  describe('getComparableAttributes', () => {
    it('should extract standard attributes', () => {
      const products = [mockProduct1, mockProduct2];
      const attributes = service.getComparableAttributes(products);

      expect(attributes.length).toBeGreaterThan(0);

      const priceAttr = attributes.find(a => a.key === 'price');
      expect(priceAttr).toBeDefined();
      expect(priceAttr?.values).toEqual([25000, 35000]);
      expect(priceAttr?.hasDifference).toBe(true);
    });

    it('should extract EAV attributes', () => {
      const products = [mockProduct1, mockProduct2];
      const attributes = service.getComparableAttributes(products);

      const screenAttr = attributes.find(a => a.key === 'attr_screen_size');
      expect(screenAttr).toBeDefined();
      expect(screenAttr?.values).toEqual([6.1, 6.1]);
      expect(screenAttr?.hasDifference).toBe(false);

      const ramAttr = attributes.find(a => a.key === 'attr_ram');
      expect(ramAttr).toBeDefined();
      expect(ramAttr?.values).toEqual([8, 6]);
      expect(ramAttr?.hasDifference).toBe(true);
    });

    it('should handle missing attributes', () => {
      const products = [mockProduct1, mockProduct4]; // mockProduct4 has no attributes
      const attributes = service.getComparableAttributes(products);

      const screenAttr = attributes.find(a => a.key === 'attr_screen_size');
      expect(screenAttr?.values[0]).toBe(6.1);
      expect(screenAttr?.values[1]).toBeNull();
    });

    it('should identify differences correctly', () => {
      const products = [mockProduct1, mockProduct2, mockProduct3];
      const attributes = service.getComparableAttributes(products);

      const brandAttr = attributes.find(a => a.key === 'brand');
      expect(brandAttr?.hasDifference).toBe(true);

      const screenAttr = attributes.find(a => a.key === 'attr_screen_size');
      expect(screenAttr?.hasDifference).toBe(true); // 6.1, 6.1, 6.73
    });

    it('should return empty array for no products', () => {
      const attributes = service.getComparableAttributes([]);
      expect(attributes).toHaveLength(0);
    });
  });

  describe('getShareableUrl', () => {
    it('should generate shareable URL', () => {
      service.addProduct(mockProduct1);
      service.addProduct(mockProduct2);

      const url = service.getShareableUrl();
      expect(url).toContain('/compare?ids=');
      expect(url).toContain('prod-1');
      expect(url).toContain('prod-2');
    });

    it('should return empty string when no products', () => {
      const url = service.getShareableUrl();
      expect(url).toBe('');
    });
  });

  describe('Event Subscription', () => {
    it('should notify listeners on state changes', () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      service.addProduct(mockProduct1);
      expect(listener).toHaveBeenCalledTimes(1);

      service.addProduct(mockProduct2);
      expect(listener).toHaveBeenCalledTimes(2);

      service.removeProduct('prod-1');
      expect(listener).toHaveBeenCalledTimes(3);

      unsubscribe();
    });

    it('should allow unsubscribing', () => {
      const listener = jest.fn();
      const unsubscribe = service.subscribe(listener);

      service.addProduct(mockProduct1);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      service.addProduct(mockProduct2);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);

      service.addProduct(mockProduct1);

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Persistence', () => {
    it('should persist category ID', () => {
      service.addProduct(mockProduct1);

      const state = service.getState();
      expect(state?.categoryId).toBe('cat-1-1');
    });

    it('should persist lastUpdated timestamp', () => {
      service.addProduct(mockProduct1);

      const state = service.getState();
      expect(state?.lastUpdated).toBeTruthy();
      expect(new Date(state!.lastUpdated).getTime()).toBeLessThanOrEqual(
        Date.now()
      );
    });

    it('should load state from localStorage', () => {
      // Manually set localStorage
      const mockState = {
        products: [mockProduct1, mockProduct2],
        categoryId: 'cat-1-1',
        lastUpdated: new Date().toISOString(),
      };
      localStorageMock.setItem('shop_comparison', JSON.stringify(mockState));

      const state = service.getState();
      expect(state?.products).toHaveLength(2);
      expect(state?.categoryId).toBe('cat-1-1');
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.setItem('shop_comparison', 'invalid json');

      const state = service.getState();
      expect(state).toBeNull();
    });
  });
});
