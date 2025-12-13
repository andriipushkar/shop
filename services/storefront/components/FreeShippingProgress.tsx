'use client';

import { TruckIcon, CheckCircleIcon, GiftIcon } from '@heroicons/react/24/outline';

export interface FreeShippingProgressProps {
  cartTotal: number;
  threshold?: number;
  className?: string;
  variant?: 'bar' | 'compact' | 'banner';
}

const DEFAULT_FREE_SHIPPING_THRESHOLD = 2000; // 2000 UAH

/**
 * Free Shipping Progress Component
 * Shows progress towards free shipping threshold
 */
export default function FreeShippingProgress({
  cartTotal,
  threshold = DEFAULT_FREE_SHIPPING_THRESHOLD,
  className = '',
  variant = 'bar',
}: FreeShippingProgressProps) {
  const remaining = Math.max(0, threshold - cartTotal);
  const progress = Math.min(100, (cartTotal / threshold) * 100);
  const isFree = cartTotal >= threshold;

  if (variant === 'compact') {
    return (
      <CompactVariant
        remaining={remaining}
        isFree={isFree}
        threshold={threshold}
        className={className}
      />
    );
  }

  if (variant === 'banner') {
    return (
      <BannerVariant
        remaining={remaining}
        isFree={isFree}
        progress={progress}
        className={className}
      />
    );
  }

  // Default bar variant
  return (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 ${className}`}>
      {isFree ? (
        <div className="flex items-center gap-3 text-green-600">
          <CheckCircleIcon className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-medium">Безкоштовна доставка!</p>
            <p className="text-sm text-gray-500">Ваше замовлення буде доставлено безкоштовно</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <TruckIcon className="w-5 h-5" />
              <span className="font-medium">
                До безкоштовної доставки
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {cartTotal.toLocaleString('uk-UA')} / {threshold.toLocaleString('uk-UA')} ₴
            </span>
          </div>

          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-400 to-teal-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
            {/* Milestone markers */}
            <div className="absolute inset-0 flex justify-between px-1">
              {[25, 50, 75].map(milestone => (
                <div
                  key={milestone}
                  className={`w-0.5 h-full ${
                    progress >= milestone ? 'bg-white/50' : 'bg-gray-300'
                  }`}
                  style={{ marginLeft: `${milestone}%` }}
                />
              ))}
            </div>
          </div>

          <p className="text-sm">
            Додайте ще{' '}
            <span className="font-semibold text-teal-600">
              {remaining.toLocaleString('uk-UA')} ₴
            </span>{' '}
            для безкоштовної доставки
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact variant for header/mini cart
 */
function CompactVariant({
  remaining,
  isFree,
  threshold,
  className,
}: {
  remaining: number;
  isFree: boolean;
  threshold: number;
  className: string;
}) {
  if (isFree) {
    return (
      <div className={`flex items-center gap-1.5 text-green-600 text-sm ${className}`}>
        <TruckIcon className="w-4 h-4" />
        <span>Безкоштовна доставка</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 text-gray-600 text-sm ${className}`}>
      <TruckIcon className="w-4 h-4" />
      <span>
        Ще <span className="font-medium text-teal-600">{remaining.toLocaleString('uk-UA')} ₴</span> до безкоштовної
      </span>
    </div>
  );
}

/**
 * Banner variant for top of page
 */
function BannerVariant({
  remaining,
  isFree,
  progress,
  className,
}: {
  remaining: number;
  isFree: boolean;
  progress: number;
  className: string;
}) {
  if (isFree) {
    return (
      <div className={`bg-green-50 border-b border-green-100 py-2 px-4 ${className}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-green-700">
          <GiftIcon className="w-5 h-5" />
          <span className="font-medium">Вітаємо! Ви отримали безкоштовну доставку!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-teal-50 to-blue-50 border-b border-teal-100 py-2 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-3">
          <TruckIcon className="w-5 h-5 text-teal-600" />
          <span className="text-sm">
            Додайте ще{' '}
            <span className="font-bold text-teal-600">{remaining.toLocaleString('uk-UA')} ₴</span>{' '}
            для безкоштовної доставки
          </span>
          <div className="hidden sm:flex items-center gap-2 ml-4">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to get cart total from context
 */
export function useFreeShippingProgress(threshold = DEFAULT_FREE_SHIPPING_THRESHOLD) {
  // This should be connected to your cart context
  // For now returns mock data
  return {
    threshold,
    isFree: false,
    remaining: 0,
    progress: 0,
  };
}
