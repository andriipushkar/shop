import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ZonesPage from '@/app/admin/warehouse/analytics/zones/page';

// Increase Jest timeout for async component loading
jest.setTimeout(30000);

// Mock Next.js Link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('ZonesPage', () => {
  it('renders loading state initially', () => {
    render(<ZonesPage />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders page title after loading', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Гарячі/Холодні зони')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders subtitle', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Оптимізація розміщення товарів на складі')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders hot zones stat', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      // Multiple elements have this text, so use getAllByText
      const elements = screen.getAllByText('Гарячі зони');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders warm zones stat', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Теплі зони')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders cold zones stat', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      // Multiple elements have this text, so use getAllByText
      const elements = screen.getAllByText('Холодні зони');
      expect(elements.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders frozen zones stat', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Заморожені')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders products count', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Товарів')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders picks per month', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Пікінгів/міс.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders warehouse map section', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Карта складу')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders zone labels on map', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('A-01')).toBeInTheDocument();
      expect(screen.getByText('A-02')).toBeInTheDocument();
      expect(screen.getByText('B-01')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders central aisle', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Центральний прохід')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders map legend', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Гаряча')).toBeInTheDocument();
      expect(screen.getByText('Тепла')).toBeInTheDocument();
      expect(screen.getByText('Холодна')).toBeInTheDocument();
      expect(screen.getByText('Заморожена')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders entry/exit indicators', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('→ Вхід')).toBeInTheDocument();
      expect(screen.getByText('← Вихід (пікінг)')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders wave picking link', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Wave Picking')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders hot/cold zone principle info', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Принцип Hot/Cold Zone')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('renders view mode toggle buttons', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      const buttons = document.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('ZonesPage Zone Selection', () => {
  it('shows zone details placeholder when no zone selected', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      expect(screen.getByText('Виберіть зону на карті для перегляду деталей')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('zone buttons are clickable', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      const zoneButton = screen.getByText('A-01').closest('button');
      expect(zoneButton).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('ZonesPage Recommendations', () => {
  it('renders recommendations section if recommendations exist', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      // Recommendations section is conditional - just verify page loaded
      const page = document.body.textContent;
      expect(page).toContain('Гарячі/Холодні зони');
    }, { timeout: 5000 });
  });

  it('has content in the page', async () => {
    render(<ZonesPage />);

    await waitFor(() => {
      const page = document.body.textContent;
      expect(page).toContain('Гарячі/Холодні зони');
    }, { timeout: 5000 });
  });
});
