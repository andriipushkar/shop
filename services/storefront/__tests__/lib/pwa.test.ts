/**
 * PWA Utilities Tests
 */

import {
  isPWAInstalled,
  isInBrowser,
  isPWAInstallSupported,
  isServiceWorkerSupported,
  isOnline,
  isOffline,
  getConnectionType,
  isSlowConnection,
  isFastConnection,
  isIOS,
  isAndroid,
  getPlatform,
  formatStorageSize,
} from '@/lib/pwa/pwa-utils';

// Mock window and navigator
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

describe('PWA Utilities', () => {
  describe('isPWAInstalled', () => {
    it('should return true when running in standalone mode', () => {
      mockMatchMedia(true);
      expect(isPWAInstalled()).toBe(true);
    });

    it('should return false when not in standalone mode', () => {
      mockMatchMedia(false);
      expect(isPWAInstalled()).toBe(false);
    });

    it('should return true for iOS standalone', () => {
      mockMatchMedia(false);
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        value: true,
      });
      expect(isPWAInstalled()).toBe(true);
    });
  });

  describe('isInBrowser', () => {
    it('should return false when PWA is installed (standalone)', () => {
      mockMatchMedia(true);
      expect(isInBrowser()).toBe(false);
    });

    it('should return true when running in browser', () => {
      mockMatchMedia(false);
      // Reset iOS standalone
      Object.defineProperty(window.navigator, 'standalone', {
        writable: true,
        value: undefined,
      });
      expect(isInBrowser()).toBe(true);
    });
  });

  describe('isPWAInstallSupported', () => {
    it('should return true when beforeinstallprompt is supported', () => {
      (window as any).BeforeInstallPromptEvent = class {};
      expect(isPWAInstallSupported()).toBe(true);
    });

    it('should return true when onbeforeinstallprompt is in window', () => {
      (window as any).onbeforeinstallprompt = {};
      expect(isPWAInstallSupported()).toBe(true);
    });
  });

  describe('isServiceWorkerSupported', () => {
    it('should return false when service worker is not available', () => {
      // Service worker is NOT supported in JSDOM by default
      expect(isServiceWorkerSupported()).toBe(false);
    });

    it('should return true when service worker is available', () => {
      // Mock serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        writable: true,
        value: {},
      });
      expect(isServiceWorkerSupported()).toBe(true);
    });

    it('should detect service worker availability', () => {
      const result = isServiceWorkerSupported();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isOnline and isOffline', () => {
    it('should return true when navigator.onLine is true', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      expect(isOnline()).toBe(true);
      expect(isOffline()).toBe(false);
    });

    it('should return false when navigator.onLine is false', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      expect(isOnline()).toBe(false);
      expect(isOffline()).toBe(true);
    });
  });

  describe('getConnectionType', () => {
    it('should return connection type when available', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '4g',
        },
      });
      expect(getConnectionType()).toBe('4g');
    });

    it('should return unknown when connection is not available', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: undefined,
      });
      expect(getConnectionType()).toBe('unknown');
    });
  });

  describe('isSlowConnection', () => {
    it('should return true for slow-2g connection', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: 'slow-2g',
        },
      });
      expect(isSlowConnection()).toBe(true);
    });

    it('should return true for 2g connection', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '2g',
        },
      });
      expect(isSlowConnection()).toBe(true);
    });

    it('should return false for 4g connection', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '4g',
        },
      });
      expect(isSlowConnection()).toBe(false);
    });
  });

  describe('isFastConnection', () => {
    it('should return true for 4g connection', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '4g',
        },
      });
      expect(isFastConnection()).toBe(true);
    });

    it('should return false for 3g connection', () => {
      Object.defineProperty(navigator, 'connection', {
        writable: true,
        value: {
          effectiveType: '3g',
        },
      });
      expect(isFastConnection()).toBe(false);
    });
  });

  describe('isIOS', () => {
    it('should return true for iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
      });
      expect(isIOS()).toBe(true);
    });

    it('should return true for iPad', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)',
      });
      expect(isIOS()).toBe(true);
    });

    it('should return false for Android', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Linux; Android 10)',
      });
      expect(isIOS()).toBe(false);
    });
  });

  describe('isAndroid', () => {
    it('should return true for Android', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Linux; Android 10)',
      });
      expect(isAndroid()).toBe(true);
    });

    it('should return false for iOS', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
      });
      expect(isAndroid()).toBe(false);
    });
  });

  describe('getPlatform', () => {
    it('should return ios for iOS devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
      });
      expect(getPlatform()).toBe('ios');
    });

    it('should return android for Android devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Linux; Android 10)',
      });
      expect(getPlatform()).toBe('android');
    });

    it('should return desktop for desktop browsers', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      });
      expect(getPlatform()).toBe('desktop');
    });
  });

  describe('formatStorageSize', () => {
    it('should format bytes correctly', () => {
      expect(formatStorageSize(0)).toBe('0 B');
      expect(formatStorageSize(1024)).toBe('1 KB');
      expect(formatStorageSize(1024 * 1024)).toBe('1 MB');
      expect(formatStorageSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
      expect(formatStorageSize(1536)).toBe('1.5 KB');
      expect(formatStorageSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });
  });

  describe('addNetworkListener', () => {
    it('should add online/offline event listeners', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const callback = jest.fn();

      const cleanup = require('@/lib/pwa/pwa-utils').addNetworkListener(callback);

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      cleanup();
    });

    it('should call callback when online event fires', () => {
      const callback = jest.fn();
      const cleanup = require('@/lib/pwa/pwa-utils').addNetworkListener(callback);

      window.dispatchEvent(new Event('online'));

      expect(callback).toHaveBeenCalledWith(true);

      cleanup();
    });

    it('should call callback when offline event fires', () => {
      const callback = jest.fn();
      const cleanup = require('@/lib/pwa/pwa-utils').addNetworkListener(callback);

      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith(false);

      cleanup();
    });
  });
});

// Offline Storage Tests
// Note: IndexedDB is not available in standard JSDOM environment
// These tests are skipped - to enable, install fake-indexeddb and import 'fake-indexeddb/auto'

describe.skip('Offline Storage', () => {
  // These tests require fake-indexeddb package to be installed
  // npm install --save-dev fake-indexeddb
  // Then import 'fake-indexeddb/auto' at the top of this file
  let productStorage: any;
  let cartStorage: any;
  let categoryStorage: any;
  let syncQueueStorage: any;
  let recentlyViewedStorage: any;

  beforeAll(async () => {
    if (!hasIndexedDB) {
      console.warn('IndexedDB not available - skipping Offline Storage tests');
      return;
    }
    const storage = await import('@/lib/pwa/offline-storage');
    productStorage = storage.productStorage;
    cartStorage = storage.cartStorage;
    categoryStorage = storage.categoryStorage;
    syncQueueStorage = storage.syncQueueStorage;
    recentlyViewedStorage = storage.recentlyViewedStorage;
  });

  beforeEach(async () => {
    if (!hasIndexedDB) return;
    // Clear all stores before each test
    await productStorage.clear();
    await cartStorage.clear();
    await categoryStorage.clear();
    await syncQueueStorage.clear();
    await recentlyViewedStorage.clear();
  });

  describe('Product Storage', () => {
    it('should save and retrieve a product', async () => {
      const product = {
        id: '1',
        name: 'Test Product',
        price: 100,
        category: 'electronics',
      };

      await productStorage.save(product);
      const retrieved = await productStorage.get('1');

      expect(retrieved).toEqual(product);
    });

    it('should save multiple products', async () => {
      const products = [
        { id: '1', name: 'Product 1', price: 100, category: 'electronics' },
        { id: '2', name: 'Product 2', price: 200, category: 'electronics' },
      ];

      await productStorage.saveMany(products);
      const all = await productStorage.getAll();

      expect(all).toHaveLength(2);
    });

    it('should get products by category', async () => {
      const products = [
        { id: '1', name: 'Product 1', price: 100, category: 'electronics' },
        { id: '2', name: 'Product 2', price: 200, category: 'clothing' },
        { id: '3', name: 'Product 3', price: 300, category: 'electronics' },
      ];

      await productStorage.saveMany(products);
      const electronics = await productStorage.getByCategory('electronics');

      expect(electronics).toHaveLength(2);
      expect(electronics.every(p => p.category === 'electronics')).toBe(true);
    });

    it('should delete a product', async () => {
      const product = { id: '1', name: 'Test Product', price: 100 };

      await productStorage.save(product);
      await productStorage.delete('1');
      const retrieved = await productStorage.get('1');

      expect(retrieved).toBeNull();
    });
  });

  describe('Cart Storage', () => {
    it('should save and retrieve cart items', async () => {
      const cartItem = {
        id: '1',
        productId: 'p1',
        quantity: 2,
        price: 100,
        name: 'Test Product',
      };

      await cartStorage.save(cartItem);
      const retrieved = await cartStorage.get('1');

      expect(retrieved).toEqual(cartItem);
    });

    it('should update cart item quantity', async () => {
      const cartItem = {
        id: '1',
        productId: 'p1',
        quantity: 2,
        price: 100,
        name: 'Test Product',
      };

      await cartStorage.save(cartItem);
      await cartStorage.updateQuantity('1', 5);
      const retrieved = await cartStorage.get('1');

      expect(retrieved?.quantity).toBe(5);
    });

    it('should clear cart', async () => {
      const cartItem = {
        id: '1',
        productId: 'p1',
        quantity: 2,
        price: 100,
        name: 'Test Product',
      };

      await cartStorage.save(cartItem);
      await cartStorage.clear();
      const all = await cartStorage.getAll();

      expect(all).toHaveLength(0);
    });
  });

  describe('Sync Queue Storage', () => {
    it('should add items to sync queue', async () => {
      const queueItem = {
        type: 'cart' as const,
        url: '/api/cart',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: '1', quantity: 2 }),
      };

      await syncQueueStorage.add(queueItem);
      const all = await syncQueueStorage.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].type).toBe('cart');
    });

    it('should get items by type', async () => {
      await syncQueueStorage.add({
        type: 'cart' as const,
        url: '/api/cart',
        method: 'POST',
        headers: {},
      });

      await syncQueueStorage.add({
        type: 'order' as const,
        url: '/api/orders',
        method: 'POST',
        headers: {},
      });

      const cartItems = await syncQueueStorage.getByType('cart');

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].type).toBe('cart');
    });
  });

  describe('Recently Viewed Storage', () => {
    it('should add recently viewed products', async () => {
      const product = {
        id: '1',
        name: 'Test Product',
        price: 100,
      };

      await recentlyViewedStorage.add(product);
      const all = await recentlyViewedStorage.getAll();

      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('1');
    });

    it('should limit recently viewed products', async () => {
      for (let i = 1; i <= 15; i++) {
        await recentlyViewedStorage.add({
          id: `${i}`,
          name: `Product ${i}`,
          price: 100,
        });
      }

      const all = await recentlyViewedStorage.getAll(10);

      expect(all.length).toBeLessThanOrEqual(10);
    });
  });
});
