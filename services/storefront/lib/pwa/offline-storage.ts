/**
 * Offline Storage using IndexedDB
 * Store products, cart state, and other data for offline access
 */

const DB_NAME = 'TechShopDB';
const DB_VERSION = 1;

export interface DBStores {
  products: 'products';
  cart: 'cart';
  categories: 'categories';
  syncQueue: 'syncQueue';
  favorites: 'favorites';
  recentlyViewed: 'recentlyViewed';
}

export const STORES: DBStores = {
  products: 'products',
  cart: 'cart',
  categories: 'categories',
  syncQueue: 'syncQueue',
  favorites: 'favorites',
  recentlyViewed: 'recentlyViewed',
};

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
  inStock?: boolean;
  [key: string]: any;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;
  [key: string]: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  [key: string]: any;
}

export interface SyncQueueItem {
  id?: number;
  type: 'cart' | 'order' | 'favorite' | 'review';
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries?: number;
  [key: string]: any;
}

// Open database connection
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.products)) {
        const productStore = db.createObjectStore(STORES.products, { keyPath: 'id' });
        productStore.createIndex('category', 'category', { unique: false });
        productStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.cart)) {
        db.createObjectStore(STORES.cart, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.categories)) {
        const categoryStore = db.createObjectStore(STORES.categories, { keyPath: 'id' });
        categoryStore.createIndex('slug', 'slug', { unique: true });
      }

      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        const syncStore = db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('type', 'type', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.favorites)) {
        db.createObjectStore(STORES.favorites, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.recentlyViewed)) {
        const recentlyViewedStore = db.createObjectStore(STORES.recentlyViewed, { keyPath: 'id' });
        recentlyViewedStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Generic get operation
export async function get<T>(storeName: keyof DBStores, key: string): Promise<T | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get item from ${storeName}`));
      };
    });
  } catch (error) {
    console.error(`Error getting item from ${storeName}:`, error);
    return null;
  }
}

// Generic get all operation
export async function getAll<T>(storeName: keyof DBStores): Promise<T[]> {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all items from ${storeName}`));
      };
    });
  } catch (error) {
    console.error(`Error getting all items from ${storeName}:`, error);
    return [];
  }
}

// Generic set operation
export async function set<T>(storeName: keyof DBStores, value: T): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(value);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to set item in ${storeName}`));
      };
    });
  } catch (error) {
    console.error(`Error setting item in ${storeName}:`, error);
    throw error;
  }
}

// Generic delete operation
export async function del(storeName: keyof DBStores, key: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete item from ${storeName}`));
      };
    });
  } catch (error) {
    console.error(`Error deleting item from ${storeName}:`, error);
    throw error;
  }
}

// Clear store
export async function clear(storeName: keyof DBStores): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear ${storeName}`));
      };
    });
  } catch (error) {
    console.error(`Error clearing ${storeName}:`, error);
    throw error;
  }
}

// Product operations
export const productStorage = {
  async save(product: Product): Promise<void> {
    await set(STORES.products, product);
  },

  async saveMany(products: Product[]): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(STORES.products, 'readwrite');
    const store = transaction.objectStore(STORES.products);

    for (const product of products) {
      store.put(product);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to save products'));
    });
  },

  async get(id: string): Promise<Product | null> {
    return await get<Product>(STORES.products, id);
  },

  async getAll(): Promise<Product[]> {
    return await getAll<Product>(STORES.products);
  },

  async getByCategory(category: string): Promise<Product[]> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORES.products, 'readonly');
      const store = transaction.objectStore(STORES.products);
      const index = store.index('category');

      return new Promise((resolve, reject) => {
        const request = index.getAll(category);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(new Error('Failed to get products by category'));
        };
      });
    } catch (error) {
      console.error('Error getting products by category:', error);
      return [];
    }
  },

  async delete(id: string): Promise<void> {
    await del(STORES.products, id);
  },

  async clear(): Promise<void> {
    await clear(STORES.products);
  },
};

// Cart operations
export const cartStorage = {
  async save(item: CartItem): Promise<void> {
    await set(STORES.cart, item);
  },

  async get(id: string): Promise<CartItem | null> {
    return await get<CartItem>(STORES.cart, id);
  },

  async getAll(): Promise<CartItem[]> {
    return await getAll<CartItem>(STORES.cart);
  },

  async delete(id: string): Promise<void> {
    await del(STORES.cart, id);
  },

  async clear(): Promise<void> {
    await clear(STORES.cart);
  },

  async updateQuantity(id: string, quantity: number): Promise<void> {
    const item = await this.get(id);
    if (item) {
      item.quantity = quantity;
      await this.save(item);
    }
  },
};

// Category operations
export const categoryStorage = {
  async save(category: Category): Promise<void> {
    await set(STORES.categories, category);
  },

  async saveMany(categories: Category[]): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(STORES.categories, 'readwrite');
    const store = transaction.objectStore(STORES.categories);

    for (const category of categories) {
      store.put(category);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to save categories'));
    });
  },

  async get(id: string): Promise<Category | null> {
    return await get<Category>(STORES.categories, id);
  },

  async getAll(): Promise<Category[]> {
    return await getAll<Category>(STORES.categories);
  },

  async delete(id: string): Promise<void> {
    await del(STORES.categories, id);
  },

  async clear(): Promise<void> {
    await clear(STORES.categories);
  },
};

// Sync queue operations
export const syncQueueStorage = {
  async add(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    return new Promise((resolve, reject) => {
      const request = store.add({
        ...item,
        timestamp: Date.now(),
        retries: 0,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to add item to sync queue'));
    });
  },

  async getAll(): Promise<SyncQueueItem[]> {
    return await getAll<SyncQueueItem>(STORES.syncQueue);
  },

  async getByType(type: SyncQueueItem['type']): Promise<SyncQueueItem[]> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORES.syncQueue, 'readonly');
      const store = transaction.objectStore(STORES.syncQueue);
      const index = store.index('type');

      return new Promise((resolve, reject) => {
        const request = index.getAll(type);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(new Error('Failed to get sync queue items by type'));
        };
      });
    } catch (error) {
      console.error('Error getting sync queue items by type:', error);
      return [];
    }
  },

  async delete(id: number): Promise<void> {
    const db = await openDB();
    const transaction = db.transaction(STORES.syncQueue, 'readwrite');
    const store = transaction.objectStore(STORES.syncQueue);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete sync queue item'));
    });
  },

  async clear(): Promise<void> {
    await clear(STORES.syncQueue);
  },
};

// Recently viewed operations
export const recentlyViewedStorage = {
  async add(product: Product): Promise<void> {
    const item = {
      ...product,
      timestamp: Date.now(),
    };
    await set(STORES.recentlyViewed, item);
  },

  async getAll(limit = 10): Promise<Product[]> {
    try {
      const db = await openDB();
      const transaction = db.transaction(STORES.recentlyViewed, 'readonly');
      const store = transaction.objectStore(STORES.recentlyViewed);
      const index = store.index('timestamp');

      return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev');
        const results: Product[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor && results.length < limit) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => {
          reject(new Error('Failed to get recently viewed products'));
        };
      });
    } catch (error) {
      console.error('Error getting recently viewed products:', error);
      return [];
    }
  },

  async clear(): Promise<void> {
    await clear(STORES.recentlyViewed);
  },
};

// Sync data when online
export async function syncOfflineData(): Promise<void> {
  if (!navigator.onLine) {
    console.log('[Offline Storage] Device is offline, skipping sync');
    return;
  }

  const queueItems = await syncQueueStorage.getAll();

  for (const item of queueItems) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok) {
        await syncQueueStorage.delete(item.id!);
        console.log('[Offline Storage] Synced item:', item.id);
      } else {
        console.error('[Offline Storage] Failed to sync item:', item.id, response.status);
      }
    } catch (error) {
      console.error('[Offline Storage] Error syncing item:', item.id, error);
    }
  }
}

// Clear all offline data
export async function clearAllOfflineData(): Promise<void> {
  await productStorage.clear();
  await cartStorage.clear();
  await categoryStorage.clear();
  await syncQueueStorage.clear();
  await recentlyViewedStorage.clear();
  console.log('[Offline Storage] All offline data cleared');
}
