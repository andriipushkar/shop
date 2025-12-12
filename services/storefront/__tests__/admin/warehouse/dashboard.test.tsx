import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WarehouseDashboard from '@/app/admin/warehouse/page';

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('WarehouseDashboard', () => {
  it('renders loading state initially', () => {
    render(<WarehouseDashboard />);

    // Check for spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders dashboard title after loading', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Управління складом')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders main statistics cards', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Всього товарів')).toBeInTheDocument();
      expect(screen.getByText('Вартість залишків')).toBeInTheDocument();
      expect(screen.getByText('Критичні залишки')).toBeInTheDocument();
      expect(screen.getByText('Очікується поставок')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders quick action buttons', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Швидкі дії')).toBeInTheDocument();
      expect(screen.getByText('Приймання товару')).toBeInTheDocument();
      expect(screen.getByText('Відвантаження')).toBeInTheDocument();
      expect(screen.getByText('Переміщення')).toBeInTheDocument();
      expect(screen.getByText('Інвентаризація')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders scanner link in header', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Сканер')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders warehouse list section', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Склади та магазини')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders alerts section', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Сповіщення')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('renders recent movements section', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Останні рухи')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('links to various warehouse sections', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      const hrefs = links.map(link => link.getAttribute('href'));

      expect(hrefs).toContain('/admin/warehouse/scanner');
      expect(hrefs).toContain('/admin/warehouse/receipt/new');
    }, { timeout: 2000 });
  });
});

describe('Quick actions', () => {
  it('renders action descriptions', async () => {
    render(<WarehouseDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Оприбуткування від постачальника')).toBeInTheDocument();
      expect(screen.getByText('Відправка замовлень')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
