/**
 * Photo Reviews System
 * Handles image upload, optimization, compression, and moderation for product reviews
 */

// ==================== TYPES ====================

export interface PhotoReviewImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  size: number; // bytes
  format: 'jpg' | 'png' | 'webp';
  caption?: string;
  uploadedAt: Date;
  moderationStatus: ModerationStatus;
  moderationFlags?: ModerationFlag[];
}

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type ModerationFlag =
  | 'inappropriate_content'
  | 'low_quality'
  | 'not_product_related'
  | 'duplicate'
  | 'watermark'
  | 'copyright';

export interface ImageUploadOptions {
  maxImages?: number;
  maxSizeMB?: number;
  allowedFormats?: string[];
  compressionQuality?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface ImageCompressionResult {
  originalFile: File;
  compressedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  errorUk?: string;
}

export interface UploadProgress {
  imageIndex: number;
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

// ==================== CONSTANTS ====================

export const DEFAULT_UPLOAD_OPTIONS: ImageUploadOptions = {
  maxImages: 5,
  maxSizeMB: 10,
  allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  compressionQuality: 0.85,
  thumbnailWidth: 200,
  thumbnailHeight: 200,
};

export const MODERATION_FLAG_LABELS: Record<ModerationFlag, { en: string; uk: string }> = {
  inappropriate_content: { en: 'Inappropriate content', uk: 'Неприйнятний контент' },
  low_quality: { en: 'Low quality', uk: 'Низька якість' },
  not_product_related: { en: 'Not product related', uk: 'Не стосується товару' },
  duplicate: { en: 'Duplicate', uk: 'Дублікат' },
  watermark: { en: 'Watermark detected', uk: 'Виявлено водяний знак' },
  copyright: { en: 'Copyright issue', uk: 'Проблема авторських прав' },
};

// ==================== VALIDATION ====================

/**
 * Validate image file before upload
 */
export function validateImageFile(
  file: File,
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS
): ImageValidationResult {
  const { maxSizeMB = 10, allowedFormats = DEFAULT_UPLOAD_OPTIONS.allowedFormats! } = options;

  // Check file type
  if (!allowedFormats.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed formats: ${allowedFormats.join(', ')}`,
      errorUk: `Невірний тип файлу. Дозволені формати: ${allowedFormats.join(', ')}`,
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
      errorUk: `Розмір файлу перевищує ліміт ${maxSizeMB}МБ`,
    };
  }

  // Check if it's actually an image
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'File is not an image',
      errorUk: 'Файл не є зображенням',
    };
  }

  return { valid: true };
}

/**
 * Validate multiple images
 */
export function validateMultipleImages(
  files: File[],
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS
): { valid: boolean; errors: string[]; errorsUk: string[] } {
  const { maxImages = 5 } = options;
  const errors: string[] = [];
  const errorsUk: string[] = [];

  // Check number of images
  if (files.length > maxImages) {
    errors.push(`Maximum ${maxImages} images allowed`);
    errorsUk.push(`Максимум ${maxImages} зображень дозволено`);
    return { valid: false, errors, errorsUk };
  }

  // Validate each file
  for (const file of files) {
    const result = validateImageFile(file, options);
    if (!result.valid) {
      if (result.error) errors.push(result.error);
      if (result.errorUk) errorsUk.push(result.errorUk);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    errorsUk,
  };
}

// ==================== IMAGE COMPRESSION ====================

/**
 * Load image from file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Compress image using canvas
 */
export async function compressImage(
  file: File,
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS
): Promise<ImageCompressionResult> {
  const { compressionQuality = 0.85 } = options;

  try {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Calculate new dimensions (max 1920x1920)
    const maxDimension = 1920;
    let width = img.width;
    let height = img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = (height / width) * maxDimension;
        width = maxDimension;
      } else {
        width = (width / height) * maxDimension;
        height = maxDimension;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // Draw image on canvas
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob
    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        compressionQuality
      );
    });

    return {
      originalFile: file,
      compressedBlob,
      originalSize: file.size,
      compressedSize: compressedBlob.size,
      compressionRatio: Math.round((1 - compressedBlob.size / file.size) * 100),
      width,
      height,
    };
  } catch (error) {
    console.error('Image compression error:', error);
    throw error;
  }
}

/**
 * Create thumbnail from image
 */
export async function createThumbnail(
  file: File,
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS
): Promise<Blob> {
  const { thumbnailWidth = 200, thumbnailHeight = 200 } = options;

  try {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    // Calculate dimensions to maintain aspect ratio
    const aspectRatio = img.width / img.height;
    let width = thumbnailWidth;
    let height = thumbnailHeight;

    if (aspectRatio > 1) {
      height = width / aspectRatio;
    } else {
      width = height * aspectRatio;
    }

    canvas.width = width;
    canvas.height = height;

    // Draw thumbnail
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob
    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        'image/jpeg',
        0.8
      );
    });

    return thumbnailBlob;
  } catch (error) {
    console.error('Thumbnail creation error:', error);
    throw error;
  }
}

/**
 * Compress multiple images
 */
export async function compressMultipleImages(
  files: File[],
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS,
  onProgress?: (progress: UploadProgress) => void
): Promise<ImageCompressionResult[]> {
  const results: ImageCompressionResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: file.name,
          progress: 0,
          status: 'processing',
        });
      }

      const result = await compressImage(file, options);
      results.push(result);

      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: file.name,
          progress: 100,
          status: 'completed',
        });
      }
    } catch (error) {
      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: file.name,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  return results;
}

// ==================== IMAGE UPLOAD ====================

/**
 * Upload compressed image to server
 */
export async function uploadImage(
  blob: Blob,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<{ url: string; thumbnailUrl: string; id: string }> {
  const formData = new FormData();
  formData.append('image', blob, filename);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const progress = Math.round((e.loaded / e.total) * 100);
        onProgress(progress);
      }
    });

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid server response'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('POST', '/api/reviews/upload');
    xhr.send(formData);
  });
}

/**
 * Upload multiple images
 */
export async function uploadMultipleImages(
  compressionResults: ImageCompressionResult[],
  onProgress?: (progress: UploadProgress) => void
): Promise<PhotoReviewImage[]> {
  const uploadedImages: PhotoReviewImage[] = [];

  for (let i = 0; i < compressionResults.length; i++) {
    const result = compressionResults[i];

    try {
      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: result.originalFile.name,
          progress: 0,
          status: 'uploading',
        });
      }

      const uploaded = await uploadImage(
        result.compressedBlob,
        result.originalFile.name,
        (progress) => {
          if (onProgress) {
            onProgress({
              imageIndex: i,
              fileName: result.originalFile.name,
              progress,
              status: 'uploading',
            });
          }
        }
      );

      const image: PhotoReviewImage = {
        id: uploaded.id,
        url: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl,
        width: result.width,
        height: result.height,
        size: result.compressedSize,
        format: result.originalFile.type.includes('png')
          ? 'png'
          : result.originalFile.type.includes('webp')
          ? 'webp'
          : 'jpg',
        uploadedAt: new Date(),
        moderationStatus: 'pending',
      };

      uploadedImages.push(image);

      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: result.originalFile.name,
          progress: 100,
          status: 'completed',
        });
      }
    } catch (error) {
      if (onProgress) {
        onProgress({
          imageIndex: i,
          fileName: result.originalFile.name,
          progress: 0,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
      throw error;
    }
  }

  return uploadedImages;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert file to base64 data URL (for preview)
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return { width: img.width, height: img.height };
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Check if image needs moderation
 */
export function needsModeration(image: PhotoReviewImage): boolean {
  // If already approved or rejected without flags, no moderation needed
  if (image.moderationStatus === 'approved' || image.moderationStatus === 'rejected') {
    // Only needs moderation if there are flags
    return !!(image.moderationFlags && image.moderationFlags.length > 0);
  }

  // Pending or flagged status needs moderation
  return (
    image.moderationStatus === 'pending' ||
    image.moderationStatus === 'flagged' ||
    !!(image.moderationFlags && image.moderationFlags.length > 0)
  );
}

/**
 * Process and upload images (complete workflow)
 */
export async function processAndUploadImages(
  files: File[],
  options: ImageUploadOptions = DEFAULT_UPLOAD_OPTIONS,
  onProgress?: (progress: UploadProgress) => void
): Promise<PhotoReviewImage[]> {
  // Validate images
  const validation = validateMultipleImages(files, options);
  if (!validation.valid) {
    throw new Error(validation.errorsUk[0] || validation.errors[0] || 'Validation failed');
  }

  // Compress images
  const compressionResults = await compressMultipleImages(files, options, onProgress);

  // Upload images
  const uploadedImages = await uploadMultipleImages(compressionResults, onProgress);

  return uploadedImages;
}
