'use client';

import { FireIcon, ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder' | 'coming_soon';

export interface StockBadgeProps {
  stock: number;
  preorderDate?: string;
  comingSoonDate?: string;
  showCount?: boolean;
  lowStockThreshold?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Determine stock status based on quantity
 */
export function getStockStatus(
  stock: number,
  lowStockThreshold = 5,
  preorderDate?: string,
  comingSoonDate?: string
): StockStatus {
  if (comingSoonDate) return 'coming_soon';
  if (preorderDate) return 'preorder';
  if (stock <= 0) return 'out_of_stock';
  if (stock <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Stock Badge Component
 * Shows stock status with appropriate styling and urgency indicators
 */
export default function StockBadge({
  stock,
  preorderDate,
  comingSoonDate,
  showCount = true,
  lowStockThreshold = 5,
  size = 'md',
  className = '',
}: StockBadgeProps) {
  const status = getStockStatus(stock, lowStockThreshold, preorderDate, comingSoonDate);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const configs: Record<StockStatus, {
    bg: string;
    text: string;
    icon: React.ReactNode;
    label: string;
    animate?: boolean;
  }> = {
    in_stock: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      icon: <CheckCircleIcon className={iconSizes[size]} />,
      label: 'В наявності',
    },
    low_stock: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      icon: <FireIcon className={`${iconSizes[size]} text-orange-600`} />,
      label: showCount ? `Залишилось ${stock} шт!` : 'Закінчується',
      animate: true,
    },
    out_of_stock: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      icon: <ExclamationTriangleIcon className={iconSizes[size]} />,
      label: 'Немає в наявності',
    },
    preorder: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      icon: <ClockIcon className={iconSizes[size]} />,
      label: preorderDate ? `Передзамовлення (${formatDate(preorderDate)})` : 'Передзамовлення',
    },
    coming_soon: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      icon: <ClockIcon className={iconSizes[size]} />,
      label: comingSoonDate ? `Скоро у продажу (${formatDate(comingSoonDate)})` : 'Скоро у продажу',
    },
  };

  const config = configs[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${config.bg} ${config.text} ${sizeClasses[size]}
        ${config.animate ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

/**
 * Compact stock indicator for product cards
 */
export function StockIndicator({
  stock,
  lowStockThreshold = 5,
  className = '',
}: {
  stock: number;
  lowStockThreshold?: number;
  className?: string;
}) {
  if (stock <= 0) {
    return (
      <span className={`text-xs text-gray-500 ${className}`}>
        Немає в наявності
      </span>
    );
  }

  if (stock <= lowStockThreshold) {
    return (
      <span className={`text-xs text-orange-600 font-medium flex items-center gap-1 ${className}`}>
        <FireIcon className="w-3 h-3" />
        Залишилось {stock} шт
      </span>
    );
  }

  return (
    <span className={`text-xs text-green-600 ${className}`}>
      В наявності
    </span>
  );
}

/**
 * Stock progress bar for visual representation
 */
export function StockProgressBar({
  stock,
  maxStock = 100,
  lowStockThreshold = 5,
  className = '',
}: {
  stock: number;
  maxStock?: number;
  lowStockThreshold?: number;
  className?: string;
}) {
  const percentage = Math.min(100, (stock / maxStock) * 100);
  const isLow = stock <= lowStockThreshold && stock > 0;

  return (
    <div className={`w-full ${className}`}>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            stock <= 0
              ? 'bg-gray-400'
              : isLow
              ? 'bg-orange-500'
              : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isLow && (
        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
          <FireIcon className="w-3 h-3" />
          Швидко розкуповують!
        </p>
      )}
    </div>
  );
}

/**
 * Format date helper
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
  });
}
