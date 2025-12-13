/**
 * Advanced Image Optimization System
 *
 * Features:
 * - Automatic WebP/AVIF conversion
 * - Responsive image generation
 * - Lazy loading with Intersection Observer
 * - Blur placeholders (LQIP - Low Quality Image Placeholder)
 * - Image compression and resizing
 * - CDN integration
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface ImageOptimizationOptions {
  /**
   * Target width (maintains aspect ratio if height not specified)
   */
  width?: number;

  /**
   * Target height (maintains aspect ratio if width not specified)
   */
  height?: number;

  /**
   * Image quality (1-100)
   */
  quality?: number;

  /**
   * Output format
   */
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';

  /**
   * Generate blur placeholder
   */
  generatePlaceholder?: boolean;

  /**
   * Responsive sizes to generate
   */
  responsiveSizes?: number[];

  /**
   * Fit strategy
   */
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';

  /**
   * Position (for cover/contain)
   */
  position?: 'center' | 'top' | 'right' | 'bottom' | 'left';
}

export interface OptimizedImageResult {
  /**
   * Main optimized image path/URL
   */
  src: string;

  /**
   * WebP variant
   */
  webp?: string;

  /**
   * AVIF variant
   */
  avif?: string;

  /**
   * Responsive srcset
   */
  srcset?: string;

  /**
   * WebP srcset
   */
  webpSrcset?: string;

  /**
   * AVIF srcset
   */
  avifSrcset?: string;

  /**
   * Blur placeholder data URL
   */
  placeholder?: string;

  /**
   * Image width
   */
  width: number;

  /**
   * Image height
   */
  height: number;

  /**
   * Aspect ratio
   */
  aspectRatio: number;
}

/**
 * Image optimizer class
 */
export class ImageOptimizer {
  private cacheDir: string;
  private publicDir: string;

  constructor(cacheDir = '.next/cache/images', publicDir = 'public') {
    this.cacheDir = path.join(process.cwd(), cacheDir);
    this.publicDir = path.join(process.cwd(), publicDir);
  }

  /**
   * Optimize a single image
   */
  async optimize(
    inputPath: string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    const {
      width,
      height,
      quality = 80,
      format = 'auto',
      generatePlaceholder = true,
      responsiveSizes = [640, 768, 1024, 1280, 1920],
      fit = 'cover',
      position = 'center',
    } = options;

    // Ensure cache directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Load image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Could not read image dimensions');
    }

    // Calculate target dimensions
    const targetDimensions = this.calculateDimensions(
      metadata.width,
      metadata.height,
      width,
      height
    );

    // Generate cache key
    const cacheKey = this.generateCacheKey(inputPath, options);

    // Resize image
    const resized = image.resize({
      width: targetDimensions.width,
      height: targetDimensions.height,
      fit,
      position,
      withoutEnlargement: true,
    });

    // Determine output format
    const outputFormat = format === 'auto' ? this.detectFormat(metadata.format!) : format;

    // Generate main image
    const mainPath = path.join(
      this.cacheDir,
      `${cacheKey}.${outputFormat}`
    );
    await this.saveImage(resized, mainPath, outputFormat, quality);

    const result: OptimizedImageResult = {
      src: this.getPublicPath(mainPath),
      width: targetDimensions.width,
      height: targetDimensions.height,
      aspectRatio: targetDimensions.width / targetDimensions.height,
    };

    // Generate WebP variant
    if (outputFormat !== 'webp') {
      const webpPath = path.join(this.cacheDir, `${cacheKey}.webp`);
      await this.saveImage(resized, webpPath, 'webp', quality);
      result.webp = this.getPublicPath(webpPath);
    }

    // Generate AVIF variant
    if (outputFormat !== 'avif') {
      const avifPath = path.join(this.cacheDir, `${cacheKey}.avif`);
      await this.saveImage(resized, avifPath, 'avif', quality);
      result.avif = this.getPublicPath(avifPath);
    }

    // Generate responsive sizes
    if (responsiveSizes && responsiveSizes.length > 0) {
      const srcsets = await this.generateResponsiveSizes(
        inputPath,
        responsiveSizes,
        { ...options, generatePlaceholder: false }
      );

      result.srcset = srcsets.jpeg;
      result.webpSrcset = srcsets.webp;
      result.avifSrcset = srcsets.avif;
    }

    // Generate blur placeholder
    if (generatePlaceholder) {
      result.placeholder = await this.generateBlurPlaceholder(inputPath);
    }

    return result;
  }

  /**
   * Save image in specified format
   */
  private async saveImage(
    image: sharp.Sharp,
    outputPath: string,
    format: string,
    quality: number
  ): Promise<void> {
    let pipeline = image.clone();

    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ quality, effort: 6 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality, effort: 6 });
        break;
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality, compressionLevel: 9 });
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await pipeline.toFile(outputPath);
  }

  /**
   * Generate responsive sizes
   */
  private async generateResponsiveSizes(
    inputPath: string,
    sizes: number[],
    options: ImageOptimizationOptions
  ): Promise<{ jpeg: string; webp: string; avif: string }> {
    const jpegSrcset: string[] = [];
    const webpSrcset: string[] = [];
    const avifSrcset: string[] = [];

    for (const size of sizes) {
      const cacheKey = this.generateCacheKey(inputPath, { ...options, width: size });

      const image = sharp(inputPath);
      const resized = image.resize({ width: size, withoutEnlargement: true });

      // JPEG
      const jpegPath = path.join(this.cacheDir, `${cacheKey}.jpeg`);
      await this.saveImage(resized, jpegPath, 'jpeg', options.quality || 80);
      jpegSrcset.push(`${this.getPublicPath(jpegPath)} ${size}w`);

      // WebP
      const webpPath = path.join(this.cacheDir, `${cacheKey}.webp`);
      await this.saveImage(resized, webpPath, 'webp', options.quality || 80);
      webpSrcset.push(`${this.getPublicPath(webpPath)} ${size}w`);

      // AVIF
      const avifPath = path.join(this.cacheDir, `${cacheKey}.avif`);
      await this.saveImage(resized, avifPath, 'avif', options.quality || 80);
      avifSrcset.push(`${this.getPublicPath(avifPath)} ${size}w`);
    }

    return {
      jpeg: jpegSrcset.join(', '),
      webp: webpSrcset.join(', '),
      avif: avifSrcset.join(', '),
    };
  }

  /**
   * Generate blur placeholder (LQIP)
   */
  async generateBlurPlaceholder(inputPath: string): Promise<string> {
    const image = sharp(inputPath);

    // Resize to very small size for placeholder
    const buffer = await image
      .resize(10, 10, { fit: 'inside' })
      .blur(2)
      .jpeg({ quality: 20 })
      .toBuffer();

    // Convert to base64 data URL
    const base64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  }

  /**
   * Calculate dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth?: number,
    targetHeight?: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    if (targetWidth && targetHeight) {
      return { width: targetWidth, height: targetHeight };
    }

    if (targetWidth) {
      return {
        width: targetWidth,
        height: Math.round(targetWidth / aspectRatio),
      };
    }

    if (targetHeight) {
      return {
        width: Math.round(targetHeight * aspectRatio),
        height: targetHeight,
      };
    }

    return { width: originalWidth, height: originalHeight };
  }

  /**
   * Generate cache key based on input and options
   */
  private generateCacheKey(
    inputPath: string,
    options: ImageOptimizationOptions
  ): string {
    const hash = createHash('md5');
    hash.update(inputPath);
    hash.update(JSON.stringify(options));
    return hash.digest('hex');
  }

  /**
   * Get public path for cached image
   */
  private getPublicPath(filePath: string): string {
    return filePath.replace(process.cwd(), '').replace(/\\/g, '/');
  }

  /**
   * Detect best format based on source format
   */
  private detectFormat(sourceFormat: string): 'jpeg' | 'png' | 'webp' | 'avif' {
    const lowerFormat = sourceFormat.toLowerCase();

    // Preserve PNG for transparency
    if (lowerFormat === 'png') {
      return 'png';
    }

    // Default to WebP for best compatibility
    return 'webp';
  }
}

/**
 * Batch optimize multiple images
 */
export async function optimizeImageBatch(
  images: Array<{ input: string; output: string; options?: ImageOptimizationOptions }>
): Promise<OptimizedImageResult[]> {
  const optimizer = new ImageOptimizer();
  const results: OptimizedImageResult[] = [];

  for (const { input, options } of images) {
    try {
      const result = await optimizer.optimize(input, options);
      results.push(result);
    } catch (error) {
      console.error(`Failed to optimize ${input}:`, error);
    }
  }

  return results;
}

/**
 * Generate responsive image HTML
 */
export function generateResponsiveImageHTML(
  result: OptimizedImageResult,
  alt: string,
  sizes?: string
): string {
  const defaultSizes = sizes || '100vw';

  return `
<picture>
  ${result.avifSrcset ? `<source type="image/avif" srcset="${result.avifSrcset}" sizes="${defaultSizes}">` : ''}
  ${result.webpSrcset ? `<source type="image/webp" srcset="${result.webpSrcset}" sizes="${defaultSizes}">` : ''}
  <img
    src="${result.src}"
    srcset="${result.srcset || result.src}"
    sizes="${defaultSizes}"
    alt="${alt}"
    width="${result.width}"
    height="${result.height}"
    ${result.placeholder ? `style="background-image: url('${result.placeholder}'); background-size: cover;"` : ''}
    loading="lazy"
    decoding="async"
  >
</picture>
  `.trim();
}

/**
 * Lazy loading utilities
 */
export const LazyLoading = {
  /**
   * Create intersection observer for lazy loading
   */
  createObserver(
    callback: (element: Element) => void,
    options: IntersectionObserverInit = {}
  ): IntersectionObserver | null {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return null;
    }

    return new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.01,
        ...options,
      }
    );
  },

  /**
   * Initialize lazy loading for images
   */
  initLazyImages(selector = 'img[loading="lazy"]'): void {
    if (typeof window === 'undefined') return;

    // Use native lazy loading if supported
    if ('loading' in HTMLImageElement.prototype) {
      console.log('Using native lazy loading');
      return;
    }

    // Fallback to Intersection Observer
    const observer = this.createObserver((img) => {
      const element = img as HTMLImageElement;
      if (element.dataset.src) {
        element.src = element.dataset.src;
        delete element.dataset.src;
      }
      if (element.dataset.srcset) {
        element.srcset = element.dataset.srcset;
        delete element.dataset.srcset;
      }
    });

    if (observer) {
      document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => {
        observer.observe(img);
      });
    }
  },
};

/**
 * Export singleton optimizer instance
 */
export const imageOptimizer = new ImageOptimizer();

/**
 * Client-side utilities
 */
export const ClientImageUtils = {
  /**
   * Preload critical images
   */
  preloadImage(src: string, options?: { as?: string; type?: string }): void {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = options?.as || 'image';
    link.href = src;
    if (options?.type) link.type = options.type;
    document.head.appendChild(link);
  },

  /**
   * Check WebP support
   */
  async supportsWebP(): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);
      img.src =
        'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
  },

  /**
   * Check AVIF support
   */
  async supportsAVIF(): Promise<boolean> {
    if (typeof document === 'undefined') return false;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width > 0 && img.height > 0);
      img.onerror = () => resolve(false);
      img.src =
        'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABtYAAwKAClgAACoAmEB3BAAqAAAAAFQIcA==';
    });
  },
};

export default imageOptimizer;
