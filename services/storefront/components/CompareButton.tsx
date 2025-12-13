'use client';

import { useState, useEffect } from 'react';
import { comparisonService, ComparisonProduct } from '@/lib/comparison/comparison-service';

interface CompareButtonProps {
  product: ComparisonProduct;
  variant?: 'icon' | 'button' | 'icon-text';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * CompareButton Component
 * Allows users to add/remove products from comparison
 */
export default function CompareButton({
  product,
  variant = 'icon',
  className = '',
  size = 'md',
}: CompareButtonProps) {
  const [isInComparison, setIsInComparison] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [isDisabled, setIsDisabled] = useState(false);

  // Check if product is in comparison
  useEffect(() => {
    setIsInComparison(comparisonService.isInComparison(product.id));

    // Subscribe to comparison changes
    const unsubscribe = comparisonService.subscribe(() => {
      setIsInComparison(comparisonService.isInComparison(product.id));
      setIsDisabled(!comparisonService.canAddMore() && !isInComparison);
    });

    return unsubscribe;
  }, [product.id, isInComparison]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInComparison) {
      // Remove from comparison
      comparisonService.removeProduct(product.id);
      showTooltipMessage('Видалено з порівняння');
    } else {
      // Add to comparison
      const result = comparisonService.addProduct(product);

      if (result.success) {
        showTooltipMessage('Додано до порівняння');
      } else {
        showTooltipMessage(result.error || 'Помилка додавання');
      }
    }
  };

  const showTooltipMessage = (message: string) => {
    setTooltipMessage(message);
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  // Button size classes
  const buttonSizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  // Icon variant
  if (variant === 'icon') {
    return (
      <div className="relative inline-block">
        <button
          onClick={handleClick}
          disabled={isDisabled && !isInComparison}
          className={`
            ${sizeClasses[size]}
            rounded-full
            flex items-center justify-center
            transition-all duration-200
            ${
              isInComparison
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : isDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
            ${className}
          `}
          title={
            isInComparison
              ? 'Видалити з порівняння'
              : isDisabled
              ? 'Досягнуто максимум товарів'
              : 'Додати до порівняння'
          }
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 animate-fade-in">
            {tooltipMessage}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Icon + Text variant
  if (variant === 'icon-text') {
    return (
      <div className="relative inline-block">
        <button
          onClick={handleClick}
          disabled={isDisabled && !isInComparison}
          className={`
            ${buttonSizeClasses[size]}
            rounded-lg
            flex items-center gap-2
            transition-all duration-200
            ${
              isInComparison
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : isDisabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }
            ${className}
          `}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span>{isInComparison ? 'У порівнянні' : 'Порівняти'}</span>
        </button>

        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 animate-fade-in">
            {tooltipMessage}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full button variant
  return (
    <div className="relative inline-block w-full">
      <button
        onClick={handleClick}
        disabled={isDisabled && !isInComparison}
        className={`
          w-full
          ${buttonSizeClasses[size]}
          rounded-lg
          font-medium
          transition-all duration-200
          ${
            isInComparison
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : isDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }
          ${className}
        `}
      >
        {isInComparison ? 'Видалити з порівняння' : 'Додати до порівняння'}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap z-50 animate-fade-in">
          {tooltipMessage}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}
