import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { RecentlyViewedProvider, useRecentlyViewed, RecentlyViewedItem } from '@/lib/recently-viewed-context';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

const mockItem: Omit<RecentlyViewedItem, 'viewedAt'> = {
  productId: 'prod-1',
  name: 'Test Product',
  price: 1999,
  image: '/test.jpg',
};

const mockItem2: Omit<RecentlyViewedItem, 'viewedAt'> = {
  productId: 'prod-2',
  name: 'Test Product 2',
  price: 2999,
  image: '/test2.jpg',
};

// Test component to access recently viewed context
function TestComponent() {
  const recentlyViewed = useRecentlyViewed();

  return (
    <div>
      <span data-testid="total-items">{recentlyViewed.totalItems}</span>
      <span data-testid="item-ids">{recentlyViewed.items.map(i => i.productId).join(',')}</span>
      <button onClick={() => recentlyViewed.addToRecentlyViewed(mockItem)}>View Item 1</button>
      <button onClick={() => recentlyViewed.addToRecentlyViewed(mockItem2)}>View Item 2</button>
      <button onClick={() => recentlyViewed.removeFromRecentlyViewed('prod-1')}>Remove Item 1</button>
      <button onClick={() => recentlyViewed.clearRecentlyViewed()}>Clear</button>
    </div>
  );
}

describe('RecentlyViewedContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('should throw error when useRecentlyViewed is used outside RecentlyViewedProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useRecentlyViewed must be used within a RecentlyViewedProvider');

    consoleSpy.mockRestore();
  });

  it('should provide initial empty state', async () => {
    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('0');
    });
  });

  it('should restore items from localStorage on mount', async () => {
    const storedItems: RecentlyViewedItem[] = [
      { productId: 'prod-1', name: 'Stored Product', price: 999, viewedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Stored Product 2', price: 1999, viewedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('2');
    });
  });
});

describe('Recently Viewed Actions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should add item to recently viewed', async () => {
    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('0');
    });

    const viewButton = screen.getByText('View Item 1');
    await act(async () => {
      viewButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-1');
  });

  it('should move existing item to beginning when viewed again', async () => {
    const storedItems: RecentlyViewedItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, viewedAt: new Date('2024-01-01').toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, viewedAt: new Date('2024-01-02').toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-1,prod-2');
    });

    // View item 1 again
    const viewButton = screen.getByText('View Item 1');
    await act(async () => {
      viewButton.click();
    });

    // Item 1 should be first now (most recently viewed)
    await waitFor(() => {
      expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-1,prod-2');
    });
    expect(screen.getByTestId('total-items')).toHaveTextContent('2');
  });

  it('should limit to 20 items maximum', async () => {
    // Create 19 existing items
    const storedItems: RecentlyViewedItem[] = Array.from({ length: 19 }, (_, i) => ({
      productId: `prod-${i + 3}`,
      name: `Product ${i + 3}`,
      price: 1000 * (i + 3),
      viewedAt: new Date(Date.now() - i * 1000).toISOString(),
    }));
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('19');
    });

    // Add 2 more items
    const viewButton1 = screen.getByText('View Item 1');
    const viewButton2 = screen.getByText('View Item 2');

    await act(async () => {
      viewButton1.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('20');
    });

    await act(async () => {
      viewButton2.click();
    });

    // Should still be 20 (max limit)
    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('20');
    });

    // Newest items should be first
    expect(screen.getByTestId('item-ids').textContent?.startsWith('prod-2,prod-1')).toBe(true);
  });

  it('should remove item from recently viewed', async () => {
    const storedItems: RecentlyViewedItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, viewedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, viewedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('2');
    });

    const removeButton = screen.getByText('Remove Item 1');
    await act(async () => {
      removeButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-2');
  });

  it('should clear recently viewed', async () => {
    const storedItems: RecentlyViewedItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, viewedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, viewedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('2');
    });

    const clearButton = screen.getByText('Clear');
    await act(async () => {
      clearButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('0');
    });
  });

  it('should persist to localStorage', async () => {
    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    const viewButton = screen.getByText('View Item 1');
    await act(async () => {
      viewButton.click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'shop_recently_viewed',
        expect.stringContaining('prod-1')
      );
    });
  });

  it('should maintain order (most recent first)', async () => {
    render(
      <RecentlyViewedProvider>
        <TestComponent />
      </RecentlyViewedProvider>
    );

    const viewButton1 = screen.getByText('View Item 1');
    const viewButton2 = screen.getByText('View Item 2');

    await act(async () => {
      viewButton1.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });

    await act(async () => {
      viewButton2.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('2');
    });

    // Most recently viewed (prod-2) should be first
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-2,prod-1');
  });
});
