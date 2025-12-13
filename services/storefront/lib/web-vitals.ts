/**
 * Web Vitals tracking for Core Web Vitals monitoring
 * Tracks LCP, FID, CLS, FCP, TTFB metrics
 */

export interface WebVitalsMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Thresholds for Web Vitals ratings
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

/**
 * Get rating for a web vital metric
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS];
  if (!thresholds) return 'needs-improvement';

  if (value <= thresholds.good) return 'good';
  if (value > thresholds.poor) return 'poor';
  return 'needs-improvement';
}

/**
 * Report Web Vitals to analytics or console
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? '✅' : metric.rating === 'poor' ? '❌' : '⚠️';
    console.log(`${color} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
  }

  // Send to analytics endpoint
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      page: window.location.pathname,
      timestamp: Date.now(),
    });

    // Use sendBeacon for reliability
    if (navigator.sendBeacon) {
      navigator.sendBeacon(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, body);
    } else {
      fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // Silently fail - analytics should not block user experience
      });
    }
  }
}

/**
 * Initialize Web Vitals tracking
 */
export async function initWebVitals(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // Dynamically import web-vitals for code splitting
    // web-vitals v5 removed onFID in favor of onINP
    const webVitals = await import('web-vitals');

    // Track all Core Web Vitals
    if (webVitals.onCLS) {
      webVitals.onCLS((metric) => {
        reportWebVitals({
          name: 'CLS',
          value: metric.value,
          rating: getRating('CLS', metric.value),
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType || 'navigate',
        });
      });
    }

    if (webVitals.onFCP) {
      webVitals.onFCP((metric) => {
        reportWebVitals({
          name: 'FCP',
          value: metric.value,
          rating: getRating('FCP', metric.value),
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType || 'navigate',
        });
      });
    }

    if (webVitals.onLCP) {
      webVitals.onLCP((metric) => {
        reportWebVitals({
          name: 'LCP',
          value: metric.value,
          rating: getRating('LCP', metric.value),
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType || 'navigate',
        });
      });
    }

    if (webVitals.onTTFB) {
      webVitals.onTTFB((metric) => {
        reportWebVitals({
          name: 'TTFB',
          value: metric.value,
          rating: getRating('TTFB', metric.value),
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType || 'navigate',
        });
      });
    }

    if (webVitals.onINP) {
      webVitals.onINP((metric) => {
        reportWebVitals({
          name: 'INP',
          value: metric.value,
          rating: getRating('INP', metric.value),
          delta: metric.delta,
          id: metric.id,
          navigationType: metric.navigationType || 'navigate',
        });
      });
    }
  } catch (error) {
    // web-vitals might not be installed
    console.warn('Web Vitals tracking not available:', error);
  }
}

/**
 * Component to track Web Vitals in React
 * Usage: <WebVitalsTracker />
 */
export function useWebVitals(): void {
  if (typeof window !== 'undefined') {
    initWebVitals();
  }
}
