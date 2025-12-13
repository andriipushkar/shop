// Performance module exports
export * from './lazy-components';
export * from './image-optimization';
export * from './prefetch';

// Web Vitals tracking
export interface WebVitalsMetric {
    id: string;
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    entries: PerformanceEntry[];
}

export function reportWebVitals(metric: WebVitalsMetric) {
    // Send to analytics
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', metric.name, {
            event_category: 'Web Vitals',
            event_label: metric.id,
            value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            non_interaction: true,
        });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
    }
}

// Performance budget checker
export interface PerformanceBudget {
    FCP: number; // First Contentful Paint (ms)
    LCP: number; // Largest Contentful Paint (ms)
    FID: number; // First Input Delay (ms)
    CLS: number; // Cumulative Layout Shift
    TTFB: number; // Time to First Byte (ms)
    bundleSize: number; // Max bundle size (KB)
}

const defaultBudget: PerformanceBudget = {
    FCP: 1800,
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
    TTFB: 800,
    bundleSize: 300,
};

export function checkPerformanceBudget(
    metric: WebVitalsMetric,
    budget: PerformanceBudget = defaultBudget
): boolean {
    const threshold = budget[metric.name as keyof PerformanceBudget];
    if (threshold === undefined) return true;

    return metric.value <= threshold;
}

// Resource timing analysis
export function analyzeResourceTiming(): {
    totalSize: number;
    totalDuration: number;
    byType: Record<string, { count: number; size: number; duration: number }>;
} {
    if (typeof window === 'undefined' || !window.performance) {
        return { totalSize: 0, totalDuration: 0, byType: {} };
    }

    const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const result = {
        totalSize: 0,
        totalDuration: 0,
        byType: {} as Record<string, { count: number; size: number; duration: number }>,
    };

    resources.forEach((resource) => {
        const type = getResourceType(resource.initiatorType);
        const size = resource.transferSize || 0;
        const duration = resource.duration;

        result.totalSize += size;
        result.totalDuration += duration;

        if (!result.byType[type]) {
            result.byType[type] = { count: 0, size: 0, duration: 0 };
        }

        result.byType[type].count++;
        result.byType[type].size += size;
        result.byType[type].duration += duration;
    });

    return result;
}

function getResourceType(initiatorType: string): string {
    const typeMap: Record<string, string> = {
        script: 'JavaScript',
        link: 'CSS',
        img: 'Images',
        fetch: 'API',
        xmlhttprequest: 'API',
        font: 'Fonts',
        other: 'Other',
    };

    return typeMap[initiatorType] || 'Other';
}

// Memory usage monitoring
export function getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if (typeof window === 'undefined') return null;

    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!memory) return null;

    return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
    };
}

// Long task detection
export function observeLongTasks(callback: (duration: number) => void): (() => void) | null {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
        return null;
    }

    try {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.duration > 50) {
                    callback(entry.duration);
                }
            });
        });

        observer.observe({ entryTypes: ['longtask'] });

        return () => observer.disconnect();
    } catch {
        return null;
    }
}

// Frame rate monitoring
export function monitorFrameRate(callback: (fps: number) => void, interval: number = 1000): () => void {
    if (typeof window === 'undefined') return () => {};

    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const countFrame = () => {
        frameCount++;
        rafId = requestAnimationFrame(countFrame);
    };

    const reportFps = () => {
        const now = performance.now();
        const elapsed = now - lastTime;
        const fps = Math.round((frameCount * 1000) / elapsed);

        callback(fps);

        frameCount = 0;
        lastTime = now;
    };

    rafId = requestAnimationFrame(countFrame);
    const intervalId = setInterval(reportFps, interval);

    return () => {
        cancelAnimationFrame(rafId);
        clearInterval(intervalId);
    };
}

// Initialize performance monitoring
export function initPerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // Add critical resource hints
    import('./prefetch').then(({ addCriticalResourceHints }) => {
        addCriticalResourceHints();
    });

    // Observe long tasks
    observeLongTasks((duration) => {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[Performance] Long task detected: ${duration}ms`);
        }
    });
}
