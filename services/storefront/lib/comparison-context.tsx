'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface ComparisonItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  addedAt: string;
}

interface ComparisonContextType {
  items: ComparisonItem[];
  addToComparison: (item: Omit<ComparisonItem, 'addedAt'>) => boolean;
  removeFromComparison: (productId: string) => void;
  isInComparison: (productId: string) => boolean;
  toggleComparison: (item: Omit<ComparisonItem, 'addedAt'>) => boolean;
  clearComparison: () => void;
  itemCount: number;
  maxItems: number;
  canAdd: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

const COMPARISON_STORAGE_KEY = 'shop_comparison';
const MAX_COMPARISON_ITEMS = 4;

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(COMPARISON_STORAGE_KEY);
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
      localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(items));
    }
  }, [items, isInitialized]);

  const addToComparison = useCallback((item: Omit<ComparisonItem, 'addedAt'>): boolean => {
    if (items.length >= MAX_COMPARISON_ITEMS) {
      return false;
    }
    if (items.some(i => i.productId === item.productId)) {
      return true; // Already in list
    }
    setItems(prev => [...prev, { ...item, addedAt: new Date().toISOString() }]);
    return true;
  }, [items]);

  const removeFromComparison = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const isInComparison = useCallback((productId: string) => {
    return items.some(item => item.productId === productId);
  }, [items]);

  const toggleComparison = useCallback((item: Omit<ComparisonItem, 'addedAt'>): boolean => {
    if (isInComparison(item.productId)) {
      removeFromComparison(item.productId);
      return true;
    } else {
      return addToComparison(item);
    }
  }, [isInComparison, addToComparison, removeFromComparison]);

  const clearComparison = useCallback(() => {
    setItems([]);
  }, []);

  return (
    <ComparisonContext.Provider
      value={{
        items,
        addToComparison,
        removeFromComparison,
        isInComparison,
        toggleComparison,
        clearComparison,
        itemCount: items.length,
        maxItems: MAX_COMPARISON_ITEMS,
        canAdd: items.length < MAX_COMPARISON_ITEMS,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
}
