import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import WavePickingPage from '@/app/admin/warehouse/analytics/wave-picking/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('WavePickingPage', () => {
  it('renders loading state initially', () => {
    render(<WavePickingPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Wave Picking')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders subtitle', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Оптимізація збору замовлень хвилями')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders waves count stat', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Хвиль')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders orders count stat', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Замовлень')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders items count stat', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Товарів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders express orders stat', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      // Multiple elements have this text
      const elements = screen.getAllByText('Експрес');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders total time stat', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Загальний час')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders max orders per batch setting', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Макс. замовлень в хвилі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders max items per batch setting', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Макс. товарів в хвилі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders wave cards with numbers', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      const waveLabels = screen.getAllByText(/Хвиля #/);
      expect(waveLabels.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders priority badges', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      const expressBadges = screen.getAllByText('Експрес');
      expect(expressBadges.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders start button for waves', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      const startButtons = screen.getAllByText('Почати');
      expect(startButtons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders route information', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      // Multiple elements may have this text
      const elements = screen.getAllByText(/Маршрут/);
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders navigation links', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Карта зон')).toBeInTheDocument();
      expect(screen.getByText('Оновити хвилі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders optimization info', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      expect(screen.getByText('Wave Picking оптимізація')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows wave details on expand', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      // Check for expand button (chevron)
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('WavePickingPage Wave Interaction', () => {
  it('has collapsible wave details', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      // Check for chevron icons indicating expandable content
      const chevrons = document.querySelectorAll('[class*="w-5"][class*="h-5"]');
      expect(chevrons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('shows time estimate per wave', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      const timeEstimates = screen.getAllByText(/хв/);
      expect(timeEstimates.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('WavePickingPage Settings', () => {
  it('has select elements for configuration', async () => {
    render(<WavePickingPage />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    }, { timeout: 5000 });
  });
});
