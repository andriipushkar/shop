import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { WishlistProvider, useWishlist, WishlistItem } from '@/lib/wishlist-context';

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

const mockItem: Omit<WishlistItem, 'addedAt'> = {
  productId: 'prod-1',
  name: 'Test Product',
  price: 1999,
  image: '/test.jpg',
};

const mockItem2: Omit<WishlistItem, 'addedAt'> = {
  productId: 'prod-2',
  name: 'Test Product 2',
  price: 2999,
  image: '/test2.jpg',
};

// Test component to access wishlist context
function TestComponent() {
  const wishlist = useWishlist();

  return (
    <div>
      <span data-testid="total-items">{wishlist.totalItems}</span>
      <span data-testid="item-ids">{wishlist.items.map(i => i.productId).join(',')}</span>
      <span data-testid="is-in-wishlist">{wishlist.isInWishlist('prod-1') ? 'yes' : 'no'}</span>
      <button onClick={() => wishlist.addToWishlist(mockItem)}>Add Item 1</button>
      <button onClick={() => wishlist.addToWishlist(mockItem2)}>Add Item 2</button>
      <button onClick={() => wishlist.removeFromWishlist('prod-1')}>Remove Item 1</button>
      <button onClick={() => wishlist.toggleWishlist(mockItem)}>Toggle Item 1</button>
      <button onClick={() => wishlist.clearWishlist()}>Clear</button>
    </div>
  );
}

describe('WishlistContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('should throw error when useWishlist is used outside WishlistProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useWishlist must be used within a WishlistProvider');

    consoleSpy.mockRestore();
  });

  it('should provide initial empty wishlist state', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('no');
  });

  it('should restore wishlist from localStorage on mount', async () => {
    const storedItems: WishlistItem[] = [
      { productId: 'prod-1', name: 'Stored Product', price: 999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('yes');
  });
});

describe('Wishlist Actions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should add item to wishlist', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('0');
    });

    const addButton = screen.getByText('Add Item 1');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('yes');
  });

  it('should not add duplicate items', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    const addButton = screen.getByText('Add Item 1');

    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('1');
    });

    await act(async () => {
      addButton.click();
    });

    // Should still be 1
    expect(screen.getByTestId('total-items')).toHaveTextContent('1');
  });

  it('should add multiple different items', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    const addButton1 = screen.getByText('Add Item 1');
    const addButton2 = screen.getByText('Add Item 2');

    await act(async () => {
      addButton1.click();
    });

    await act(async () => {
      addButton2.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('total-items')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-1,prod-2');
  });

  it('should remove item from wishlist', async () => {
    const storedItems: WishlistItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
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
    expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('no');
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-2');
  });

  it('should toggle item in wishlist (add)', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('no');
    });

    const toggleButton = screen.getByText('Toggle Item 1');
    await act(async () => {
      toggleButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('yes');
    });
    expect(screen.getByTestId('total-items')).toHaveTextContent('1');
  });

  it('should toggle item in wishlist (remove)', async () => {
    const storedItems: WishlistItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('yes');
    });

    const toggleButton = screen.getByText('Toggle Item 1');
    await act(async () => {
      toggleButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-in-wishlist')).toHaveTextContent('no');
    });
    expect(screen.getByTestId('total-items')).toHaveTextContent('0');
  });

  it('should clear wishlist', async () => {
    const storedItems: WishlistItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
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

  it('should persist wishlist to localStorage', async () => {
    render(
      <WishlistProvider>
        <TestComponent />
      </WishlistProvider>
    );

    const addButton = screen.getByText('Add Item 1');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'shop_wishlist',
        expect.stringContaining('prod-1')
      );
    });
  });
});
