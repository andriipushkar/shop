// Prefetching and preloading utilities

type PrefetchPriority = 'high' | 'low' | 'auto';

interface PrefetchOptions {
    priority?: PrefetchPriority;
    as?: 'document' | 'script' | 'style' | 'image' | 'font' | 'fetch';
    crossOrigin?: 'anonymous' | 'use-credentials';
}

// Prefetch a URL
export function prefetch(url: string, options: PrefetchOptions = {}) {
    if (typeof document === 'undefined') return;

    // Check if already prefetched
    const existing = document.querySelector(`link[href="${url}"][rel="prefetch"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;

    if (options.as) link.as = options.as;
    if (options.crossOrigin) link.crossOrigin = options.crossOrigin;

    document.head.appendChild(link);
}

// Preload a resource (higher priority than prefetch)
export function preload(url: string, options: PrefetchOptions = {}) {
    if (typeof document === 'undefined') return;

    const existing = document.querySelector(`link[href="${url}"][rel="preload"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;

    if (options.as) link.as = options.as;
    if (options.crossOrigin) link.crossOrigin = options.crossOrigin;

    document.head.appendChild(link);
}

// Preconnect to a domain
export function preconnect(url: string, crossOrigin: boolean = false) {
    if (typeof document === 'undefined') return;

    const existing = document.querySelector(`link[href="${url}"][rel="preconnect"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = url;
    if (crossOrigin) link.crossOrigin = 'anonymous';

    document.head.appendChild(link);
}

// DNS prefetch
export function dnsPrefetch(url: string) {
    if (typeof document === 'undefined') return;

    const existing = document.querySelector(`link[href="${url}"][rel="dns-prefetch"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = url;

    document.head.appendChild(link);
}

// Prefetch on hover (for links)
export function createHoverPrefetcher(delay: number = 100) {
    const prefetchedUrls = new Set<string>();
    let timeoutId: NodeJS.Timeout | null = null;

    return {
        onMouseEnter(url: string) {
            if (prefetchedUrls.has(url)) return;

            timeoutId = setTimeout(() => {
                prefetch(url, { as: 'document' });
                prefetchedUrls.add(url);
            }, delay);
        },

        onMouseLeave() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        },

        reset() {
            prefetchedUrls.clear();
        },
    };
}

// Prefetch based on viewport visibility
export function createVisibilityPrefetcher(rootMargin: string = '200px') {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return null;
    }

    const prefetchedUrls = new Set<string>();

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const link = entry.target as HTMLAnchorElement;
                    const url = link.href;

                    if (!prefetchedUrls.has(url)) {
                        prefetch(url, { as: 'document' });
                        prefetchedUrls.add(url);
                    }

                    observer.unobserve(link);
                }
            });
        },
        { rootMargin }
    );

    return {
        observe(element: HTMLAnchorElement) {
            observer.observe(element);
        },

        unobserve(element: HTMLAnchorElement) {
            observer.unobserve(element);
        },

        disconnect() {
            observer.disconnect();
        },
    };
}

// Predictive prefetching based on user behavior
export function createPredictivePrefetcher() {
    const clickCounts: Map<string, number> = new Map();
    const prefetchThreshold = 3;

    return {
        recordClick(url: string) {
            const count = (clickCounts.get(url) || 0) + 1;
            clickCounts.set(url, count);

            // Save to localStorage for persistence
            if (typeof localStorage !== 'undefined') {
                try {
                    const saved = JSON.parse(localStorage.getItem('prefetchData') || '{}');
                    saved[url] = count;
                    localStorage.setItem('prefetchData', JSON.stringify(saved));
                } catch {
                    // Ignore localStorage errors
                }
            }
        },

        getPredictedUrls(): string[] {
            let data: Record<string, number> = {};

            // Load from localStorage
            if (typeof localStorage !== 'undefined') {
                try {
                    data = JSON.parse(localStorage.getItem('prefetchData') || '{}');
                } catch {
                    // Ignore parse errors
                }
            }

            // Merge with current session
            clickCounts.forEach((count, url) => {
                data[url] = (data[url] || 0) + count;
            });

            // Return URLs above threshold, sorted by count
            return Object.entries(data)
                .filter(([, count]) => count >= prefetchThreshold)
                .sort(([, a], [, b]) => b - a)
                .map(([url]) => url)
                .slice(0, 10);
        },

        prefetchPredicted() {
            const urls = this.getPredictedUrls();
            urls.forEach((url) => prefetch(url, { as: 'document', priority: 'low' }));
        },
    };
}

// Module preloading for code splitting
export function preloadModule(moduleId: string) {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = moduleId;
    document.head.appendChild(link);
}

// Batch prefetching with requestIdleCallback
export function batchPrefetch(urls: string[], options: PrefetchOptions = {}) {
    if (typeof window === 'undefined') return;

    const prefetchNext = (index: number) => {
        if (index >= urls.length) return;

        if ('requestIdleCallback' in window) {
            (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
                prefetch(urls[index], options);
                prefetchNext(index + 1);
            });
        } else {
            setTimeout(() => {
                prefetch(urls[index], options);
                prefetchNext(index + 1);
            }, 100);
        }
    };

    prefetchNext(0);
}

// Critical resource hints for initial page load
export function addCriticalResourceHints() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;

    // Preconnect to API
    if (apiUrl) {
        const apiDomain = new URL(apiUrl).origin;
        preconnect(apiDomain, true);
    }

    // Preconnect to CDN
    if (cdnUrl) {
        preconnect(cdnUrl);
    }

    // Preconnect to analytics
    preconnect('https://www.google-analytics.com');
    preconnect('https://www.googletagmanager.com');

    // Preconnect to fonts
    preconnect('https://fonts.googleapis.com');
    preconnect('https://fonts.gstatic.com', true);
}
