'use client';

/**
 * Lazy Loading Components
 * Компоненти з відкладеним завантаженням
 */

import dynamic from 'next/dynamic';
import { ComponentType, Suspense } from 'react';

// Loading skeleton component
function LoadingSkeleton({ height = '200px' }: { height?: string }) {
    return (
        <div
            className="animate-pulse bg-gray-200 rounded-lg"
            style={{ height }}
        />
    );
}

// Generic loading wrapper
function LoadingWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
            {children}
        </div>
    );
}

// ============================================
// Lazy Loaded Components
// ============================================

// Chat Widget - завантажується тільки коли потрібен
export const LazyChatWidget = dynamic(
    () => import('@/components/chat/ChatWidget'),
    {
        loading: () => null, // Чат не показує лоадер
        ssr: false, // Чат тільки на клієнті
    }
);

// Product Reviews - завантажується при скролі до секції
export const LazyProductReviews = dynamic(
    () => import('@/components/ProductReviews'),
    {
        loading: () => <LoadingSkeleton height="400px" />,
    }
);

// Recently Viewed - низький пріоритет
export const LazyRecentlyViewed = dynamic(
    () => import('@/components/RecentlyViewed'),
    {
        loading: () => <LoadingSkeleton height="300px" />,
    }
);

// Nova Poshta Selector - завантажується тільки на сторінці checkout
export const LazyNovaPoshtaSelector = dynamic(
    () => import('@/components/NovaPoshtaSelector'),
    {
        loading: () => <LoadingSkeleton height="150px" />,
    }
);

// Payment Selector - завантажується тільки на сторінці checkout
export const LazyPaymentSelector = dynamic(
    () => import('@/components/PaymentSelector'),
    {
        loading: () => <LoadingSkeleton height="200px" />,
    }
);

// Social Share - низький пріоритет
export const LazySocialShare = dynamic(
    () => import('@/components/social-share'),
    {
        loading: () => <div className="h-10" />,
        ssr: false,
    }
);

// Search Filter - завантажується на сторінках каталогу
export const LazySearchFilter = dynamic(
    () => import('@/components/SearchFilter'),
    {
        loading: () => <LoadingSkeleton height="60px" />,
    }
);

// ============================================
// Admin Components (lazy loaded)
// ============================================

export const LazyBarcodeScanner = dynamic(
    () => import('@/app/admin/warehouse/components/BarcodeScanner'),
    {
        loading: () => <LoadingSkeleton height="300px" />,
        ssr: false, // Сканер тільки на клієнті
    }
);

// ============================================
// Heavy Libraries (lazy loaded)
// ============================================

// Charts - завантажується тільки коли потрібні графіки
export const LazyLineChart = dynamic(
    () => import('recharts').then((mod) => mod.LineChart as ComponentType<unknown>),
    {
        loading: () => <LoadingSkeleton height="300px" />,
        ssr: false,
    }
);

export const LazyBarChart = dynamic(
    () => import('recharts').then((mod) => mod.BarChart as ComponentType<unknown>),
    {
        loading: () => <LoadingSkeleton height="300px" />,
        ssr: false,
    }
);

export const LazyPieChart = dynamic(
    () => import('recharts').then((mod) => mod.PieChart as ComponentType<unknown>),
    {
        loading: () => <LoadingSkeleton height="300px" />,
        ssr: false,
    }
);

// ============================================
// Utility: Intersection Observer Hook
// ============================================

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInViewOptions {
    threshold?: number;
    rootMargin?: string;
    triggerOnce?: boolean;
}

export function useInView(options: UseInViewOptions = {}) {
    const { threshold = 0, rootMargin = '100px', triggerOnce = true } = options;
    const [isInView, setIsInView] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (hasTriggered && triggerOnce) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    if (triggerOnce) {
                        setHasTriggered(true);
                    }
                } else if (!triggerOnce) {
                    setIsInView(false);
                }
            },
            { threshold, rootMargin }
        );

        const currentRef = ref.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [threshold, rootMargin, triggerOnce, hasTriggered]);

    return { ref, isInView };
}

// ============================================
// Lazy Load Wrapper Component
// ============================================

interface LazyLoadProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    rootMargin?: string;
    threshold?: number;
    minHeight?: string;
}

export function LazyLoad({
    children,
    fallback,
    rootMargin = '200px',
    threshold = 0,
    minHeight = '100px',
}: LazyLoadProps) {
    const { ref, isInView } = useInView({ rootMargin, threshold, triggerOnce: true });

    return (
        <div ref={ref} style={{ minHeight: isInView ? 'auto' : minHeight }}>
            {isInView ? (
                <Suspense fallback={fallback || <LoadingSkeleton height={minHeight} />}>
                    {children}
                </Suspense>
            ) : (
                fallback || <LoadingSkeleton height={minHeight} />
            )}
        </div>
    );
}

// ============================================
// Preload utility
// ============================================

const preloadedComponents = new Set<string>();

export function preloadComponent(componentName: string) {
    if (preloadedComponents.has(componentName)) return;

    const preloaders: Record<string, () => Promise<unknown>> = {
        ChatWidget: () => import('@/components/chat/ChatWidget'),
        ProductReviews: () => import('@/components/ProductReviews'),
        RecentlyViewed: () => import('@/components/RecentlyViewed'),
        NovaPoshtaSelector: () => import('@/components/NovaPoshtaSelector'),
        PaymentSelector: () => import('@/components/PaymentSelector'),
    };

    const preloader = preloaders[componentName];
    if (preloader) {
        preloader();
        preloadedComponents.add(componentName);
    }
}

// Preload on idle
export function preloadOnIdle(componentNames: string[]) {
    if (typeof window === 'undefined') return;

    if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
            componentNames.forEach(preloadComponent);
        });
    } else {
        setTimeout(() => {
            componentNames.forEach(preloadComponent);
        }, 1000);
    }
}

// Preload on hover
export function usePreloadOnHover(componentName: string) {
    const handleMouseEnter = useCallback(() => {
        preloadComponent(componentName);
    }, [componentName]);

    return { onMouseEnter: handleMouseEnter };
}

export { LoadingSkeleton, LoadingWrapper };
