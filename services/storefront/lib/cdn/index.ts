// CDN Configuration for Static Assets

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || '';

export interface ImageOptions {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

/**
 * Get CDN URL for an image with optional transformations
 */
export function getCdnImageUrl(path: string, options: ImageOptions = {}): string {
    if (!path) return '';

    // If already a full URL, return as-is (unless we want to proxy through CDN)
    if (path.startsWith('http://') || path.startsWith('https://')) {
        if (!CDN_URL) return path;
        // Optionally proxy external images through CDN
        return path;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // If no CDN configured, return local path
    if (!CDN_URL) {
        return normalizedPath;
    }

    // Build transformation parameters for image CDN (Cloudflare, imgix, etc.)
    const params = new URLSearchParams();

    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('f', options.format);
    if (options.fit) params.set('fit', options.fit);

    const queryString = params.toString();
    const cdnPath = `${CDN_URL}${normalizedPath}`;

    return queryString ? `${cdnPath}?${queryString}` : cdnPath;
}

/**
 * Get CDN URL for static assets (CSS, JS, fonts)
 */
export function getCdnStaticUrl(path: string): string {
    if (!path) return '';

    // If already a full URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    if (!CDN_URL) {
        return normalizedPath;
    }

    return `${CDN_URL}${normalizedPath}`;
}

/**
 * Product image URL helper with common sizes
 */
export function getProductImageUrl(
    imagePath: string,
    size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'medium'
): string {
    const sizeConfig: Record<string, ImageOptions> = {
        thumbnail: { width: 100, height: 100, quality: 80, fit: 'cover' },
        small: { width: 200, height: 200, quality: 80, fit: 'cover' },
        medium: { width: 400, height: 400, quality: 85, fit: 'cover' },
        large: { width: 800, height: 800, quality: 90, fit: 'contain' },
        original: {},
    };

    return getCdnImageUrl(imagePath, {
        ...sizeConfig[size],
        format: 'auto',
    });
}

/**
 * Category image URL helper
 */
export function getCategoryImageUrl(imagePath: string): string {
    return getCdnImageUrl(imagePath, {
        width: 300,
        height: 200,
        quality: 85,
        fit: 'cover',
        format: 'auto',
    });
}

/**
 * Banner image URL helper
 */
export function getBannerImageUrl(
    imagePath: string,
    type: 'hero' | 'sidebar' | 'mobile' = 'hero'
): string {
    const config: Record<string, ImageOptions> = {
        hero: { width: 1920, height: 600, quality: 85, fit: 'cover' },
        sidebar: { width: 400, height: 300, quality: 80, fit: 'cover' },
        mobile: { width: 768, height: 400, quality: 80, fit: 'cover' },
    };

    return getCdnImageUrl(imagePath, {
        ...config[type],
        format: 'auto',
    });
}

/**
 * Avatar image URL helper
 */
export function getAvatarUrl(imagePath: string | null | undefined, size: number = 100): string {
    if (!imagePath) {
        // Return default avatar
        return `/images/default-avatar.png`;
    }

    return getCdnImageUrl(imagePath, {
        width: size,
        height: size,
        quality: 80,
        fit: 'cover',
        format: 'auto',
    });
}

/**
 * Generate srcset for responsive images
 */
export function getSrcSet(imagePath: string, sizes: number[]): string {
    return sizes
        .map((width) => {
            const url = getCdnImageUrl(imagePath, { width, format: 'auto' });
            return `${url} ${width}w`;
        })
        .join(', ');
}

/**
 * Preload hints for critical images
 */
export function getPreloadHint(imagePath: string, options: ImageOptions = {}): {
    href: string;
    as: 'image';
    type?: string;
    imageSrcSet?: string;
    imageSizes?: string;
} {
    return {
        href: getCdnImageUrl(imagePath, options),
        as: 'image',
        type: 'image/webp',
    };
}

// Export CDN URL for direct use
export { CDN_URL };
