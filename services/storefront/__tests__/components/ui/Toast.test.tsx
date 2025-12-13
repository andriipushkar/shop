/**
 * Tests for Toast Notifications Component
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ToastProvider, useToast, toast, setToastHandler, toastMessages } from '@/components/ui/Toast';

// Test component that uses the toast hook
function ToastTester() {
  const toasts = useToast();

  return (
    <div>
      <button onClick={() => toasts.success('Success message')}>
        Show Success
      </button>
      <button onClick={() => toasts.error('Error message')}>
        Show Error
      </button>
      <button onClick={() => toasts.warning('Warning message')}>
        Show Warning
      </button>
      <button onClick={() => toasts.info('Info message')}>
        Show Info
      </button>
      <button onClick={() => toasts.clearToasts()}>
        Clear All
      </button>
    </div>
  );
}

describe('Toast Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('ToastProvider', () => {
    it('renders children', () => {
      render(
        <ToastProvider>
          <div data-testid="child">Child Content</div>
        </ToastProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('creates toast container', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      // Toast container should exist when toasts are shown
      fireEvent.click(screen.getByText('Show Success'));

      expect(screen.getByRole('region', { name: 'Сповіщення' })).toBeInTheDocument();
    });
  });

  describe('useToast hook', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ToastTester />);
      }).toThrow('useToast must be used within a ToastProvider');

      consoleError.mockRestore();
    });

    it('shows success toast', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));

      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('bg-green-50');
    });

    it('shows error toast', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));

      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('bg-red-50');
    });

    it('shows warning toast', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Warning'));

      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('bg-yellow-50');
    });

    it('shows info toast', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Info'));

      expect(screen.getByText('Info message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');
    });

    it('clears all toasts', () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));
      fireEvent.click(screen.getByText('Show Error'));

      expect(screen.getAllByRole('alert')).toHaveLength(2);

      fireEvent.click(screen.getByText('Clear All'));

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Toast auto-dismiss', () => {
    it('auto-dismisses success toast after default duration', async () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));

      expect(screen.getByText('Success message')).toBeInTheDocument();

      // Success toast default is 3000ms
      act(() => {
        jest.advanceTimersByTime(3500);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });

    it('error toast stays longer', async () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Error'));

      // Error toast default is 5000ms - should still be visible at 4000ms
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Toast dismiss button', () => {
    it('dismisses toast when clicking close button', async () => {
      render(
        <ToastProvider>
          <ToastTester />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Success'));

      const closeButton = screen.getByRole('button', { name: 'Закрити' });
      fireEvent.click(closeButton);

      // Wait for exit animation
      act(() => {
        jest.advanceTimersByTime(250);
      });

      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      });
    });
  });

  describe('Toast with title', () => {
    function ToastWithTitle() {
      const toasts = useToast();

      return (
        <button
          onClick={() =>
            toasts.addToast({
              type: 'info',
              title: 'Toast Title',
              message: 'Toast body message',
            })
          }
        >
          Show Toast With Title
        </button>
      );
    }

    it('renders title and message', () => {
      render(
        <ToastProvider>
          <ToastWithTitle />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Toast With Title'));

      expect(screen.getByText('Toast Title')).toBeInTheDocument();
      expect(screen.getByText('Toast body message')).toBeInTheDocument();
    });
  });

  describe('Toast with action', () => {
    function ToastWithAction() {
      const toasts = useToast();
      const [clicked, setClicked] = React.useState(false);

      return (
        <>
          <button
            onClick={() =>
              toasts.addToast({
                type: 'warning',
                message: 'Confirm action?',
                action: {
                  label: 'Confirm',
                  onClick: () => setClicked(true),
                },
              })
            }
          >
            Show Action Toast
          </button>
          {clicked && <span>Action clicked!</span>}
        </>
      );
    }

    it('renders action button', () => {
      render(
        <ToastProvider>
          <ToastWithAction />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Action Toast'));

      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    it('calls action onClick when clicked', () => {
      render(
        <ToastProvider>
          <ToastWithAction />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Show Action Toast'));
      fireEvent.click(screen.getByText('Confirm'));

      expect(screen.getByText('Action clicked!')).toBeInTheDocument();
    });
  });

  describe('Max toasts limit', () => {
    function ManyToasts() {
      const toasts = useToast();

      return (
        <button
          onClick={() => {
            for (let i = 0; i < 10; i++) {
              toasts.info(`Toast ${i + 1}`);
            }
          }}
        >
          Add Many Toasts
        </button>
      );
    }

    it('limits number of visible toasts', () => {
      render(
        <ToastProvider maxToasts={5}>
          <ManyToasts />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add Many Toasts'));

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(5);

      // Should show the last 5 toasts
      expect(screen.getByText('Toast 6')).toBeInTheDocument();
      expect(screen.getByText('Toast 10')).toBeInTheDocument();
      expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    });
  });

  describe('Standalone toast functions', () => {
    it('warns when handler not set', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      toast.success('Test');

      // Logger outputs formatted message with timestamp and level
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Toast handler not initialized')
      );
      consoleSpy.mockRestore();
    });

    it('works when handler is set', () => {
      let capturedToast: unknown = null;

      setToastHandler((t) => {
        capturedToast = t;
        return 'test-id';
      });

      const id = toast.success('Standalone toast');

      expect(id).toBe('test-id');
      expect(capturedToast).toMatchObject({
        type: 'success',
        message: 'Standalone toast',
      });
    });
  });

  describe('Toast messages (Ukrainian)', () => {
    beforeEach(() => {
      setToastHandler(() => 'test-id');
    });

    it('has saved message', () => {
      const spy = jest.spyOn(toast, 'success');
      toastMessages.saved();
      expect(spy).toHaveBeenCalledWith('Збережено успішно');
    });

    it('has error message', () => {
      const spy = jest.spyOn(toast, 'error');
      toastMessages.error();
      expect(spy).toHaveBeenCalledWith('Сталася помилка. Спробуйте ще раз');
    });

    it('has networkError message', () => {
      const spy = jest.spyOn(toast, 'error');
      toastMessages.networkError();
      expect(spy).toHaveBeenCalledWith("Помилка з'єднання. Перевірте інтернет");
    });

    it('has addedToCart message', () => {
      const spy = jest.spyOn(toast, 'success');
      toastMessages.addedToCart();
      expect(spy).toHaveBeenCalledWith('Товар додано до кошика');
    });

    it('has lowStock message with count', () => {
      const spy = jest.spyOn(toast, 'warning');
      toastMessages.lowStock(5);
      expect(spy).toHaveBeenCalledWith('Залишилось лише 5 одиниць товару');
    });
  });

  describe('Position variants', () => {
    it('renders in different positions', () => {
      const positions = [
        'top-right',
        'top-left',
        'bottom-right',
        'bottom-left',
        'top-center',
        'bottom-center',
      ] as const;

      positions.forEach((position) => {
        const { unmount } = render(
          <ToastProvider position={position}>
            <ToastTester />
          </ToastProvider>
        );

        fireEvent.click(screen.getByText('Show Success'));

        const container = screen.getByRole('region', { name: 'Сповіщення' });
        expect(container).toBeInTheDocument();

        unmount();
      });
    });
  });
});
