import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScannerPage from '@/app/admin/warehouse/scanner/page';

// Mock AudioContext
const mockOscillator = {
  connect: jest.fn(),
  frequency: { value: 0 },
  type: 'sine',
  start: jest.fn(),
  stop: jest.fn(),
};

const mockGainNode = {
  connect: jest.fn(),
  gain: { value: 0 },
};

const mockAudioContext = {
  createOscillator: jest.fn(() => mockOscillator),
  createGain: jest.fn(() => mockGainNode),
  destination: {},
  currentTime: 0,
  close: jest.fn(),
};

// Setup mocks before tests
beforeAll(() => {
  (window as any).AudioContext = jest.fn(() => mockAudioContext);
  (window as any).webkitAudioContext = jest.fn(() => mockAudioContext);

  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn().mockResolvedValue(undefined),
    },
  });
});

describe('ScannerPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Mode Selection', () => {
    it('renders mode selection screen by default', () => {
      render(<ScannerPage />);

      expect(screen.getByText('Сканер штрих-кодів')).toBeInTheDocument();
      expect(screen.getByText("Я на комп'ютері")).toBeInTheDocument();
      expect(screen.getByText('Я на телефоні')).toBeInTheDocument();
    });

    it('shows instructions for how the system works', () => {
      render(<ScannerPage />);

      expect(screen.getByText('Як це працює:')).toBeInTheDocument();
    });
  });

  describe('Desktop Mode', () => {
    it('creates session when clicking desktop mode button', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByText('Режим прийому сканів')).toBeInTheDocument();
      });
    });

    it('displays session code label', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByText("Код для підключення телефону:")).toBeInTheDocument();
      });
    });

    it('shows waiting for connection status initially', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByText('Очікування підключення...')).toBeInTheDocument();
      });
    });

    it('shows empty scans message', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByText('Скани ще не отримані')).toBeInTheDocument();
      });
    });

    it('has copy button', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByTitle('Копіювати')).toBeInTheDocument();
      });
    });

    it('has sound toggle button', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        const soundButton = screen.getByTitle('Вимкнути звук');
        expect(soundButton).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Mode', () => {
    it('shows session code input', () => {
      render(<ScannerPage />);

      const input = screen.getByPlaceholderText('Код сесії (6 символів)');
      expect(input).toBeInTheDocument();
    });

    it('converts session code to uppercase', () => {
      render(<ScannerPage />);

      const input = screen.getByPlaceholderText('Код сесії (6 символів)') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'abcdef' } });

      expect(input.value).toBe('ABCDEF');
    });

    it('has connect button', () => {
      render(<ScannerPage />);

      const buttons = screen.getAllByRole('button');
      const linkButton = buttons.find(b => b.classList.contains('bg-blue-600'));
      expect(linkButton).toBeInTheDocument();
    });
  });

  describe('QR Code', () => {
    it('displays QR code in desktop mode', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        // QRCodeSVG renders an SVG element, not an img
        // Check for the QR code container and description text
        expect(screen.getByText('Скануйте телефоном')).toBeInTheDocument();
      });
    });

    it('shows QR code scan instructions', async () => {
      render(<ScannerPage />);

      const desktopButton = screen.getByText("Я на комп'ютері").closest('button');
      fireEvent.click(desktopButton!);

      await waitFor(() => {
        expect(screen.getByText(/Відскануйте QR-код телефоном/)).toBeInTheDocument();
      });
    });
  });
});

describe('Scanner page structure', () => {
  it('renders main title', () => {
    render(<ScannerPage />);

    expect(screen.getByText('Сканер штрих-кодів')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<ScannerPage />);

    expect(screen.getByText(/Скануйте товари телефоном/)).toBeInTheDocument();
  });
});
