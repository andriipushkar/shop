/**
 * Toast Notifications
 * Context-based toast notification system
 */

'use client';

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  memo,
  type ReactNode,
} from 'react';
import { logger } from '@/lib/logger';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  // Convenience methods
  success: (message: string, options?: Partial<Toast>) => string;
  error: (message: string, options?: Partial<Toast>) => string;
  warning: (message: string, options?: Partial<Toast>) => string;
  info: (message: string, options?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Default durations by type
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

// Icons for each toast type
const ToastIcons: Record<ToastType, ReactNode> = {
  success: (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

// Styles for each toast type
const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

let toastIdCounter = 0;

function generateToastId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`;
}

/**
 * Individual Toast component
 */
const ToastItem = memo(function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type];
    if (duration <= 0) return;

    const startTime = Date.now();
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        handleDismiss();
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [toast.duration, toast.type, handleDismiss]);

  return (
    <div
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transform transition-all duration-200 ease-out
        ${toastStyles[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${iconStyles[toast.type]}`}>
        {ToastIcons[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-sm mb-1">{toast.title}</p>
        )}
        <p className="text-sm">{toast.message}</p>

        {/* Action button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 text-sm font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {(toast.dismissible !== false) && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Закрити"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      {/* Progress bar */}
      {(toast.duration ?? DEFAULT_DURATIONS[toast.type]) > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 rounded-b-lg overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ${
              toast.type === 'success' ? 'bg-green-500' :
              toast.type === 'error' ? 'bg-red-500' :
              toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
});

/**
 * Toast Container - renders all toasts
 */
const ToastContainer = memo(function ToastContainer({
  toasts,
  onDismiss,
  position = 'top-right',
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}) {
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-50 ${positionClasses[position]} flex flex-col gap-2 w-full max-w-sm`}
      role="region"
      aria-label="Сповіщення"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
});

/**
 * Toast Provider
 */
export function ToastProvider({
  children,
  position = 'top-right',
  maxToasts = 5,
}: {
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxToasts?: number;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = generateToastId();
      const newToast: Toast = { ...toast, id };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Remove oldest toasts if exceeding max
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [maxToasts]
  );

  const success = useCallback(
    (message: string, options?: Partial<Toast>) =>
      addToast({ type: 'success', message, ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<Toast>) =>
      addToast({ type: 'error', message, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Toast>) =>
      addToast({ type: 'warning', message, ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<Toast>) =>
      addToast({ type: 'info', message, ...options }),
    [addToast]
  );

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} position={position} />
    </ToastContext.Provider>
  );
}

/**
 * useToast hook
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
}

// Standalone toast functions for use outside React
let standaloneAddToast: ((toast: Omit<Toast, 'id'>) => string) | null = null;

export function setToastHandler(handler: (toast: Omit<Toast, 'id'>) => string) {
  standaloneAddToast = handler;
}

export const toast = {
  success: (message: string, options?: Partial<Toast>) => {
    if (standaloneAddToast) {
      return standaloneAddToast({ type: 'success', message, ...options });
    }
    logger.warn('Toast handler not initialized');
    return '';
  },
  error: (message: string, options?: Partial<Toast>) => {
    if (standaloneAddToast) {
      return standaloneAddToast({ type: 'error', message, ...options });
    }
    logger.warn('Toast handler not initialized');
    return '';
  },
  warning: (message: string, options?: Partial<Toast>) => {
    if (standaloneAddToast) {
      return standaloneAddToast({ type: 'warning', message, ...options });
    }
    logger.warn('Toast handler not initialized');
    return '';
  },
  info: (message: string, options?: Partial<Toast>) => {
    if (standaloneAddToast) {
      return standaloneAddToast({ type: 'info', message, ...options });
    }
    logger.warn('Toast handler not initialized');
    return '';
  },
};

// Common toast messages in Ukrainian
export const toastMessages = {
  // Success
  saved: () => toast.success('Збережено успішно'),
  created: () => toast.success('Створено успішно'),
  deleted: () => toast.success('Видалено успішно'),
  updated: () => toast.success('Оновлено успішно'),
  copied: () => toast.success('Скопійовано в буфер обміну'),
  sent: () => toast.success('Надіслано успішно'),
  addedToCart: () => toast.success('Товар додано до кошика'),
  addedToWishlist: () => toast.success('Товар додано до списку бажань'),
  orderPlaced: () => toast.success('Замовлення оформлено успішно'),

  // Error
  error: () => toast.error('Сталася помилка. Спробуйте ще раз'),
  networkError: () => toast.error('Помилка з\'єднання. Перевірте інтернет'),
  unauthorized: () => toast.error('Необхідна авторизація'),
  forbidden: () => toast.error('Доступ заборонено'),
  notFound: () => toast.error('Не знайдено'),
  validationError: (field?: string) =>
    toast.error(field ? `Помилка валідації: ${field}` : 'Перевірте правильність введених даних'),
  serverError: () => toast.error('Помилка сервера. Спробуйте пізніше'),

  // Warning
  sessionExpiring: () =>
    toast.warning('Ваша сесія скоро закінчиться', {
      action: { label: 'Продовжити', onClick: () => {} },
    }),
  unsavedChanges: () =>
    toast.warning('У вас є незбережені зміни'),
  lowStock: (count: number) =>
    toast.warning(`Залишилось лише ${count} одиниць товару`),

  // Info
  loading: () => toast.info('Завантаження...', { duration: 0 }),
  processing: () => toast.info('Обробка...', { duration: 0 }),
  redirecting: () => toast.info('Перенаправлення...'),
};

export default ToastProvider;
