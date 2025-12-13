/**
 * Optimized Image Component
 * Wrapper around Next.js Image with performance optimizations
 */

'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback, memo } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackSrc?: string;
  aspectRatio?: string;
  showSkeleton?: boolean;
  wrapperClassName?: string;
  onLoadComplete?: () => void;
  onError?: () => void;
}

/**
 * Default fallback image
 */
const DEFAULT_FALLBACK = '/images/placeholder.svg';

/**
 * Optimized Image component with loading skeleton and error fallback
 */
export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  fallbackSrc = DEFAULT_FALLBACK,
  aspectRatio,
  showSkeleton = true,
  wrapperClassName = '',
  className = '',
  onLoadComplete,
  onError,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoadComplete?.();
  }, [onLoadComplete]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    }
    onError?.();
  }, [currentSrc, fallbackSrc, onError]);

  const wrapperStyle: React.CSSProperties = aspectRatio
    ? { aspectRatio, position: 'relative' }
    : { position: 'relative' };

  return (
    <div className={`overflow-hidden ${wrapperClassName}`} style={wrapperStyle}>
      {/* Loading skeleton */}
      {showSkeleton && isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      <Image
        {...props}
        src={hasError ? fallbackSrc : currentSrc}
        alt={alt}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
});

/**
 * Product Image with predefined sizes
 */
export const ProductImage = memo(function ProductImage({
  src,
  alt,
  size = 'medium',
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height'> & {
  size?: 'small' | 'medium' | 'large' | 'thumbnail';
}) {
  const sizes = {
    thumbnail: { width: 64, height: 64 },
    small: { width: 150, height: 150 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 },
  };

  const { width, height } = sizes[size];

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      aspectRatio="1/1"
      className={`object-cover ${className}`}
      {...props}
    />
  );
});

/**
 * Category Banner Image
 */
export const BannerImage = memo(function BannerImage({
  src,
  alt,
  className = '',
  priority = false,
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height' | 'fill'>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      priority={priority}
      className={`object-cover ${className}`}
      sizes="100vw"
      {...props}
    />
  );
});

/**
 * Avatar Image
 */
export const AvatarImage = memo(function AvatarImage({
  src,
  alt,
  size = 40,
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height'> & {
  size?: number;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      fallbackSrc="/images/avatar-placeholder.svg"
      {...props}
    />
  );
});

/**
 * Gallery Image with zoom support
 */
export const GalleryImage = memo(function GalleryImage({
  src,
  alt,
  className = '',
  onZoom,
  ...props
}: Omit<OptimizedImageProps, 'fill'> & {
  onZoom?: () => void;
}) {
  return (
    <div
      className={`relative cursor-zoom-in ${className}`}
      onClick={onZoom}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        {...props}
      />
    </div>
  );
});

/**
 * Responsive Image with srcset
 */
export const ResponsiveImage = memo(function ResponsiveImage({
  src,
  alt,
  className = '',
  ...props
}: Omit<OptimizedImageProps, 'width' | 'height' | 'fill'>) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill
      className={`object-cover ${className}`}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      {...props}
    />
  );
});

/**
 * Lazy Image - loads only when in viewport
 */
export const LazyImage = memo(function LazyImage({
  src,
  alt,
  className = '',
  ...props
}: OptimizedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      {...props}
    />
  );
});

/**
 * Preload critical images
 */
export function preloadImage(src: string): void {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  }
}

/**
 * Get optimized image URL with parameters
 */
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'auto';
  } = {}
): string {
  const { width, height, quality = 75, format = 'auto' } = options;

  // If it's already an optimized URL or external CDN, return as is
  if (src.startsWith('/_next/') || src.includes('cdn.')) {
    return src;
  }

  // Build Next.js image optimization URL
  const params = new URLSearchParams();
  params.set('url', src);
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  params.set('q', quality.toString());

  return `/_next/image?${params.toString()}`;
}

/**
 * Image placeholder generator
 */
export function generatePlaceholder(
  width: number,
  height: number,
  color: string = '#e5e7eb'
): string {
  // Return a simple SVG data URL
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="${color}" width="100%" height="100%"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Blur data URL generator for placeholder
 */
export function generateBlurDataUrl(color: string = '#e5e7eb'): string {
  // Minimal blur placeholder
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 5"><rect fill="${color}" width="8" height="5"/></svg>`
  ).toString('base64')}`;
}

export default OptimizedImage;
