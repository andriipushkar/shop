'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface RecentlyViewedItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  viewedAt: string;
}

interface RecentlyViewedContextType {
  items: RecentlyViewedItem[];
  addToRecentlyViewed: (item: Omit<RecentlyViewedItem, 'viewedAt'>) => void;
  removeFromRecentlyViewed: (productId: string) => void;
  clearRecentlyViewed: () => void;
  totalItems: number;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType | undefined>(undefined);

const RECENTLY_VIEWED_STORAGE_KEY = 'shop_recently_viewed';
const MAX_RECENTLY_VIEWED = 20;

export function RecentlyViewedProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        setItems([]);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when items change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isInitialized]);

  const addToRecentlyViewed = useCallback((item: Omit<RecentlyViewedItem, 'viewedAt'>) => {
    setItems(prev => {
      // Remove if already exists
      const filtered = prev.filter(i => i.productId !== item.productId);
      // Add to beginning and limit to MAX
      return [{ ...item, viewedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
    });
  }, []);

  const removeFromRecentlyViewed = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <RecentlyViewedContext.Provider
      value={{
        items,
        addToRecentlyViewed,
        removeFromRecentlyViewed,
        clearRecentlyViewed,
        totalItems: items.length,
      }}
    >
      {children}
    </RecentlyViewedContext.Provider>
  );
}

export function useRecentlyViewed() {
  const context = useContext(RecentlyViewedContext);
  if (context === undefined) {
    throw new Error('useRecentlyViewed must be used within a RecentlyViewedProvider');
  }
  return context;
}
