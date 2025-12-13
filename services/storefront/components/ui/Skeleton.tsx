/**
 * Skeleton Loaders
 * Placeholder loading components for better UX
 */

'use client';

import { memo } from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animate?: boolean;
}

/**
 * Base skeleton component
 */
export const Skeleton = memo(function Skeleton({
  className = '',
  width,
  height,
  rounded = 'md',
  animate = true,
}: SkeletonProps) {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`bg-gray-200 ${roundedClasses[rounded]} ${animate ? 'animate-pulse' : ''} ${className}`}
      style={style}
    />
  );
});

/**
 * Text line skeleton
 */
export const SkeletonText = memo(function SkeletonText({
  lines = 1,
  className = '',
  lastLineWidth = '75%',
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          rounded="sm"
        />
      ))}
    </div>
  );
});

/**
 * Avatar skeleton
 */
export const SkeletonAvatar = memo(function SkeletonAvatar({
  size = 40,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      rounded="full"
      className={className}
    />
  );
});

/**
 * Button skeleton
 */
export const SkeletonButton = memo(function SkeletonButton({
  width = 100,
  height = 40,
  className = '',
}: {
  width?: number | string;
  height?: number;
  className?: string;
}) {
  return (
    <Skeleton
      width={width}
      height={height}
      rounded="md"
      className={className}
    />
  );
});

/**
 * Image skeleton
 */
export const SkeletonImage = memo(function SkeletonImage({
  width,
  height,
  aspectRatio,
  className = '',
}: {
  width?: number | string;
  height?: number | string;
  aspectRatio?: string;
  className?: string;
}) {
  const style: React.CSSProperties = {};
  if (aspectRatio) style.aspectRatio = aspectRatio;

  return (
    <Skeleton
      width={width || '100%'}
      height={height}
      rounded="lg"
      className={`flex items-center justify-center ${className}`}
    />
  );
});

/**
 * Product card skeleton
 */
export const SkeletonProductCard = memo(function SkeletonProductCard({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      {/* Image */}
      <SkeletonImage aspectRatio="1/1" className="mb-4" />

      {/* Title */}
      <SkeletonText lines={2} className="mb-3" />

      {/* Price */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton width={80} height={24} rounded="sm" />
        <Skeleton width={60} height={16} rounded="sm" />
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={16} height={16} rounded="sm" />
        ))}
        <Skeleton width={30} height={14} rounded="sm" className="ml-2" />
      </div>

      {/* Button */}
      <SkeletonButton width="100%" height={36} />
    </div>
  );
});

/**
 * Product grid skeleton
 */
export const SkeletonProductGrid = memo(function SkeletonProductGrid({
  count = 8,
  columns = 4,
  className = '',
}: {
  count?: number;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </div>
  );
});

/**
 * Cart item skeleton
 */
export const SkeletonCartItem = memo(function SkeletonCartItem({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`flex gap-4 p-4 bg-white rounded-lg ${className}`}>
      {/* Image */}
      <SkeletonImage width={100} height={100} />

      {/* Content */}
      <div className="flex-1">
        <SkeletonText lines={2} className="mb-2" />
        <Skeleton width={60} height={20} rounded="sm" className="mb-2" />
        <div className="flex items-center gap-2">
          <Skeleton width={100} height={32} rounded="md" />
          <Skeleton width={80} height={24} rounded="sm" />
        </div>
      </div>

      {/* Remove button */}
      <Skeleton width={32} height={32} rounded="full" />
    </div>
  );
});

/**
 * Order item skeleton
 */
export const SkeletonOrderItem = memo(function SkeletonOrderItem({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <Skeleton width={150} height={20} rounded="sm" className="mb-2" />
          <Skeleton width={100} height={16} rounded="sm" />
        </div>
        <Skeleton width={80} height={24} rounded="full" />
      </div>

      <div className="flex gap-4 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonImage key={i} width={60} height={60} />
        ))}
      </div>

      <div className="flex justify-between items-center">
        <Skeleton width={100} height={20} rounded="sm" />
        <SkeletonButton width={120} height={36} />
      </div>
    </div>
  );
});

/**
 * Review skeleton
 */
export const SkeletonReview = memo(function SkeletonReview({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3 mb-3">
        <SkeletonAvatar size={40} />
        <div className="flex-1">
          <Skeleton width={120} height={18} rounded="sm" className="mb-1" />
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} width={14} height={14} rounded="sm" />
            ))}
            <Skeleton width={80} height={14} rounded="sm" className="ml-2" />
          </div>
        </div>
      </div>

      <SkeletonText lines={3} className="mb-3" />

      <div className="flex gap-2">
        <Skeleton width={100} height={28} rounded="md" />
        <Skeleton width={100} height={28} rounded="md" />
      </div>
    </div>
  );
});

/**
 * Table row skeleton
 */
export const SkeletonTableRow = memo(function SkeletonTableRow({
  columns = 5,
  className = '',
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton width={i === 0 ? 150 : '80%'} height={20} rounded="sm" />
        </td>
      ))}
    </tr>
  );
});

/**
 * Table skeleton
 */
export const SkeletonTable = memo(function SkeletonTable({
  rows = 5,
  columns = 5,
  className = '',
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm overflow-hidden ${className}`}>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <Skeleton width={80} height={16} rounded="sm" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * Stats card skeleton
 */
export const SkeletonStatsCard = memo(function SkeletonStatsCard({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 ${className}`}>
      <Skeleton width={100} height={16} rounded="sm" className="mb-2" />
      <Skeleton width={150} height={32} rounded="sm" className="mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton width={60} height={20} rounded="full" />
        <Skeleton width={80} height={14} rounded="sm" />
      </div>
    </div>
  );
});

/**
 * Dashboard skeleton
 */
export const SkeletonDashboard = memo(function SkeletonDashboard({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatsCard key={i} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <Skeleton width={150} height={20} rounded="sm" className="mb-4" />
          <Skeleton height={250} rounded="md" />
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <Skeleton width={150} height={20} rounded="sm" className="mb-4" />
          <Skeleton height={250} rounded="md" />
        </div>
      </div>

      {/* Table */}
      <SkeletonTable rows={5} columns={6} />
    </div>
  );
});

/**
 * Category filter skeleton
 */
export const SkeletonCategoryFilter = memo(function SkeletonCategoryFilter({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg p-4 ${className}`}>
      <Skeleton width={120} height={20} rounded="sm" className="mb-4" />

      {/* Price range */}
      <div className="mb-4">
        <Skeleton width={60} height={16} rounded="sm" className="mb-2" />
        <div className="flex gap-2">
          <Skeleton height={36} className="flex-1" rounded="md" />
          <Skeleton height={36} className="flex-1" rounded="md" />
        </div>
      </div>

      {/* Checkboxes */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <Skeleton width={18} height={18} rounded="sm" />
          <Skeleton width={100} height={16} rounded="sm" />
          <Skeleton width={30} height={14} rounded="sm" className="ml-auto" />
        </div>
      ))}
    </div>
  );
});

/**
 * Form skeleton
 */
export const SkeletonForm = memo(function SkeletonForm({
  fields = 4,
  className = '',
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton width={100} height={16} rounded="sm" className="mb-2" />
          <Skeleton height={40} rounded="md" />
        </div>
      ))}
      <SkeletonButton width="100%" height={44} />
    </div>
  );
});

/**
 * Product detail page skeleton
 */
export const SkeletonProductDetail = memo(function SkeletonProductDetail({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${className}`}>
      {/* Image gallery */}
      <div>
        <SkeletonImage aspectRatio="1/1" className="mb-4" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonImage key={i} width={80} height={80} />
          ))}
        </div>
      </div>

      {/* Details */}
      <div>
        <Skeleton width="60%" height={32} rounded="sm" className="mb-2" />
        <Skeleton width="40%" height={20} rounded="sm" className="mb-4" />

        {/* Rating */}
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={20} height={20} rounded="sm" />
          ))}
          <Skeleton width={80} height={16} rounded="sm" />
        </div>

        {/* Price */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton width={120} height={36} rounded="sm" />
          <Skeleton width={80} height={24} rounded="sm" />
          <Skeleton width={60} height={24} rounded="full" />
        </div>

        {/* Description */}
        <SkeletonText lines={4} className="mb-6" />

        {/* Options */}
        <div className="mb-6">
          <Skeleton width={80} height={16} rounded="sm" className="mb-2" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} width={60} height={36} rounded="md" />
            ))}
          </div>
        </div>

        {/* Quantity & Add to cart */}
        <div className="flex gap-4 mb-6">
          <Skeleton width={120} height={48} rounded="md" />
          <Skeleton className="flex-1" height={48} rounded="md" />
        </div>

        {/* Additional actions */}
        <div className="flex gap-4">
          <Skeleton width={150} height={40} rounded="md" />
          <Skeleton width={150} height={40} rounded="md" />
        </div>
      </div>
    </div>
  );
});

/**
 * Checkout page skeleton
 */
export const SkeletonCheckout = memo(function SkeletonCheckout({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${className}`}>
      {/* Form */}
      <div className="lg:col-span-2 space-y-6">
        {/* Contact */}
        <div className="bg-white rounded-lg p-6">
          <Skeleton width={150} height={24} rounded="sm" className="mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Skeleton width={80} height={16} rounded="sm" className="mb-2" />
              <Skeleton height={40} rounded="md" />
            </div>
            <div>
              <Skeleton width={80} height={16} rounded="sm" className="mb-2" />
              <Skeleton height={40} rounded="md" />
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-lg p-6">
          <Skeleton width={120} height={24} rounded="sm" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                <Skeleton width={20} height={20} rounded="full" />
                <Skeleton width={40} height={40} rounded="md" />
                <div className="flex-1">
                  <Skeleton width={120} height={18} rounded="sm" className="mb-1" />
                  <Skeleton width={80} height={14} rounded="sm" />
                </div>
                <Skeleton width={60} height={20} rounded="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-lg p-6">
          <Skeleton width={100} height={24} rounded="sm" className="mb-4" />
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} width={100} height={60} rounded="lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg p-6 h-fit">
        <Skeleton width={150} height={24} rounded="sm" className="mb-4" />

        {/* Items */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3 mb-4">
            <SkeletonImage width={60} height={60} />
            <div className="flex-1">
              <Skeleton width="80%" height={16} rounded="sm" className="mb-1" />
              <Skeleton width={60} height={14} rounded="sm" />
            </div>
            <Skeleton width={70} height={18} rounded="sm" />
          </div>
        ))}

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <Skeleton width={80} height={16} rounded="sm" />
            <Skeleton width={70} height={16} rounded="sm" />
          </div>
          <div className="flex justify-between">
            <Skeleton width={80} height={16} rounded="sm" />
            <Skeleton width={70} height={16} rounded="sm" />
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Skeleton width={80} height={20} rounded="sm" />
            <Skeleton width={100} height={24} rounded="sm" />
          </div>
        </div>

        <SkeletonButton width="100%" height={48} className="mt-4" />
      </div>
    </div>
  );
});

/**
 * Category page skeleton
 */
export const SkeletonCategoryPage = memo(function SkeletonCategoryPage({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`flex gap-6 ${className}`}>
      {/* Sidebar filters */}
      <div className="w-64 flex-shrink-0 hidden lg:block">
        <SkeletonCategoryFilter />
      </div>

      {/* Main content */}
      <div className="flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton width={200} height={32} rounded="sm" />
          <div className="flex gap-2">
            <Skeleton width={120} height={40} rounded="md" />
            <Skeleton width={100} height={40} rounded="md" />
          </div>
        </div>

        {/* Products */}
        <SkeletonProductGrid count={12} columns={4} />

        {/* Pagination */}
        <div className="flex justify-center mt-8 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width={40} height={40} rounded="md" />
          ))}
        </div>
      </div>
    </div>
  );
});

/**
 * Hero section skeleton
 */
export const SkeletonHero = memo(function SkeletonHero({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`bg-gray-100 rounded-2xl p-8 md:p-12 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <Skeleton width={120} height={28} rounded="full" className="mb-4" />
          <Skeleton width="90%" height={48} rounded="sm" className="mb-2" />
          <Skeleton width="70%" height={48} rounded="sm" className="mb-4" />
          <SkeletonText lines={2} className="mb-6" />
          <div className="flex gap-4">
            <SkeletonButton width={150} height={48} />
            <SkeletonButton width={120} height={48} />
          </div>
        </div>
        <SkeletonImage aspectRatio="1/1" />
      </div>
    </div>
  );
});

/**
 * Navigation skeleton
 */
export const SkeletonNavigation = memo(function SkeletonNavigation({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-4 ${className}`}>
      <Skeleton width={120} height={40} rounded="md" />
      <div className="flex gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={80} height={20} rounded="sm" />
        ))}
      </div>
      <div className="flex gap-4">
        <Skeleton width={200} height={40} rounded="full" />
        <Skeleton width={40} height={40} rounded="full" />
        <Skeleton width={40} height={40} rounded="full" />
      </div>
    </div>
  );
});

export default Skeleton;
