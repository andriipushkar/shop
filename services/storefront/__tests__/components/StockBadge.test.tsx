/**
 * Tests for Stock Badge Component
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import StockBadge, { StockIndicator, StockProgressBar } from '@/components/StockBadge';

describe('StockBadge', () => {
  describe('Stock statuses', () => {
    it('should render "В наявності" for in_stock', () => {
      render(<StockBadge stock={100} />);
      expect(screen.getByText('В наявності')).toBeInTheDocument();
    });

    it('should render low stock warning with count', () => {
      render(<StockBadge stock={3} lowStockThreshold={5} showCount />);
      expect(screen.getByText(/Залишилось 3 шт/)).toBeInTheDocument();
    });

    it('should render "Немає в наявності" for out_of_stock', () => {
      render(<StockBadge stock={0} />);
      expect(screen.getByText('Немає в наявності')).toBeInTheDocument();
    });

    it('should render preorder badge with date', () => {
      render(<StockBadge stock={0} preorderDate="2024-02-15" />);
      expect(screen.getByText(/Передзамовлення/)).toBeInTheDocument();
    });

    it('should render coming soon badge', () => {
      render(<StockBadge stock={0} comingSoonDate="2024-03-01" />);
      expect(screen.getByText(/Скоро у продажу/)).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('should render small size', () => {
      const { container } = render(<StockBadge stock={100} size="sm" />);
      expect(container.querySelector('.text-xs')).toBeInTheDocument();
    });

    it('should render medium size by default', () => {
      const { container } = render(<StockBadge stock={100} />);
      expect(container.querySelector('.text-sm')).toBeInTheDocument();
    });

    it('should render large size', () => {
      const { container } = render(<StockBadge stock={100} size="lg" />);
      expect(container.querySelector('.text-base')).toBeInTheDocument();
    });
  });

  describe('Show count option', () => {
    it('should show count when showCount is true for low stock', () => {
      render(<StockBadge stock={3} lowStockThreshold={5} showCount />);
      expect(screen.getByText(/3 шт/)).toBeInTheDocument();
    });

    it('should not show count when showCount is false', () => {
      render(<StockBadge stock={3} lowStockThreshold={5} showCount={false} />);
      expect(screen.queryByText(/3 шт/)).not.toBeInTheDocument();
    });
  });

  describe('Custom threshold', () => {
    it('should use default threshold of 5', () => {
      render(<StockBadge stock={4} showCount />);
      expect(screen.getByText(/Залишилось/)).toBeInTheDocument();
    });

    it('should use custom threshold', () => {
      render(<StockBadge stock={8} lowStockThreshold={10} showCount />);
      expect(screen.getByText(/Залишилось/)).toBeInTheDocument();
    });

    it('should not show low stock for stock above threshold', () => {
      render(<StockBadge stock={10} lowStockThreshold={5} />);
      expect(screen.queryByText(/Залишилось/)).not.toBeInTheDocument();
    });
  });
});

describe('StockIndicator', () => {
  it('should render "В наявності" for in stock', () => {
    render(<StockIndicator stock={100} />);
    expect(screen.getByText('В наявності')).toBeInTheDocument();
  });

  it('should render low stock warning with count', () => {
    render(<StockIndicator stock={3} lowStockThreshold={5} />);
    expect(screen.getByText(/Залишилось 3 шт/)).toBeInTheDocument();
  });

  it('should render "Немає в наявності" for out of stock', () => {
    render(<StockIndicator stock={0} />);
    expect(screen.getByText('Немає в наявності')).toBeInTheDocument();
  });

  it('should have green color for in stock', () => {
    const { container } = render(<StockIndicator stock={100} />);
    expect(container.querySelector('.text-green-600')).toBeInTheDocument();
  });
});

describe('StockProgressBar', () => {
  it('should render progress bar with percentage', () => {
    const { container } = render(<StockProgressBar stock={50} maxStock={100} />);
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show green for high stock', () => {
    const { container } = render(<StockProgressBar stock={80} maxStock={100} />);
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('should show orange for low stock', () => {
    const { container } = render(
      <StockProgressBar stock={4} maxStock={100} lowStockThreshold={5} />
    );
    expect(container.querySelector('.bg-orange-500')).toBeInTheDocument();
  });

  it('should show gray for zero stock', () => {
    const { container } = render(
      <StockProgressBar stock={0} maxStock={100} />
    );
    expect(container.querySelector('.bg-gray-400')).toBeInTheDocument();
  });

  it('should handle zero max stock', () => {
    const { container } = render(<StockProgressBar stock={0} maxStock={0} />);
    expect(container).toBeInTheDocument();
  });
});
