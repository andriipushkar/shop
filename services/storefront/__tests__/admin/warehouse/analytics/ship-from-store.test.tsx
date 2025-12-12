import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ShipFromStorePage from '@/app/admin/warehouse/analytics/ship-from-store/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('ShipFromStorePage', () => {
  it('renders loading state initially', () => {
    render(<ShipFromStorePage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Ship-from-Store')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders subtitle after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Оптимізація відвантаження з найближчої точки')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders total orders stat after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Всього')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders from stores stat after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('З магазинів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders from warehouses stat after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Зі складів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders cost stat after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      // Multiple elements have this text
      const elements = screen.getAllByText('Вартість');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders avg delivery stat after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Сер. доставка')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders shipment sources section after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Джерела відвантаження')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders warehouse names after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      // Multiple elements have this text
      const elements = screen.getAllByText('Головний склад');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders navigation links after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Карта зон')).toBeInTheDocument();
      expect(screen.getByText('Перерахувати')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders algorithm info after loading', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      expect(screen.getByText('Ship-from-Store алгоритм')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('ShipFromStorePage Structure', () => {
  it('has buttons for interaction', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders content container', async () => {
    render(<ShipFromStorePage />);

    await waitFor(() => {
      const page = document.body.textContent;
      expect(page).toBeTruthy();
    }, { timeout: 5000 });
  });
});
