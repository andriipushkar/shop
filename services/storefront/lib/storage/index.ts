/**
 * Unified Storage Interface
 *
 * Автоматично вибирає провайдера (S3, Cloudinary або локальне сховище)
 * на основі конфігурації середовища
 *
 * Функціонал:
 * - Уніфікований API для різних провайдерів
 * - Автоматичний вибір провайдера
 * - Fallback до локального сховища
 * - Підтримка множинних завантажень
 */

import { s3Client } from './s3-client';
import { cloudinaryClient } from './cloudinary-client';
import type {
  S3UploadOptions,
  S3UploadResult,
  PresignedUrlOptions,
} from './s3-client';
import type {
  CloudinaryUploadOptions,
  CloudinaryUploadResult,
  CloudinaryUrlOptions,
} from './cloudinary-client';

// Типи провайдерів
export type StorageProvider = 's3' | 'cloudinary' | 'local';

// Уніфікований тип результату завантаження
export interface StorageUploadResult {
  id: string; // publicId для Cloudinary або key для S3
  url: string;
  secureUrl?: string;
  provider: StorageProvider;
  size: number;
  format?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
}

// Уніфіковані опції завантаження
export interface StorageUploadOptions {
  folder?: string;
  fileName?: string;
  contentType?: string;
  acl?: 'private' | 'public-read';
  tags?: string[];
  metadata?: Record<string, string>;
  transformation?: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: string;
  };
}

// Опції для генерації URL
export interface StorageUrlOptions {
  width?: number;
  height?: number;
  quality?: number | 'auto';
  format?: string;
  responsive?: boolean;
  transformation?: any;
}

/**
 * Unified Storage Service
 */
class UnifiedStorageService {
  private provider: StorageProvider;

  constructor() {
    // Визначаємо провайдера з environment variables
    const envProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase() as StorageProvider;
    this.provider = this.selectProvider(envProvider);

    console.log(`[Storage] Using provider: ${this.provider}`);
  }

  /**
   * Вибирає доступного провайдера
   */
  private selectProvider(preferred: StorageProvider): StorageProvider {
    // Спочатку перевіряємо бажаного провайдера
    if (preferred === 's3' && s3Client.isConfigured()) {
      return 's3';
    }

    if (preferred === 'cloudinary' && cloudinaryClient.isConfigured()) {
      return 'cloudinary';
    }

    // Fallback: шукаємо будь-якого налаштованого провайдера
    if (s3Client.isConfigured()) {
      console.log('[Storage] Falling back to S3');
      return 's3';
    }

    if (cloudinaryClient.isConfigured()) {
      console.log('[Storage] Falling back to Cloudinary');
      return 'cloudinary';
    }

    // Останній fallback - локальне сховище
    console.warn('[Storage] No cloud storage configured, using local storage');
    return 'local';
  }

  /**
   * Отримує поточного провайдера
   */
  getProvider(): StorageProvider {
    return this.provider;
  }

  /**
   * Перевіряє чи налаштований cloud storage
   */
  isCloudStorageEnabled(): boolean {
    return this.provider !== 'local';
  }

  /**
   * Завантажує файл через вибраного провайдера
   */
  async upload(
    file: File | Buffer,
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult> {
    if (this.provider === 's3') {
      return this.uploadToS3(file, options);
    }

    if (this.provider === 'cloudinary') {
      return this.uploadToCloudinary(file, options);
    }

    // Локальне сховище
    return this.uploadLocally(file, options);
  }

  /**
   * Завантажує файл в S3
   */
  private async uploadToS3(
    file: File | Buffer,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const s3Options: S3UploadOptions = {
      key: options.folder
        ? `${options.folder}/${options.fileName || Date.now()}`
        : options.fileName,
      contentType: options.contentType,
      acl: options.acl || 'public-read',
      metadata: options.metadata,
      tags: options.tags
        ? Object.fromEntries(options.tags.map((tag, i) => [`tag${i}`, tag]))
        : undefined,
    };

    const result = await s3Client.upload(file, s3Options);

    return {
      id: result.key,
      url: result.url,
      secureUrl: result.url,
      provider: 's3',
      size: result.size,
      format: result.contentType.split('/')[1],
      metadata: {
        etag: result.etag,
        bucket: result.bucket,
      },
    };
  }

  /**
   * Завантажує файл в Cloudinary
   */
  private async uploadToCloudinary(
    file: File | Buffer,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    const cloudinaryOptions: CloudinaryUploadOptions = {
      folder: options.folder,
      publicId: options.fileName,
      tags: options.tags,
      context: options.metadata,
      transformation: options.transformation,
    };

    const result = await cloudinaryClient.upload(file, cloudinaryOptions);

    return {
      id: result.publicId,
      url: result.url,
      secureUrl: result.secureUrl,
      provider: 'cloudinary',
      size: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
      metadata: {
        resourceType: result.resourceType,
        etag: result.etag,
      },
    };
  }

  /**
   * Зберігає файл локально (для development)
   */
  private async uploadLocally(
    file: File | Buffer,
    options: StorageUploadOptions
  ): Promise<StorageUploadResult> {
    // В production це не повинно використовуватись
    console.warn('[Storage] Using local storage - not suitable for production!');

    const buffer = file instanceof File
      ? Buffer.from(await file.arrayBuffer())
      : file;

    const fileName = options.fileName ||
      (file instanceof File ? file.name : `${Date.now()}.bin`);

    const folder = options.folder || 'uploads';
    const filePath = `${folder}/${fileName}`;

    // В реальності тут би був код для збереження в /public або на диск
    // Але це demonstration code для fallback
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/${filePath}`;

    return {
      id: filePath,
      url,
      secureUrl: url,
      provider: 'local',
      size: buffer.length,
      format: fileName.split('.').pop(),
    };
  }

  /**
   * Завантажує декілька файлів
   */
  async uploadMultiple(
    files: (File | Buffer)[],
    options: StorageUploadOptions = {}
  ): Promise<StorageUploadResult[]> {
    const promises = files.map(file => this.upload(file, options));
    return Promise.all(promises);
  }

  /**
   * Видаляє файл
   */
  async delete(id: string): Promise<void> {
    if (this.provider === 's3') {
      await s3Client.delete(id);
      return;
    }

    if (this.provider === 'cloudinary') {
      await cloudinaryClient.delete(id);
      return;
    }

    // Локальне видалення
    console.log(`[Storage] Would delete local file: ${id}`);
  }

  /**
   * Видаляє декілька файлів
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    const promises = ids.map(id => this.delete(id));
    await Promise.all(promises);
  }

  /**
   * Генерує URL для файлу
   */
  getUrl(id: string, options: StorageUrlOptions = {}): string {
    if (this.provider === 's3') {
      // S3 URLs статичні, трансформації потрібно робити при завантаженні
      return s3Client.getPublicUrl(id);
    }

    if (this.provider === 'cloudinary') {
      return cloudinaryClient.getUrl(id, {
        transformation: {
          width: options.width,
          height: options.height,
          quality: options.quality,
          format: options.format,
          ...options.transformation,
        },
        responsive: options.responsive,
      });
    }

    // Локальний URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    return `${baseUrl}/${id}`;
  }

  /**
   * Генерує оптимізований URL
   */
  getOptimizedUrl(
    id: string,
    width?: number,
    height?: number
  ): string {
    if (this.provider === 'cloudinary') {
      return cloudinaryClient.getOptimizedUrl(id, width, height);
    }

    // Для S3 та local повертаємо звичайний URL
    return this.getUrl(id, { width, height });
  }

  /**
   * Генерує thumbnail URL
   */
  getThumbnailUrl(
    id: string,
    width: number = 200,
    height: number = 200
  ): string {
    if (this.provider === 'cloudinary') {
      return cloudinaryClient.getThumbnailUrl(id, width, height);
    }

    return this.getUrl(id, { width, height });
  }

  /**
   * Генерує responsive URLs
   */
  getResponsiveUrls(
    id: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): Array<{ width: number; url: string }> {
    if (this.provider === 'cloudinary') {
      return cloudinaryClient.getResponsiveUrls(id, sizes);
    }

    // Для S3 та local повертаємо один URL для кожного розміру
    return sizes.map(width => ({
      width,
      url: this.getUrl(id),
    }));
  }

  /**
   * Генерує srcset для responsive images
   */
  generateSrcSet(
    id: string,
    sizes: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): string {
    if (this.provider === 'cloudinary') {
      return cloudinaryClient.generateSrcSet(id, sizes);
    }

    // Для S3 та local - простий srcset з одним URL
    const url = this.getUrl(id);
    return sizes.map(width => `${url} ${width}w`).join(', ');
  }

  /**
   * Генерує presigned URL (тільки для S3)
   */
  async getPresignedUrl(
    id: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    if (this.provider === 's3') {
      return s3Client.getPresignedUrl(id, options);
    }

    // Для інших провайдерів повертаємо публічний URL
    return this.getUrl(id);
  }

  /**
   * Перевіряє чи існує файл
   */
  async exists(id: string): Promise<boolean> {
    if (this.provider === 's3') {
      return s3Client.exists(id);
    }

    // Для Cloudinary та local припускаємо що існує
    return true;
  }

  /**
   * Отримує інформацію про використання сховища
   */
  getStorageInfo(): {
    provider: StorageProvider;
    isConfigured: boolean;
    supportsTransformations: boolean;
    supportsPresignedUrls: boolean;
  } {
    return {
      provider: this.provider,
      isConfigured: this.provider !== 'local',
      supportsTransformations: this.provider === 'cloudinary',
      supportsPresignedUrls: this.provider === 's3',
    };
  }
}

// Експортуємо singleton інстанс
export const storage = new UnifiedStorageService();
export default storage;

// Re-export clients для прямого доступу якщо потрібно
export { s3Client, cloudinaryClient };
