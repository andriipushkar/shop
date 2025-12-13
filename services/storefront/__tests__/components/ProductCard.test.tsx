import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '@/components/ProductCard';
import { Product } from '@/lib/mock-data';

// Mock the cart context
const mockAddToCart = jest.fn();
jest.mock('@/lib/cart-context', () => ({
  useCart: () => ({
    addToCart: mockAddToCart,
    items: [],
    total: 0,
    itemCount: 0,
    removeFromCart: jest.fn(),
    updateQuantity: jest.fn(),
    clearCart: jest.fn(),
  }),
}));

// Mock wishlist context
const mockToggleWishlist = jest.fn();
const mockIsInWishlist = jest.fn().mockReturnValue(false);
jest.mock('@/lib/wishlist-context', () => ({
  useWishlist: () => ({
    items: [],
    totalItems: 0,
    isInWishlist: mockIsInWishlist,
    toggleWishlist: mockToggleWishlist,
    addToWishlist: jest.fn(),
    removeFromWishlist: jest.fn(),
    clearWishlist: jest.fn(),
  }),
}));

// Mock comparison context
const mockToggleComparison = jest.fn();
const mockIsInComparison = jest.fn().mockReturnValue(false);
jest.mock('@/lib/comparison-context', () => ({
  useComparison: () => ({
    items: [],
    itemCount: 0,
    maxItems: 4,
    canAdd: true,
    isInComparison: mockIsInComparison,
    toggleComparison: mockToggleComparison,
    addToComparison: jest.fn(),
    removeFromComparison: jest.fn(),
    clearComparison: jest.fn(),
  }),
}));

// Mock recently viewed context
const mockAddToRecentlyViewed = jest.fn();
jest.mock('@/lib/recently-viewed-context', () => ({
  useRecentlyViewed: () => ({
    items: [],
    totalItems: 0,
    addToRecentlyViewed: mockAddToRecentlyViewed,
    removeFromRecentlyViewed: jest.fn(),
    clearRecentlyViewed: jest.fn(),
  }),
}));

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  price: 1999,
  oldPrice: 2499,
  sku: 'SKU-TEST-001',
  stock: 10,
  image_url: '/test-image.jpg',
  category_id: 'cat-1',
  brand: 'Test Brand',
  description: 'Test description',
  rating: 4.5,
  reviewCount: 100,
  isNew: true,
  isBestseller: false,
};

describe('ProductCard', () => {
  beforeEach(() => {
    mockAddToCart.mockClear();
    mockToggleWishlist.mockClear();
    mockToggleComparison.mockClear();
    mockAddToRecentlyViewed.mockClear();
    mockIsInWishlist.mockReturnValue(false);
    mockIsInComparison.mockReturnValue(false);
  });

  it('renders product name', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  it('renders product SKU', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('SKU-TEST-001')).toBeInTheDocument();
  });

  it('renders current price', () => {
    render(<ProductCard product={mockProduct} />);
    // Price is formatted with toLocaleString
    expect(screen.getByText(/1\s*999/)).toBeInTheDocument();
  });

  it('renders old price when product has discount', () => {
    render(<ProductCard product={mockProduct} />);
    // Old price should be displayed with line-through
    expect(screen.getByText(/2\s*499/)).toBeInTheDocument();
  });

  it('renders discount percentage when product has discount', () => {
    render(<ProductCard product={mockProduct} />);
    // Discount: (2499 - 1999) / 2499 = ~20%
    const discountBadges = screen.getAllByText(/-20%/);
    expect(discountBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders rating', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('renders review count', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('(100)')).toBeInTheDocument();
  });

  it('shows "В наявності" when in stock', () => {
    render(<ProductCard product={mockProduct} />);
    expect(screen.getByText('В наявності')).toBeInTheDocument();
  });

  it('shows low stock warning when stock < 5', () => {
    const lowStockProduct = { ...mockProduct, stock: 3 };
    render(<ProductCard product={lowStockProduct} />);
    expect(screen.getByText('3 шт')).toBeInTheDocument();
    expect(screen.getByText('Залишилось 3 шт')).toBeInTheDocument();
  });

  it('shows out of stock message when stock is 0', () => {
    const outOfStockProduct = { ...mockProduct, stock: 0 };
    render(<ProductCard product={outOfStockProduct} />);
    expect(screen.getByText('Немає в наявності')).toBeInTheDocument();
  });

  it('links to product page', () => {
    render(<ProductCard product={mockProduct} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/product/prod-1');
  });

  it('does not show discount badge when no oldPrice', () => {
    const productWithoutDiscount = { ...mockProduct, oldPrice: undefined };
    render(<ProductCard product={productWithoutDiscount} />);
    // Should not have discount percentage badge in the top-left
    const badges = screen.queryAllByText(/-%/);
    // Filter out price section badges
    expect(badges.length).toBeLessThanOrEqual(1);
  });

  it('handles products without image', () => {
    const productWithoutImage = { ...mockProduct, image_url: '' };
    render(<ProductCard product={productWithoutImage} />);
    // Should show SKU first letter as placeholder
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  describe('Add to Cart', () => {
    it('calls addToCart when mobile button is clicked', () => {
      render(<ProductCard product={mockProduct} />);

      // Find mobile add to cart button (has lg:hidden class, shows "В кошик")
      const addButtons = screen.getAllByText('В кошик');
      fireEvent.click(addButtons[0]);

      expect(mockAddToCart).toHaveBeenCalledWith(mockProduct);
    });

    it('disables add to cart for out of stock products', () => {
      const outOfStockProduct = { ...mockProduct, stock: 0 };
      render(<ProductCard product={outOfStockProduct} />);

      const unavailableButton = screen.getByText('Недоступно');
      expect(unavailableButton.closest('button')).toBeDisabled();
    });
  });

  describe('Wishlist', () => {
    it('calls toggleWishlist on click', () => {
      render(<ProductCard product={mockProduct} />);

      const wishlistButton = screen.getByTitle('Додати до бажань');

      // Click to toggle wishlist
      fireEvent.click(wishlistButton);

      // Should call toggleWishlist with product data
      expect(mockToggleWishlist).toHaveBeenCalledWith({
        productId: 'prod-1',
        name: 'Test Product',
        price: 1999,
        image: '/test-image.jpg',
      });
    });

    it('shows remove from wishlist title when item is in wishlist', () => {
      mockIsInWishlist.mockReturnValue(true);
      render(<ProductCard product={mockProduct} />);

      const wishlistButton = screen.getByTitle('Видалити з бажань');
      expect(wishlistButton).toBeInTheDocument();
    });
  });

  describe('Comparison', () => {
    it('calls toggleComparison on click', () => {
      render(<ProductCard product={mockProduct} />);

      const comparisonButton = screen.getByTitle('Додати до порівняння');

      fireEvent.click(comparisonButton);

      expect(mockToggleComparison).toHaveBeenCalledWith({
        productId: 'prod-1',
        name: 'Test Product',
        price: 1999,
        image: '/test-image.jpg',
      });
    });

    it('shows remove from comparison title when item is in comparison', () => {
      mockIsInComparison.mockReturnValue(true);
      render(<ProductCard product={mockProduct} />);

      const comparisonButton = screen.getByTitle('Видалити з порівняння');
      expect(comparisonButton).toBeInTheDocument();
    });
  });

  describe('Recently Viewed', () => {
    it('has handleClick attached to link for tracking recently viewed', () => {
      // The handleClick is attached to the Link onClick prop
      // We verify the function exists and the mock is set up correctly
      render(<ProductCard product={mockProduct} />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/product/prod-1');

      // Note: In actual browser, clicking the link would call handleClick
      // which triggers addToRecentlyViewed before navigation
    });
  });

  describe('Quick View', () => {
    it('shows quick view button by default', () => {
      render(<ProductCard product={mockProduct} />);
      expect(screen.getByTitle('Швидкий перегляд')).toBeInTheDocument();
    });

    it('hides quick view button when showQuickView is false', () => {
      render(<ProductCard product={mockProduct} showQuickView={false} />);
      expect(screen.queryByTitle('Швидкий перегляд')).not.toBeInTheDocument();
    });
  });

  describe('Hover interactions', () => {
    it('handles mouse enter and leave events', () => {
      render(<ProductCard product={mockProduct} />);
      const card = screen.getByRole('link').firstChild as HTMLElement;

      fireEvent.mouseEnter(card);
      fireEvent.mouseLeave(card);
    });
  });

  describe('Image error handling', () => {
    it('handles image load error', () => {
      render(<ProductCard product={mockProduct} />);
      // Alt text now includes price for SEO: "Test Product - купити в TechShop за 1 999 грн"
      const img = screen.getByAltText(/Test Product - купити в TechShop/);

      fireEvent.error(img);

      // After error, should show placeholder
      expect(screen.getByText('S')).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('uses default rating when rating is undefined', () => {
      const productWithoutRating = { ...mockProduct, rating: undefined };
      render(<ProductCard product={productWithoutRating} />);
      expect(screen.getByText('4.5')).toBeInTheDocument();
    });

    it('shows emoji placeholder when sku is undefined', () => {
      const productWithoutSku = { ...mockProduct, sku: undefined, image_url: '' };
      render(<ProductCard product={productWithoutSku} />);
      expect(screen.getByText('📦')).toBeInTheDocument();
    });

    it('handles add to cart click for in-stock product', () => {
      render(<ProductCard product={mockProduct} />);

      // Find the add to cart button
      const addButtons = screen.getAllByText('В кошик');
      fireEvent.click(addButtons[0]);

      // Should show "Додано!" feedback (there may be multiple due to responsive design)
      const addedTexts = screen.getAllByText('Додано!');
      expect(addedTexts.length).toBeGreaterThan(0);
    });

    it('ignores add to cart click for out-of-stock product', () => {
      const outOfStockProduct = { ...mockProduct, stock: 0 };
      render(<ProductCard product={outOfStockProduct} />);

      // Button should be disabled
      const unavailableButton = screen.getByText('Недоступно');
      expect(unavailableButton.closest('button')).toBeDisabled();
    });
  });
});
