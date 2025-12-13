/**
 * AWS S3 Client для завантаження та управління файлами
 *
 * Функціонал:
 * - Завантаження зображень в S3
 * - Генерація presigned URLs
 * - Видалення файлів
 * - Підтримка декількох бакетів
 * - Оптимізація зображень
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';

// Типи для S3 операцій
export interface S3UploadOptions {
  bucket?: string;
  key?: string;
  contentType?: string;
  acl?: 'private' | 'public-read' | 'public-read-write';
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  cacheControl?: string;
  expires?: Date;
}

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  size: number;
  etag: string;
  contentType: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // в секундах
  responseContentType?: string;
  responseContentDisposition?: string;
}

export interface S3DeleteOptions {
  bucket?: string;
}

export interface S3ListOptions {
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

// Конфігурація S3 клієнта
class S3StorageClient {
  private client: S3Client | null = null;
  private defaultBucket: string;
  private region: string;
  private endpoint?: string;

  constructor() {
    this.defaultBucket = process.env.AWS_S3_BUCKET || '';
    this.region = process.env.AWS_REGION || 'eu-central-1';
    this.endpoint = process.env.AWS_S3_ENDPOINT;

    // Ініціалізуємо клієнт тільки якщо є credentials
    if (this.isConfigured()) {
      this.initializeClient();
    }
  }

  /**
   * Перевіряє чи налаштований S3
   */
  isConfigured(): boolean {
    return !!(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      this.defaultBucket
    );
  }

  /**
   * Ініціалізує S3 клієнт
   */
  private initializeClient(): void {
    const config: any = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    // Додаємо custom endpoint якщо є (для сумісних з S3 сервісів)
    if (this.endpoint) {
      config.endpoint = this.endpoint;
      config.forcePathStyle = true; // Для MinIO та інших S3-сумісних
    }

    this.client = new S3Client(config);
  }

  /**
   * Отримує клієнт (ініціалізує якщо потрібно)
   */
  private getClient(): S3Client {
    if (!this.client) {
      if (!this.isConfigured()) {
        throw new Error('S3 client is not configured. Please set AWS credentials.');
      }
      this.initializeClient();
    }
    return this.client!;
  }

  /**
   * Генерує унікальний ключ для файлу
   */
  private generateKey(file: File | Buffer, prefix?: string): string {
    const timestamp = Date.now();
    const hash = createHash('md5')
      .update(file instanceof File ? file.name : timestamp.toString())
      .digest('hex')
      .substring(0, 8);

    const extension = file instanceof File ? file.name.split('.').pop() : 'bin';
    const baseName = prefix || 'upload';

    return `${baseName}/${timestamp}-${hash}.${extension}`;
  }

  /**
   * Завантажує файл в S3
   */
  async upload(
    file: File | Buffer,
    options: S3UploadOptions = {}
  ): Promise<S3UploadResult> {
    const client = this.getClient();
    const bucket = options.bucket || this.defaultBucket;

    if (!bucket) {
      throw new Error('S3 bucket is not specified');
    }

    // Генеруємо ключ якщо не вказаний
    const key = options.key || this.generateKey(file);

    // Визначаємо content type
    const contentType = options.contentType ||
      (file instanceof File ? file.type : 'application/octet-stream');

    // Отримуємо буфер
    const buffer = file instanceof File
      ? Buffer.from(await file.arrayBuffer())
      : file;

    // Готуємо параметри для завантаження
    const uploadParams: any = {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    // Додаємо ACL якщо вказано
    if (options.acl) {
      uploadParams.ACL = options.acl;
    }

    // Додаємо metadata
    if (options.metadata) {
      uploadParams.Metadata = options.metadata;
    }

    // Додаємо tagging
    if (options.tags) {
      const tags = Object.entries(options.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join('&');
      uploadParams.Tagging = tags;
    }

    // Додаємо cache control
    if (options.cacheControl) {
      uploadParams.CacheControl = options.cacheControl;
    } else {
      // За замовчуванням кешуємо на 1 рік для зображень
      if (contentType.startsWith('image/')) {
        uploadParams.CacheControl = 'public, max-age=31536000, immutable';
      }
    }

    // Додаємо expires
    if (options.expires) {
      uploadParams.Expires = options.expires;
    }

    try {
      // Завантажуємо файл
      const command = new PutObjectCommand(uploadParams);
      const response = await client.send(command);

      // Генеруємо URL
      const url = this.endpoint
        ? `${this.endpoint}/${bucket}/${key}`
        : `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;

      return {
        key,
        url,
        bucket,
        size: buffer.length,
        etag: response.ETag || '',
        contentType,
      };
    } catch (error) {
      console.error('Error uploading to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error}`);
    }
  }

  /**
   * Завантажує декілька файлів
   */
  async uploadMultiple(
    files: (File | Buffer)[],
    options: S3UploadOptions = {}
  ): Promise<S3UploadResult[]> {
    const promises = files.map(file => this.upload(file, options));
    return Promise.all(promises);
  }

  /**
   * Генерує presigned URL для завантаження
   */
  async getPresignedUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    const client = this.getClient();
    const bucket = this.defaultBucket;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentType: options.responseContentType,
      ResponseContentDisposition: options.responseContentDisposition,
    });

    const expiresIn = options.expiresIn || 3600; // 1 година за замовчуванням

    try {
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error}`);
    }
  }

  /**
   * Генерує presigned URL для завантаження (upload)
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    const client = this.getClient();
    const bucket = this.defaultBucket;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const expiresIn = options.expiresIn || 3600;

    try {
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Error generating presigned upload URL:', error);
      throw new Error(`Failed to generate presigned upload URL: ${error}`);
    }
  }

  /**
   * Видаляє файл з S3
   */
  async delete(key: string, options: S3DeleteOptions = {}): Promise<void> {
    const client = this.getClient();
    const bucket = options.bucket || this.defaultBucket;

    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await client.send(command);
    } catch (error) {
      console.error('Error deleting from S3:', error);
      throw new Error(`Failed to delete file from S3: ${error}`);
    }
  }

  /**
   * Видаляє декілька файлів
   */
  async deleteMultiple(
    keys: string[],
    options: S3DeleteOptions = {}
  ): Promise<void> {
    const promises = keys.map(key => this.delete(key, options));
    await Promise.all(promises);
  }

  /**
   * Перевіряє чи існує файл
   */
  async exists(key: string, bucket?: string): Promise<boolean> {
    const client = this.getClient();
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      await client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Копіює файл в межах S3
   */
  async copy(
    sourceKey: string,
    destinationKey: string,
    options: {
      sourceBucket?: string;
      destinationBucket?: string;
      metadata?: Record<string, string>;
      acl?: 'private' | 'public-read';
    } = {}
  ): Promise<void> {
    const client = this.getClient();
    const sourceBucket = options.sourceBucket || this.defaultBucket;
    const destinationBucket = options.destinationBucket || this.defaultBucket;

    try {
      const command = new CopyObjectCommand({
        Bucket: destinationBucket,
        CopySource: `${sourceBucket}/${sourceKey}`,
        Key: destinationKey,
        Metadata: options.metadata,
        ACL: options.acl,
        MetadataDirective: options.metadata ? 'REPLACE' : 'COPY',
      });

      await client.send(command);
    } catch (error) {
      console.error('Error copying file in S3:', error);
      throw new Error(`Failed to copy file in S3: ${error}`);
    }
  }

  /**
   * Отримує список файлів
   */
  async list(options: S3ListOptions = {}): Promise<{
    files: Array<{
      key: string;
      size: number;
      lastModified: Date;
      etag: string;
    }>;
    continuationToken?: string;
    isTruncated: boolean;
  }> {
    const client = this.getClient();
    const bucket = options.bucket || this.defaultBucket;

    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: options.prefix,
        MaxKeys: options.maxKeys || 1000,
        ContinuationToken: options.continuationToken,
      });

      const response = await client.send(command);

      const files = (response.Contents || []).map(item => ({
        key: item.Key!,
        size: item.Size!,
        lastModified: item.LastModified!,
        etag: item.ETag!,
      }));

      return {
        files,
        continuationToken: response.NextContinuationToken,
        isTruncated: response.IsTruncated || false,
      };
    } catch (error) {
      console.error('Error listing S3 files:', error);
      throw new Error(`Failed to list S3 files: ${error}`);
    }
  }

  /**
   * Отримує публічний URL для файлу
   */
  getPublicUrl(key: string, bucket?: string): string {
    const targetBucket = bucket || this.defaultBucket;

    if (this.endpoint) {
      return `${this.endpoint}/${targetBucket}/${key}`;
    }

    return `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Отримує розмір файлу
   */
  async getFileSize(key: string, bucket?: string): Promise<number> {
    const client = this.getClient();
    const targetBucket = bucket || this.defaultBucket;

    try {
      const command = new HeadObjectCommand({
        Bucket: targetBucket,
        Key: key,
      });

      const response = await client.send(command);
      return response.ContentLength || 0;
    } catch (error) {
      console.error('Error getting file size from S3:', error);
      throw new Error(`Failed to get file size from S3: ${error}`);
    }
  }
}

// Експортуємо singleton інстанс
export const s3Client = new S3StorageClient();
export default s3Client;
