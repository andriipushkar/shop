/**
 * Cloudinary Client для завантаження та управління зображеннями
 *
 * Функціонал:
 * - Завантаження зображень з трансформаціями
 * - Генерація оптимізованих URLs
 * - Видалення зображень
 * - Автоматична оптимізація
 * - Responsive зображення
 */

import { createHash } from 'crypto';

// Типи для Cloudinary операцій
export interface CloudinaryUploadOptions {
  folder?: string;
  publicId?: string;
  tags?: string[];
  context?: Record<string, string>;
  transformation?: CloudinaryTransformation;
  uploadPreset?: string;
  format?: 'jpg' | 'png' | 'webp' | 'avif' | 'auto';
  quality?: number | 'auto' | 'auto:low' | 'auto:best';
}

export interface CloudinaryTransformation {
  width?: number;
  height?: number;
  crop?: 'scale' | 'fit' | 'limit' | 'fill' | 'thumb' | 'crop';
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west';
  quality?: number | 'auto';
  format?: string;
  effect?: string;
  radius?: number | 'max';
  background?: string;
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  resourceType: string;
  createdAt: string;
  etag: string;
}

export interface CloudinaryUrlOptions {
  transformation?: CloudinaryTransformation;
  secure?: boolean;
  format?: string;
  quality?: number | 'auto';
  responsive?: boolean;
}

// Конфігурація Cloudinary клієнта
class CloudinaryStorageClient {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private uploadPreset?: string;
  private baseUrl: string;
  private uploadUrl: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
    this.uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    this.baseUrl = `https://res.cloudinary.com/${this.cloudName}`;
    this.uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  }

  /**
   * Перевіряє чи налаштований Cloudinary
   */
  isConfigured(): boolean {
    return !!(this.cloudName && this.apiKey && this.apiSecret);
  }

  /**
   * Генерує підпис для API запитів
   */
  private generateSignature(params: Record<string, any>): string {
    // Сортуємо параметри
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // Генеруємо SHA-1 хеш
    const signature = createHash('sha1')
      .update(sortedParams + this.apiSecret)
      .digest('hex');

    return signature;
  }

  /**
   * Генерує timestamp для запиту
   */
  private generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Завантажує файл в Cloudinary
   */
  async upload(
    file: File | Buffer | string,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured. Please set credentials.');
    }

    try {
      // Готуємо form data
      const formData = new FormData();

      // Додаємо файл
      if (typeof file === 'string') {
        // URL або base64
        formData.append('file', file);
      } else if (file instanceof File) {
        formData.append('file', file);
      } else {
        // Buffer - конвертуємо в Blob
        const blob = new Blob([file]);
        formData.append('file', blob);
      }

      // Параметри для підпису
      const timestamp = this.generateTimestamp();
      const signatureParams: Record<string, any> = {
        timestamp,
      };

      // Додаємо опціональні параметри
      if (options.folder) {
        signatureParams.folder = options.folder;
        formData.append('folder', options.folder);
      }

      if (options.publicId) {
        signatureParams.public_id = options.publicId;
        formData.append('public_id', options.publicId);
      }

      if (options.tags) {
        signatureParams.tags = options.tags.join(',');
        formData.append('tags', options.tags.join(','));
      }

      if (options.context) {
        const context = Object.entries(options.context)
          .map(([k, v]) => `${k}=${v}`)
          .join('|');
        signatureParams.context = context;
        formData.append('context', context);
      }

      if (options.transformation) {
        const transformation = this.buildTransformationString(options.transformation);
        signatureParams.transformation = transformation;
        formData.append('transformation', transformation);
      }

      if (options.format) {
        signatureParams.format = options.format;
        formData.append('format', options.format);
      }

      if (options.quality) {
        signatureParams.quality = options.quality.toString();
        formData.append('quality', options.quality.toString());
      }

      // Використовуємо upload preset якщо є
      if (options.uploadPreset || this.uploadPreset) {
        formData.append('upload_preset', options.uploadPreset || this.uploadPreset!);
      } else {
        // Генеруємо підпис
        const signature = this.generateSignature(signatureParams);
        formData.append('signature', signature);
        formData.append('timestamp', timestamp.toString());
        formData.append('api_key', this.apiKey);
      }

      // Відправляємо запит
      const response = await fetch(this.uploadUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Upload failed');
      }

      const result = await response.json();

      return {
        publicId: result.public_id,
        url: result.url,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        resourceType: result.resource_type,
        createdAt: result.created_at,
        etag: result.etag,
      };
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error(`Failed to upload to Cloudinary: ${error}`);
    }
  }

  /**
   * Завантажує декілька файлів
   */
  async uploadMultiple(
    files: (File | Buffer | string)[],
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult[]> {
    const promises = files.map(file => this.upload(file, options));
    return Promise.all(promises);
  }

  /**
   * Будує рядок трансформації
   */
  private buildTransformationString(transformation: CloudinaryTransformation): string {
    const parts: string[] = [];

    if (transformation.width) parts.push(`w_${transformation.width}`);
    if (transformation.height) parts.push(`h_${transformation.height}`);
    if (transformation.crop) parts.push(`c_${transformation.crop}`);
    if (transformation.gravity) parts.push(`g_${transformation.gravity}`);
    if (transformation.quality) parts.push(`q_${transformation.quality}`);
    if (transformation.format) parts.push(`f_${transformation.format}`);
    if (transformation.effect) parts.push(`e_${transformation.effect}`);
    if (transformation.radius) parts.push(`r_${transformation.radius}`);
    if (transformation.background) parts.push(`b_${transformation.background}`);

    return parts.join(',');
  }

  /**
   * Генерує URL з трансформаціями
   */
  getUrl(publicId: string, options: CloudinaryUrlOptions = {}): string {
    const protocol = options.secure !== false ? 'https' : 'http';
    const baseUrl = `${protocol}://res.cloudinary.com/${this.cloudName}/image/upload`;

    const parts = ['image', 'upload'];

    // Додаємо трансформації
    if (options.transformation) {
      const transformation = this.buildTransformationString(options.transformation);
      parts.push(transformation);
    }

    // Додаємо quality
    if (options.quality) {
      parts.push(`q_${options.quality}`);
    }

    // Додаємо format
    if (options.format) {
      parts.push(`f_${options.format}`);
    }

    // Додаємо responsive
    if (options.responsive) {
      parts.push('w_auto', 'dpr_auto');
    }

    return `${baseUrl}/${parts.join('/')}/${publicId}`;
  }

  /**
   * Генерує оптимізований URL
   */
  getOptimizedUrl(
    publicId: string,
    width?: number,
    height?: number
  ): string {
    return this.getUrl(publicId, {
      transformation: {
        width,
        height,
        crop: 'limit',
        quality: 'auto',
        format: 'auto',
      },
      responsive: true,
    });
  }

  /**
   * Генерує responsive URLs для різних розмірів
   */
  getResponsiveUrls(
    publicId: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): Array<{ width: number; url: string }> {
    return sizes.map(width => ({
      width,
      url: this.getUrl(publicId, {
        transformation: {
          width,
          crop: 'limit',
          quality: 'auto',
          format: 'auto',
        },
      }),
    }));
  }

  /**
   * Видаляє зображення з Cloudinary
   */
  async delete(publicId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured.');
    }

    try {
      const timestamp = this.generateTimestamp();
      const signatureParams = {
        public_id: publicId,
        timestamp,
      };

      const signature = this.generateSignature(signatureParams);

      const formData = new FormData();
      formData.append('public_id', publicId);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', this.apiKey);

      const deleteUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;

      const response = await fetch(deleteUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Delete failed');
      }

      const result = await response.json();

      if (result.result !== 'ok') {
        throw new Error(`Delete failed: ${result.result}`);
      }
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
      throw new Error(`Failed to delete from Cloudinary: ${error}`);
    }
  }

  /**
   * Видаляє декілька зображень
   */
  async deleteMultiple(publicIds: string[]): Promise<void> {
    const promises = publicIds.map(id => this.delete(id));
    await Promise.all(promises);
  }

  /**
   * Генерує thumbnail URL
   */
  getThumbnailUrl(
    publicId: string,
    width: number = 200,
    height: number = 200
  ): string {
    return this.getUrl(publicId, {
      transformation: {
        width,
        height,
        crop: 'thumb',
        gravity: 'auto',
        quality: 'auto',
        format: 'auto',
      },
    });
  }

  /**
   * Генерує srcset для responsive images
   */
  generateSrcSet(
    publicId: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): string {
    return sizes
      .map(width => {
        const url = this.getUrl(publicId, {
          transformation: {
            width,
            crop: 'limit',
            quality: 'auto',
            format: 'auto',
          },
        });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  /**
   * Перетворює зображення в WebP
   */
  getWebPUrl(publicId: string, width?: number, height?: number): string {
    return this.getUrl(publicId, {
      transformation: {
        width,
        height,
        crop: 'limit',
        quality: 'auto',
      },
      format: 'webp',
    });
  }

  /**
   * Перетворює зображення в AVIF (next-gen формат)
   */
  getAvifUrl(publicId: string, width?: number, height?: number): string {
    return this.getUrl(publicId, {
      transformation: {
        width,
        height,
        crop: 'limit',
        quality: 'auto',
      },
      format: 'avif',
    });
  }

  /**
   * Застосовує blur effect для placeholder
   */
  getBlurredPlaceholder(publicId: string, blur: number = 2000): string {
    return this.getUrl(publicId, {
      transformation: {
        width: 100,
        quality: 'auto',
        effect: `blur:${blur}`,
      },
    });
  }
}

// Експортуємо singleton інстанс
export const cloudinaryClient = new CloudinaryStorageClient();
export default cloudinaryClient;
