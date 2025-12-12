import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ReviewsProvider, useReviews, Review, ProductReviewStats } from '@/lib/reviews-context';

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

const mockReview: Omit<Review, 'id' | 'createdAt' | 'helpful' | 'notHelpful'> = {
  productId: 'prod-1',
  userId: 'user-1',
  userName: 'Test User',
  rating: 4,
  title: 'Great product!',
  text: 'This is a test review.',
  verified: true,
};

// Test component to access reviews context
function TestComponent({ productId = 'prod-1', userId = 'user-1' }: { productId?: string; userId?: string }) {
  const reviews = useReviews();
  const productReviews = reviews.getProductReviews(productId);
  const stats = reviews.getProductStats(productId);
  const userReviews = reviews.getUserReviews(userId);
  const canReview = reviews.canUserReview(productId, userId);

  return (
    <div>
      <span data-testid="product-reviews-count">{productReviews.length}</span>
      <span data-testid="average-rating">{stats.averageRating.toFixed(1)}</span>
      <span data-testid="total-reviews">{stats.totalReviews}</span>
      <span data-testid="user-reviews-count">{userReviews.length}</span>
      <span data-testid="can-review">{canReview ? 'yes' : 'no'}</span>
      <button onClick={() => reviews.addReview(mockReview)}>Add Review</button>
      <button onClick={() => reviews.addReview({ ...mockReview, productId: 'prod-2' })}>Add Review Prod 2</button>
      <button onClick={() => {
        const review = productReviews[0];
        if (review) {
          reviews.updateReview(review.id, { title: 'Updated title' });
        }
      }}>Update Review</button>
      <button onClick={() => {
        const review = productReviews[0];
        if (review) {
          reviews.deleteReview(review.id);
        }
      }}>Delete Review</button>
      <button onClick={() => {
        const review = productReviews[0];
        if (review) {
          reviews.markHelpful(review.id, true);
        }
      }}>Mark Helpful</button>
      <button onClick={() => {
        const review = productReviews[0];
        if (review) {
          reviews.markHelpful(review.id, false);
        }
      }}>Mark Not Helpful</button>
    </div>
  );
}

describe('ReviewsContext', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  it('should throw error when useReviews is used outside ReviewsProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useReviews must be used within a ReviewsProvider');

    consoleSpy.mockRestore();
  });

  it('should generate mock reviews on first load when no stored reviews', async () => {
    mockLocalStorage.getItem.mockReturnValue(null);

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      // Should have generated mock reviews for prod-1
      expect(parseInt(screen.getByTestId('product-reviews-count').textContent || '0')).toBeGreaterThan(0);
    });
  });

  it('should restore reviews from localStorage on mount', async () => {
    const storedReviews: Review[] = [
      {
        id: 'review-1',
        productId: 'prod-1',
        userId: 'user-2',
        userName: 'Stored User',
        rating: 5,
        title: 'Stored review',
        text: 'This is a stored review.',
        helpful: 10,
        notHelpful: 2,
        verified: true,
        createdAt: new Date().toISOString(),
      },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedReviews));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('average-rating')).toHaveTextContent('5.0');
  });
});

describe('Reviews Actions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    // Start with empty reviews to have more control
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));
  });

  it('should add a new review', async () => {
    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('0');
    });

    const addButton = screen.getByText('Add Review');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });
    expect(screen.getByTestId('average-rating')).toHaveTextContent('4.0');
    expect(screen.getByTestId('can-review')).toHaveTextContent('no'); // User already reviewed
  });

  it('should not allow duplicate reviews from same user for same product', async () => {
    const existingReview: Review[] = [{
      id: 'review-1',
      productId: 'prod-1',
      userId: 'user-1',
      userName: 'Test User',
      rating: 4,
      title: 'Existing review',
      text: 'This is an existing review.',
      helpful: 0,
      notHelpful: 0,
      verified: true,
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReview));

    let addResult: { success: boolean; error?: string } | null = null;

    function TestAddReviewComponent() {
      const reviews = useReviews();
      return (
        <div>
          <span data-testid="can-review">{reviews.canUserReview('prod-1', 'user-1') ? 'yes' : 'no'}</span>
          <button onClick={async () => {
            addResult = await reviews.addReview(mockReview);
          }}>Add Review</button>
        </div>
      );
    }

    render(
      <ReviewsProvider>
        <TestAddReviewComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('can-review')).toHaveTextContent('no');
    });

    const addButton = screen.getByText('Add Review');
    await act(async () => {
      addButton.click();
    });

    expect(addResult).toEqual({ success: false, error: 'Ви вже залишили відгук на цей товар' });
  });

  it('should update review', async () => {
    const existingReview: Review[] = [{
      id: 'review-1',
      productId: 'prod-1',
      userId: 'user-1',
      userName: 'Test User',
      rating: 4,
      title: 'Original title',
      text: 'This is a test review.',
      helpful: 0,
      notHelpful: 0,
      verified: true,
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReview));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });

    const updateButton = screen.getByText('Update Review');
    await act(async () => {
      updateButton.click();
    });

    // Verify localStorage was updated
    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'shop_reviews',
        expect.stringContaining('Updated title')
      );
    });
  });

  it('should delete review', async () => {
    const existingReview: Review[] = [{
      id: 'review-1',
      productId: 'prod-1',
      userId: 'user-1',
      userName: 'Test User',
      rating: 4,
      title: 'Test review',
      text: 'This is a test review.',
      helpful: 0,
      notHelpful: 0,
      verified: true,
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReview));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });

    const deleteButton = screen.getByText('Delete Review');
    await act(async () => {
      deleteButton.click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('0');
    });
  });

  it('should mark review as helpful', async () => {
    const existingReview: Review[] = [{
      id: 'review-1',
      productId: 'prod-1',
      userId: 'user-2',
      userName: 'Test User',
      rating: 4,
      title: 'Test review',
      text: 'This is a test review.',
      helpful: 5,
      notHelpful: 2,
      verified: true,
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReview));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });

    const helpfulButton = screen.getByText('Mark Helpful');
    await act(async () => {
      helpfulButton.click();
    });

    // Verify localStorage was updated with incremented helpful count
    await waitFor(() => {
      const lastCall = mockLocalStorage.setItem.mock.calls.find(
        (call: string[]) => call[0] === 'shop_reviews' && call[1].includes('"helpful":6')
      );
      expect(lastCall).toBeDefined();
    });
  });

  it('should mark review as not helpful', async () => {
    const existingReview: Review[] = [{
      id: 'review-1',
      productId: 'prod-1',
      userId: 'user-2',
      userName: 'Test User',
      rating: 4,
      title: 'Test review',
      text: 'This is a test review.',
      helpful: 5,
      notHelpful: 2,
      verified: true,
      createdAt: new Date().toISOString(),
    }];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(existingReview));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('1');
    });

    const notHelpfulButton = screen.getByText('Mark Not Helpful');
    await act(async () => {
      notHelpfulButton.click();
    });

    // Verify localStorage was updated with incremented notHelpful count
    await waitFor(() => {
      const lastCall = mockLocalStorage.setItem.mock.calls.find(
        (call: string[]) => call[0] === 'shop_reviews' && call[1].includes('"notHelpful":3')
      );
      expect(lastCall).toBeDefined();
    });
  });

  it('should calculate product stats correctly', async () => {
    const reviews: Review[] = [
      { id: 'r1', productId: 'prod-1', userId: 'u1', userName: 'User 1', rating: 5, title: 'T1', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
      { id: 'r2', productId: 'prod-1', userId: 'u2', userName: 'User 2', rating: 4, title: 'T2', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
      { id: 'r3', productId: 'prod-1', userId: 'u3', userName: 'User 3', rating: 3, title: 'T3', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
      { id: 'r4', productId: 'prod-2', userId: 'u4', userName: 'User 4', rating: 5, title: 'T4', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(reviews));

    render(
      <ReviewsProvider>
        <TestComponent />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('product-reviews-count')).toHaveTextContent('3');
    });
    expect(screen.getByTestId('total-reviews')).toHaveTextContent('3');
    // Average: (5 + 4 + 3) / 3 = 4.0
    expect(screen.getByTestId('average-rating')).toHaveTextContent('4.0');
  });

  it('should get user reviews correctly', async () => {
    const reviews: Review[] = [
      { id: 'r1', productId: 'prod-1', userId: 'user-1', userName: 'User 1', rating: 5, title: 'T1', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
      { id: 'r2', productId: 'prod-2', userId: 'user-1', userName: 'User 1', rating: 4, title: 'T2', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
      { id: 'r3', productId: 'prod-3', userId: 'user-2', userName: 'User 2', rating: 3, title: 'T3', text: 'T', helpful: 0, notHelpful: 0, verified: true, createdAt: new Date().toISOString() },
    ];
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(reviews));

    render(
      <ReviewsProvider>
        <TestComponent userId="user-1" />
      </ReviewsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-reviews-count')).toHaveTextContent('2');
    });
  });

  it('should persist reviews to localStorage', async () => {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

    render(
      <ReviewsProvider>
        <TestComponent productId="prod-2" userId="user-2" />
      </ReviewsProvider>
    );

    const addButton = screen.getByText('Add Review Prod 2');
    await act(async () => {
      addButton.click();
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'shop_reviews',
        expect.stringContaining('prod-2')
      );
    });
  });
});
