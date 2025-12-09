import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { CartProvider, useCart, CartItem } from '@/lib/cart-context';
import { Product } from '@/lib/api';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  price: 1999,
  sku: 'SKU-001',
  stock: 10,
  image_url: '/test.jpg',
};

// Test component to access cart context
function TestComponent({
  onCartChange,
}: {
  onCartChange?: (cart: ReturnType<typeof useCart>) => void;
}) {
  const cart = useCart();

  React.useEffect(() => {
    if (onCartChange) {
      onCartChange(cart);
    }
  }, [cart, onCartChange]);

  return (
    <div>
      <span data-testid="item-count">{cart.totalItems}</span>
      <span data-testid="total-price">{cart.totalPrice}</span>
      <span data-testid="user-id">{cart.userId}</span>
      <span data-testid="loading">{cart.isLoading ? 'loading' : 'ready'}</span>
      <button onClick={() => cart.addToCart(mockProduct)}>Add to Cart</button>
      <button onClick={() => cart.removeFromCart('prod-1')}>Remove</button>
      <button onClick={() => cart.updateQuantity('prod-1', 5)}>Update Qty</button>
      <button onClick={() => cart.clearCart()}>Clear</button>
      <button onClick={() => cart.refreshCart()}>Refresh</button>
    </div>
  );
}

describe('CartContext', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('should throw error when useCart is used outside CartProvider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useCart must be used within a CartProvider');

    consoleSpy.mockRestore();
  });

  it('should provide initial cart state', async () => {
    mockLocalStorage.getItem.mockReturnValue('12345');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('total-price')).toHaveTextContent('0');
  });

  it('should generate userId if not present in localStorage', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'userId',
        expect.any(String)
      );
    });
  });

  it('should load cart from API', async () => {
    mockLocalStorage.getItem.mockReturnValue('12345');
    const mockCart = [
      {
        product_id: 'prod-1',
        name: 'Test Product',
        price: 999,
        quantity: 2,
        image_url: '/test.jpg',
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
    });
  });

  it('should handle API error when loading cart', async () => {
    mockLocalStorage.getItem.mockReturnValue('12345');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should calculate totals correctly', async () => {
    mockLocalStorage.getItem.mockReturnValue('12345');
    const mockCart = [
      { product_id: 'prod-1', name: 'Product 1', price: 100, quantity: 2 },
      { product_id: 'prod-2', name: 'Product 2', price: 50, quantity: 3 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('5'); // 2 + 3
      expect(screen.getByTestId('total-price')).toHaveTextContent('350'); // 100*2 + 50*3
    });
  });
});

describe('Cart Actions', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue('12345');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it('should add item to cart', async () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    const addButton = screen.getByText('Add to Cart');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });
  });

  it('should increment quantity when adding existing item', async () => {
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    mockFetch.mockResolvedValue({ ok: true });

    const addButton = screen.getByText('Add to Cart');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
    });
  });

  it('should remove item from cart', async () => {
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    mockFetch.mockResolvedValue({ ok: true });

    const removeButton = screen.getByText('Remove');
    await act(async () => {
      removeButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
  });

  it('should update item quantity', async () => {
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    mockFetch.mockResolvedValue({ ok: true });

    const updateButton = screen.getByText('Update Qty');
    await act(async () => {
      updateButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('5');
    });
  });

  it('should clear cart', async () => {
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 3 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('3');
    });

    mockFetch.mockResolvedValue({ ok: true });

    const clearButton = screen.getByText('Clear');
    await act(async () => {
      clearButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
  });

  it('should handle add to cart API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });

    // Make the POST request fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const addButton = screen.getByText('Add to Cart');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error adding to cart:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should handle remove from cart API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    // Make the DELETE request fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const removeButton = screen.getByText('Remove');
    await act(async () => {
      removeButton.click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error removing from cart:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should handle update quantity API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    // Make the PATCH request fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const updateButton = screen.getByText('Update Qty');
    await act(async () => {
      updateButton.click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating quantity:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should handle clear cart API error', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 3 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('3');
    });

    // Make the DELETE request fail
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const clearButton = screen.getByText('Clear');
    await act(async () => {
      clearButton.click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error clearing cart:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should remove item when updating quantity to 0', async () => {
    const mockCart = [
      { product_id: 'prod-1', name: 'Test Product', price: 1999, quantity: 1 },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockCart),
    });

    // Create a test component with updateQuantity to 0
    function TestComponentWithZeroUpdate() {
      const cart = useCart();
      return (
        <div>
          <span data-testid="item-count">{cart.totalItems}</span>
          <button onClick={() => cart.updateQuantity('prod-1', 0)}>Set Zero</button>
        </div>
      );
    }

    render(
      <CartProvider>
        <TestComponentWithZeroUpdate />
      </CartProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    mockFetch.mockResolvedValue({ ok: true });

    const zeroButton = screen.getByText('Set Zero');
    await act(async () => {
      zeroButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
  });

  it('should not perform actions when userId is not set', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    // Track the number of fetch calls
    mockFetch.mockClear();

    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
  });
});
