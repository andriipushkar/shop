import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ComparisonProvider, useComparison, ComparisonItem } from '@/lib/comparison-context';

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

const mockItem: Omit<ComparisonItem, 'addedAt'> = {
  productId: 'prod-1',
  name: 'Test Product',
  price: 1999,
  image: '/test.jpg',
};

const createMockItem = (id: number): Omit<ComparisonItem, 'addedAt'> => ({
  productId: `prod-${id}`,
  name: `Test Product ${id}`,
  price: 1000 * id,
  image: `/test${id}.jpg`,
});

// Test component to access comparison context
function TestComponent() {
  const comparison = useComparison();

  return (
    <div>
      <span data-testid="item-count">{comparison.itemCount}</span>
      <span data-testid="max-items">{comparison.maxItems}</span>
      <span data-testid="can-add">{comparison.canAdd ? 'yes' : 'no'}</span>
      <span data-testid="item-ids">{comparison.items.map(i => i.productId).join(',')}</span>
      <span data-testid="is-in-comparison">{comparison.isInComparison('prod-1') ? 'yes' : 'no'}</span>
      <button onClick={() => comparison.addToComparison(mockItem)}>Add Item 1</button>
      <button onClick={() => comparison.addToComparison(createMockItem(2))}>Add Item 2</button>
      <button onClick={() => comparison.addToComparison(createMockItem(3))}>Add Item 3</button>
      <button onClick={() => comparison.addToComparison(createMockItem(4))}>Add Item 4</button>
      <button onClick={() => comparison.addToComparison(createMockItem(5))}>Add Item 5</button>
      <button onClick={() => comparison.removeFromComparison('prod-1')}>Remove Item 1</button>
      <button onClick={() => comparison.toggleComparison(mockItem)}>Toggle Item 1</button>
      <button onClick={() => comparison.clearComparison()}>Clear</button>
    </div>
  );
}

describe('ComparisonContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('should throw error when useComparison is used outside ComparisonProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useComparison must be used within a ComparisonProvider');

    consoleSpy.mockRestore();
  });

  it('should provide initial empty comparison state', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('max-items')).toHaveTextContent('4');
    expect(screen.getByTestId('can-add')).toHaveTextContent('yes');
    expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('no');
  });

  it('should restore comparison from localStorage on mount', async () => {
    const storedItems: ComparisonItem[] = [
      { productId: 'prod-1', name: 'Stored Product', price: 999, addedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Stored Product 2', price: 1999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
    });
    expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('yes');
  });
});

describe('Comparison Actions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should add item to comparison', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });

    const addButton = screen.getByText('Add Item 1');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('yes');
  });

  it('should not add more than max items (4)', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    // Add 4 items
    await act(async () => {
      screen.getByText('Add Item 1').click();
    });
    await act(async () => {
      screen.getByText('Add Item 2').click();
    });
    await act(async () => {
      screen.getByText('Add Item 3').click();
    });
    await act(async () => {
      screen.getByText('Add Item 4').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('4');
    });
    expect(screen.getByTestId('can-add')).toHaveTextContent('no');

    // Try to add 5th item
    await act(async () => {
      screen.getByText('Add Item 5').click();
    });

    // Should still be 4
    expect(screen.getByTestId('item-count')).toHaveTextContent('4');
  });

  it('should not add duplicate items', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    const addButton = screen.getByText('Add Item 1');

    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });

    await act(async () => {
      addButton.click();
    });

    // Should still be 1
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');
  });

  it('should remove item from comparison', async () => {
    const storedItems: ComparisonItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
    });

    const removeButton = screen.getByText('Remove Item 1');
    await act(async () => {
      removeButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('no');
    expect(screen.getByTestId('item-ids')).toHaveTextContent('prod-2');
  });

  it('should toggle item in comparison (add)', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('no');
    });

    const toggleButton = screen.getByText('Toggle Item 1');
    await act(async () => {
      toggleButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('yes');
    });
    expect(screen.getByTestId('item-count')).toHaveTextContent('1');
  });

  it('should toggle item in comparison (remove)', async () => {
    const storedItems: ComparisonItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('yes');
    });

    const toggleButton = screen.getByText('Toggle Item 1');
    await act(async () => {
      toggleButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('is-in-comparison')).toHaveTextContent('no');
    });
    expect(screen.getByTestId('item-count')).toHaveTextContent('0');
  });

  it('should clear comparison', async () => {
    const storedItems: ComparisonItem[] = [
      { productId: 'prod-1', name: 'Product 1', price: 999, addedAt: new Date().toISOString() },
      { productId: 'prod-2', name: 'Product 2', price: 1999, addedAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedItems));

    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('2');
    });

    const clearButton = screen.getByText('Clear');
    await act(async () => {
      clearButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('0');
    });
    expect(screen.getByTestId('can-add')).toHaveTextContent('yes');
  });

  it('should persist comparison to localStorage', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    const addButton = screen.getByText('Add Item 1');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'shop_comparison',
        expect.stringContaining('prod-1')
      );
    });
  });

  it('should update canAdd correctly', async () => {
    render(
      <ComparisonProvider>
        <TestComponent />
      </ComparisonProvider>
    );

    expect(screen.getByTestId('can-add')).toHaveTextContent('yes');

    // Add 3 items
    await act(async () => {
      screen.getByText('Add Item 1').click();
    });
    await act(async () => {
      screen.getByText('Add Item 2').click();
    });
    await act(async () => {
      screen.getByText('Add Item 3').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('3');
    });
    expect(screen.getByTestId('can-add')).toHaveTextContent('yes');

    // Add 4th item
    await act(async () => {
      screen.getByText('Add Item 4').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('item-count')).toHaveTextContent('4');
    });
    expect(screen.getByTestId('can-add')).toHaveTextContent('no');
  });
});
