import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { apiLogger } from '@/lib/logger';

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'reviews');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST /api/reviews/upload - Upload review image
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided', errorUk: 'Файл не надано' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.',
          errorUk: 'Невірний тип файлу. Дозволені лише JPEG, PNG та WebP.',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size exceeds 10MB limit',
          errorUk: 'Розмір файлу перевищує ліміт 10МБ',
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileId = randomUUID();
    const extension = file.type.split('/')[1];
    const filename = `${fileId}.${extension}`;
    const thumbnailFilename = `${fileId}_thumb.${extension}`;

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Process main image with Sharp (resize if needed)
    const processedImage = await sharp(buffer)
      .resize(1920, 1920, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Create thumbnail
    const thumbnail = await sharp(buffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Save files
    const mainImagePath = join(UPLOAD_DIR, filename);
    const thumbnailPath = join(UPLOAD_DIR, thumbnailFilename);

    await writeFile(mainImagePath, processedImage);
    await writeFile(thumbnailPath, thumbnail);

    // Get image metadata
    const metadata = await sharp(processedImage).metadata();

    const response = {
      id: fileId,
      url: `/uploads/reviews/${filename}`,
      thumbnailUrl: `/uploads/reviews/${thumbnailFilename}`,
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: processedImage.length,
      format: extension,
    };

    apiLogger.info('Review image uploaded', { fileId, filename, size: file.size });

    return NextResponse.json(response);
  } catch (error) {
    apiLogger.error('Error uploading review image', error);
    return NextResponse.json(
      { error: 'Failed to upload image', errorUk: 'Помилка завантаження зображення' },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/reviews/upload - CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
