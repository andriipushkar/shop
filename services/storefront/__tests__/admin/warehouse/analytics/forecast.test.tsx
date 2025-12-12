import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ForecastPage from '@/app/admin/warehouse/analytics/forecast/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('ForecastPage', () => {
  it('renders loading state initially', () => {
    render(<ForecastPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Прогнозування попиту')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders AI analytics subtitle', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('AI-аналітика на основі історичних даних')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders category filter', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Категорія')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders forecast horizon filter', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Горизонт прогнозу')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders lead time filter', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Час поставки')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders products list', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Товари')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('displays product names', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      // Multiple elements may have this text, or check page content
      const page = document.body.textContent;
      expect(page).toContain('iPhone');
    }, { timeout: 5000 });
  });

  it('renders key metrics cards', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Поточний запас')).toBeInTheDocument();
      expect(screen.getByText('Сер. продажі/день')).toBeInTheDocument();
      expect(screen.getByText('До закінчення')).toBeInTheDocument();
      expect(screen.getByText('Тренд')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders forecast chart section', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText(/Прогноз продажів на/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders seasonality section', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Сезонні індекси')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders navigation links', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Точки замовлення')).toBeInTheDocument();
      expect(screen.getByText('Аномалії')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders chart legend', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Прогноз')).toBeInTheDocument();
      expect(screen.getByText('Інтервал довіри 95%')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders month abbreviations in seasonality', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      expect(screen.getByText('Січ')).toBeInTheDocument();
      expect(screen.getByText('Лют')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('ForecastPage Product Selection', () => {
  it('allows product selection', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      // Look for product text in the page
      const page = document.body.textContent;
      expect(page).toContain('iPhone 15 Pro');
    }, { timeout: 5000 });
  });

  it('shows product SKUs', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      const page = document.body.textContent;
      expect(page).toContain('APL-IP15P-256');
    }, { timeout: 5000 });
  });
});

describe('ForecastPage Filters', () => {
  it('has filter elements', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      const selects = document.querySelectorAll('select');
      expect(selects.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('has multiple filter options', async () => {
    render(<ForecastPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 5000 });
  });
});
