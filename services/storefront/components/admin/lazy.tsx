/**
 * Lazy Loading Admin Components
 * Dynamic imports for better code splitting
 */

'use client';

import dynamic from 'next/dynamic';
import { ComponentType, ReactNode } from 'react';
import { SkeletonDashboard, SkeletonTable, SkeletonForm, SkeletonStatsCard } from '@/components/ui/Skeleton';

/**
 * Loading component types
 */
type LoadingType = 'dashboard' | 'table' | 'form' | 'stats' | 'custom' | 'none';

/**
 * Get loading component by type
 */
function getLoadingComponent(type: LoadingType, customLoader?: ReactNode): () => ReactNode {
  switch (type) {
    case 'dashboard':
      return () => <SkeletonDashboard />;
    case 'table':
      return () => <SkeletonTable rows={10} columns={6} />;
    case 'form':
      return () => <SkeletonForm fields={6} />;
    case 'stats':
      return () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatsCard key={i} />
          ))}
        </div>
      );
    case 'custom':
      return () => <>{customLoader}</>;
    case 'none':
      return () => null;
    default:
      return () => <SkeletonDashboard />;
  }
}

/**
 * Create lazy component with specific loading state
 */
export function createLazyComponent<T extends ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  options: {
    loadingType?: LoadingType;
    customLoader?: ReactNode;
    ssr?: boolean;
  } = {}
): T {
  const { loadingType = 'dashboard', customLoader, ssr = false } = options;

  return dynamic(importFn, {
    loading: getLoadingComponent(loadingType, customLoader),
    ssr,
  }) as T;
}

// ==================== LAZY ADMIN COMPONENTS ====================

/**
 * Dashboard components
 */
export const LazyDashboardOverview = dynamic(
  () => import('@/app/admin/warehouse/analytics/page').then(mod => ({ default: mod.default })),
  { loading: () => <SkeletonDashboard />, ssr: false }
);

/**
 * Products management
 */
export const LazyProductsTable = dynamic(
  () => import('@/app/admin/products/page').then(mod => ({ default: mod.default })),
  { loading: () => <SkeletonTable rows={10} columns={6} />, ssr: false }
);

export const LazyProductForm = dynamic(
  () => import('@/app/admin/products/new/page').then(mod => ({ default: mod.default })),
  { loading: () => <SkeletonForm fields={8} />, ssr: false }
);

/**
 * Stock management
 */
export const LazyStockManagement = dynamic(
  () => import('@/app/admin/warehouse/stock/page').then(mod => ({ default: mod.default })),
  { loading: () => <SkeletonTable rows={10} columns={5} />, ssr: false }
);

/**
 * Orders management
 */
export const LazyOrdersTable = dynamic(
  () => Promise.resolve({ default: () => <div>Orders Table</div> }),
  { loading: () => <SkeletonTable rows={10} columns={7} />, ssr: false }
);

export const LazyOrderDetails = dynamic(
  () => Promise.resolve({ default: () => <div>Order Details</div> }),
  { loading: () => <SkeletonForm fields={6} />, ssr: false }
);

/**
 * Customers management
 */
export const LazyCustomersTable = dynamic(
  () => Promise.resolve({ default: () => <div>Customers Table</div> }),
  { loading: () => <SkeletonTable rows={10} columns={5} />, ssr: false }
);

/**
 * Analytics components
 */
export const LazyAnalyticsCharts = dynamic(
  () => Promise.resolve({ default: () => <div>Analytics Charts</div> }),
  { loading: () => <SkeletonDashboard />, ssr: false }
);

export const LazySalesReport = dynamic(
  () => Promise.resolve({ default: () => <div>Sales Report</div> }),
  { loading: () => <SkeletonTable rows={15} columns={6} />, ssr: false }
);

/**
 * Settings components
 */
export const LazySettingsForm = dynamic(
  () => Promise.resolve({ default: () => <div>Settings Form</div> }),
  { loading: () => <SkeletonForm fields={10} />, ssr: false }
);

// ==================== UTILITY HOOKS ====================

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for prefetching components on hover
 */
export function usePrefetch(importFn: () => Promise<unknown>) {
  const prefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (!prefetched.current) {
      prefetched.current = true;
      importFn().catch(() => {
        prefetched.current = false;
      });
    }
  }, [importFn]);

  return prefetch;
}

/**
 * Hook for lazy loading with intersection observer
 */
export function useLazyLoad(
  importFn: () => Promise<unknown>,
  options: IntersectionObserverInit = {}
) {
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || isLoaded) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          importFn().then(() => setIsLoaded(true));
          observer.disconnect();
        }
      },
      { rootMargin: '100px', ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [importFn, isLoaded, options]);

  return { ref, isLoaded };
}

/**
 * Wrapper component for lazy loading on scroll
 */
export function LazyLoadWrapper({
  importFn,
  fallback,
  children,
  className = '',
}: {
  importFn: () => Promise<unknown>;
  fallback: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { ref, isLoaded } = useLazyLoad(importFn);

  return (
    <div ref={ref} className={className}>
      {isLoaded ? children : fallback}
    </div>
  );
}

// ==================== PREFETCH HANDLERS ====================

/**
 * Prefetch admin routes based on navigation intent
 */
export function prefetchAdminRoute(route: string) {
  const prefetchMap: Record<string, () => Promise<unknown>> = {
    '/admin/dashboard': () => import('@/app/admin/warehouse/analytics/page'),
    '/admin/products': () => import('@/app/admin/products/page'),
    '/admin/products/new': () => import('@/app/admin/products/new/page'),
    '/admin/stock': () => import('@/app/admin/warehouse/stock/page'),
  };

  const prefetchFn = prefetchMap[route];
  if (prefetchFn) {
    prefetchFn().catch(() => {
      // Silently fail - prefetch is optimization only
    });
  }
}

/**
 * Prefetch on link hover
 */
export function PrefetchLink({
  href,
  children,
  className = '',
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
}) {
  const handleMouseEnter = useCallback(() => {
    prefetchAdminRoute(href);
  }, [href]);

  return (
    <a
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </a>
  );
}

export default {
  LazyDashboardOverview,
  LazyProductsTable,
  LazyProductForm,
  LazyStockManagement,
  LazyOrdersTable,
  LazyOrderDetails,
  LazyCustomersTable,
  LazyAnalyticsCharts,
  LazySalesReport,
  LazySettingsForm,
  createLazyComponent,
  usePrefetch,
  useLazyLoad,
  LazyLoadWrapper,
  prefetchAdminRoute,
  PrefetchLink,
};
