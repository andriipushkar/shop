import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AnomaliesPage from '@/app/admin/warehouse/analytics/anomalies/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('AnomaliesPage', () => {
  it('renders loading state initially', () => {
    render(<AnomaliesPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Виявлення аномалій')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders subtitle', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('AI-аналіз відхилень від нормального попиту')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders total anomalies stat', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Всього аномалій')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders critical anomalies stat', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Критичні')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders high anomalies stat', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Високі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders medium anomalies stat', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Середні')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders anomaly type cards', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Сплески')).toBeInTheDocument();
      expect(screen.getByText('Падіння')).toBeInTheDocument();
      expect(screen.getByText('Нульові продажі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders sensitivity slider', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Чутливість виявлення:')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders methodology information', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Методологія виявлення')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders navigation links', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Прогнози')).toBeInTheDocument();
      expect(screen.getByText('Точки замовлення')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('describes spike anomalies', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Раптове зростання продажів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('describes drop anomalies', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Раптове зниження продажів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('describes zero sales anomalies', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      expect(screen.getByText('Продажі відсутні')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('AnomaliesPage Type Buttons', () => {
  it('spike button is clickable', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      const spikeButton = screen.getByText('Сплески').closest('button');
      expect(spikeButton).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('drop button is clickable', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      const dropButton = screen.getByText('Падіння').closest('button');
      expect(dropButton).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('AnomaliesPage Severity Levels', () => {
  it('explains severity thresholds', async () => {
    render(<AnomaliesPage />);

    await waitFor(() => {
      // Multiple elements contain σ, use getAllByText
      const elements = screen.getAllByText(/σ/);
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});
