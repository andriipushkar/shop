// Image optimization utilities

export interface ImageConfig {
    src: string;
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
}

// Generate optimized image URL
export function getOptimizedImageUrl(config: ImageConfig): string {
    const { src, width, height, quality = 80, format = 'webp' } = config;
    const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;

    // If using external CDN with image transformation
    if (cdnUrl && src.startsWith('/')) {
        const params = new URLSearchParams();
        if (width) params.set('w', width.toString());
        if (height) params.set('h', height.toString());
        params.set('q', quality.toString());
        params.set('f', format);

        return `${cdnUrl}${src}?${params.toString()}`;
    }

    // Return original for external URLs
    return src;
}

// Generate srcset for responsive images
export function generateSrcSet(
    src: string,
    widths: number[] = [320, 640, 768, 1024, 1280, 1920],
    quality: number = 80
): string {
    return widths
        .map((w) => `${getOptimizedImageUrl({ src, width: w, quality })} ${w}w`)
        .join(', ');
}

// Generate sizes attribute
export function generateSizes(breakpoints: { [key: string]: string }): string {
    return Object.entries(breakpoints)
        .map(([breakpoint, size]) => {
            if (breakpoint === 'default') return size;
            return `(min-width: ${breakpoint}) ${size}`;
        })
        .join(', ');
}

// Preload critical images
export function preloadImage(src: string, options?: { as?: string; type?: string }) {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = options?.as || 'image';
    link.href = src;
    if (options?.type) link.type = options.type;
    document.head.appendChild(link);
}

// Lazy load images with Intersection Observer
export function createImageObserver(
    onIntersect: (img: HTMLImageElement) => void,
    options: IntersectionObserverInit = {}
): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
        return null;
    }

    return new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target as HTMLImageElement;
                onIntersect(img);
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01,
        ...options,
    });
}

// Default image observer for lazy loading
let defaultObserver: IntersectionObserver | null = null;

export function getDefaultImageObserver(): IntersectionObserver | null {
    if (defaultObserver) return defaultObserver;

    defaultObserver = createImageObserver((img) => {
        const dataSrc = img.dataset.src;
        const dataSrcset = img.dataset.srcset;

        if (dataSrc) {
            img.src = dataSrc;
            delete img.dataset.src;
        }
        if (dataSrcset) {
            img.srcset = dataSrcset;
            delete img.dataset.srcset;
        }
        img.classList.remove('lazy');
        img.classList.add('lazy-loaded');
    });

    return defaultObserver;
}

// Generate blur placeholder data URL
export function generateBlurDataUrl(width: number = 10, height: number = 10): string {
    const shimmer = `
        <svg width="${width}" height="${height}" version="1.1" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="#f3f4f6"/>
            <rect id="r" width="${width}" height="${height}" fill="url(#g)"/>
            <animate attributeName="x" from="-${width}" to="${width}" dur="1s" repeatCount="indefinite"/>
            <defs>
                <linearGradient id="g">
                    <stop stop-color="#f3f4f6" offset="0%"/>
                    <stop stop-color="#e5e7eb" offset="50%"/>
                    <stop stop-color="#f3f4f6" offset="100%"/>
                </linearGradient>
            </defs>
        </svg>
    `;

    return `data:image/svg+xml;base64,${
        typeof window !== 'undefined'
            ? window.btoa(shimmer)
            : Buffer.from(shimmer).toString('base64')
    }`;
}

// Image dimension calculator
export function calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth?: number,
    maxHeight?: number
): { width: number; height: number } {
    let width = originalWidth;
    let height = originalHeight;
    const aspectRatio = originalWidth / originalHeight;

    if (maxWidth && width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
    }

    if (maxHeight && height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    return {
        width: Math.round(width),
        height: Math.round(height),
    };
}

// Check WebP support
let webpSupported: boolean | null = null;

export async function supportsWebP(): Promise<boolean> {
    if (webpSupported !== null) return webpSupported;
    if (typeof document === 'undefined') return false;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            webpSupported = img.width > 0 && img.height > 0;
            resolve(webpSupported);
        };
        img.onerror = () => {
            webpSupported = false;
            resolve(false);
        };
        img.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
}

// Check AVIF support
let avifSupported: boolean | null = null;

export async function supportsAvif(): Promise<boolean> {
    if (avifSupported !== null) return avifSupported;
    if (typeof document === 'undefined') return false;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            avifSupported = img.width > 0 && img.height > 0;
            resolve(avifSupported);
        };
        img.onerror = () => {
            avifSupported = false;
            resolve(false);
        };
        img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABtYAAwKAClgAACoAmEB3BAAqAAAAAFQIcA==';
    });
}
