import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReorderPage from '@/app/admin/warehouse/analytics/reorder/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('ReorderPage', () => {
  it('renders loading state initially', () => {
    render(<ReorderPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Точки перезамовлення')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders subtitle', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Автоматичний розрахунок оптимальних рівнів запасів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders status cards', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      // Multiple elements may have these texts
      const criticalElements = screen.getAllByText('Критично');
      const orderElements = screen.getAllByText('Замовити');
      const normalElements = screen.getAllByText('В нормі');
      const excessElements = screen.getAllByText('Надлишок');
      expect(criticalElements.length).toBeGreaterThan(0);
      expect(orderElements.length).toBeGreaterThan(0);
      expect(normalElements.length).toBeGreaterThan(0);
      expect(excessElements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders total order value', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Сума замовлення')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders category filter', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Категорія')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders status filter', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      // Multiple elements may have this text
      const elements = screen.getAllByText('Статус');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders service level selector', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Рівень сервісу')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders formula information', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Формула розрахунку')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders table headers', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Товар')).toBeInTheDocument();
      expect(screen.getByText('Залишок')).toBeInTheDocument();
      expect(screen.getByText('Сер. продажі')).toBeInTheDocument();
      expect(screen.getByText('Страх. запас')).toBeInTheDocument();
      expect(screen.getByText('Точка замовл.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders product data in table', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      // Check page content contains table data indicators
      const page = document.body.textContent;
      expect(page).toContain('/день');
    }, { timeout: 5000 });
  });

  it('renders visualization section', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Візуалізація рівнів запасу')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders navigation links', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Прогнози')).toBeInTheDocument();
      expect(screen.getByText('Експорт')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders legend in visualization', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      const legend = screen.getAllByText('В нормі');
      expect(legend.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('ReorderPage Interactions', () => {
  it('has select all checkbox', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('shows select critical button', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      expect(screen.getByText('Вибрати критичні')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('ReorderPage Status Colors', () => {
  it('shows status badges in table', async () => {
    render(<ReorderPage />);

    await waitFor(() => {
      const statusBadges = document.querySelectorAll('.rounded-full');
      expect(statusBadges.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});
