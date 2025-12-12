import React from 'react';
import { render, screen } from '@testing-library/react';
import StockPage from '@/app/admin/warehouse/stock/page';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('StockPage', () => {
  it('renders page title', () => {
    render(<StockPage />);

    expect(screen.getByText('Залишки товарів')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<StockPage />);

    expect(screen.getByPlaceholderText(/Пошук/)).toBeInTheDocument();
  });

  it('renders warehouse filter', () => {
    render(<StockPage />);

    expect(screen.getByText('Всі склади')).toBeInTheDocument();
  });

  it('renders category filter', () => {
    render(<StockPage />);

    expect(screen.getByText('Всі категорії')).toBeInTheDocument();
  });

  it('renders stock table with headers', () => {
    render(<StockPage />);

    expect(screen.getByText('Товар')).toBeInTheDocument();
    expect(screen.getByText('Склад / Комірка')).toBeInTheDocument();
    expect(screen.getByText('Залишок')).toBeInTheDocument();
    expect(screen.getByText('Резерв')).toBeInTheDocument();
    expect(screen.getByText('Доступно')).toBeInTheDocument();
  });

  it('has search input', () => {
    render(<StockPage />);

    const searchInput = screen.getByPlaceholderText(/Пошук/);
    expect(searchInput).toBeInTheDocument();
  });

  it('displays product quantities', () => {
    render(<StockPage />);

    // Check for quantity numbers
    const quantities = screen.getAllByText(/\d+/);
    expect(quantities.length).toBeGreaterThan(0);
  });

  it('renders export button', () => {
    render(<StockPage />);

    expect(screen.getByText('Експорт')).toBeInTheDocument();
  });

  it('shows ABC class badges', () => {
    render(<StockPage />);

    const aBadges = screen.getAllByText('A');
    expect(aBadges.length).toBeGreaterThan(0);
  });

  it('shows statistics section', () => {
    render(<StockPage />);

    expect(screen.getByText('Загальна кількість')).toBeInTheDocument();
    expect(screen.getByText('Вартість залишків')).toBeInTheDocument();
  });

  it('shows critical stock filter', () => {
    render(<StockPage />);

    expect(screen.getByText('Критичні залишки')).toBeInTheDocument();
  });

  it('shows out of stock filter', () => {
    render(<StockPage />);

    expect(screen.getByText('Немає в наявності')).toBeInTheDocument();
  });
});

describe('Stock table interactions', () => {
  it('shows product details on row', () => {
    render(<StockPage />);

    // Check for product information
    const productNames = screen.getAllByText(/iPhone|Samsung|MacBook|AirPods/);
    expect(productNames.length).toBeGreaterThan(0);
  });

  it('shows SKU codes', () => {
    render(<StockPage />);

    // Check for SKU pattern
    const skus = screen.getAllByText(/APL-|SAM-|DUR-/);
    expect(skus.length).toBeGreaterThan(0);
  });
});

describe('Stock page structure', () => {
  it('renders correctly', () => {
    render(<StockPage />);

    expect(screen.getByText('Залишки товарів')).toBeInTheDocument();
  });

  it('has scanner link', () => {
    render(<StockPage />);

    expect(screen.getByText('Сканер')).toBeInTheDocument();
  });
});
