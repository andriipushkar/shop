import React from 'react';
import { render, screen } from '@testing-library/react';
import POSPage from '@/app/admin/warehouse/pos/page';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock window.confirm
beforeAll(() => {
  window.confirm = jest.fn(() => true);
});

describe('POSPage', () => {
  it('renders product search', () => {
    render(<POSPage />);

    const searchInput = screen.getByPlaceholderText(/Пошук|сканування/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('renders product grid', () => {
    render(<POSPage />);

    // Should show products
    const products = screen.getAllByText(/iPhone|Samsung|MacBook|AirPods/);
    expect(products.length).toBeGreaterThan(0);
  });

  it('renders cart section', () => {
    render(<POSPage />);

    expect(screen.getByText('Кошик')).toBeInTheDocument();
  });

  it('shows empty cart message initially', () => {
    render(<POSPage />);

    expect(screen.getByText('Кошик порожній')).toBeInTheDocument();
  });

  it('shows category filters', () => {
    render(<POSPage />);

    expect(screen.getByText('Всі')).toBeInTheDocument();
    expect(screen.getByText('Смартфони')).toBeInTheDocument();
    expect(screen.getByText('Аксесуари')).toBeInTheDocument();
  });

  it('shows scanner button', () => {
    render(<POSPage />);

    expect(screen.getByText('Сканер')).toBeInTheDocument();
  });
});

describe('POS Cart functionality', () => {
  it('has cart area', () => {
    render(<POSPage />);

    expect(screen.getByText('Кошик')).toBeInTheDocument();
  });

  it('shows cart total area', () => {
    render(<POSPage />);

    // Should show total section
    expect(screen.getByText('До сплати')).toBeInTheDocument();
  });
});

describe('POS Categories', () => {
  it('shows all category button', () => {
    render(<POSPage />);

    const allButton = screen.getByText('Всі');
    expect(allButton).toBeInTheDocument();
  });

  it('shows category buttons', () => {
    render(<POSPage />);

    expect(screen.getByText('Смартфони')).toBeInTheDocument();
    expect(screen.getByText('Ноутбуки')).toBeInTheDocument();
    expect(screen.getByText('Аксесуари')).toBeInTheDocument();
  });
});

describe('POS Search', () => {
  it('has search input', () => {
    render(<POSPage />);

    const searchInput = screen.getByPlaceholderText(/Пошук|сканування/i);
    expect(searchInput).toBeInTheDocument();
  });
});

describe('POS page structure', () => {
  it('renders correctly', () => {
    render(<POSPage />);

    // Should have cart section
    expect(screen.getByText('Кошик')).toBeInTheDocument();
  });

  it('shows product prices', () => {
    render(<POSPage />);

    // Should display prices with ₴
    const prices = screen.getAllByText(/₴/);
    expect(prices.length).toBeGreaterThan(0);
  });

  it('shows product SKUs', () => {
    render(<POSPage />);

    // Should display SKU codes
    const skus = screen.getAllByText(/PHONE-|ACC-|LAPTOP-/);
    expect(skus.length).toBeGreaterThan(0);
  });
});
