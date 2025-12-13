'use client';

import { useState, useRef, DragEvent, ChangeEvent, FormEvent } from 'react';
import {
  processAndUploadImages,
  validateImageFile,
  fileToDataURL,
  formatFileSize,
  type PhotoReviewImage,
  type UploadProgress,
} from '@/lib/reviews/photo-reviews';
import type { CreateReviewInput, UsagePeriod } from '@/lib/reviews';

interface ReviewFormProps {
  productId: string;
  productName: string;
  onSubmit: (review: CreateReviewInput) => Promise<void>;
  onCancel?: () => void;
}

interface ImagePreview {
  file: File;
  dataUrl: string;
  id: string;
}

const USAGE_PERIODS: { value: UsagePeriod; label: string }[] = [
  { value: 'less_than_week', label: 'Менше тижня' },
  { value: 'week_to_month', label: '1 тиждень - 1 місяць' },
  { value: 'one_to_three_months', label: '1-3 місяці' },
  { value: 'three_to_six_months', label: '3-6 місяців' },
  { value: 'six_months_to_year', label: '6 місяців - 1 рік' },
  { value: 'more_than_year', label: 'Більше року' },
];

export default function ReviewForm({ productId, productName, onSubmit, onCancel }: ReviewFormProps) {
  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pros, setPros] = useState<string[]>(['']);
  const [cons, setCons] = useState<string[]>(['']);
  const [recommended, setRecommended] = useState(true);
  const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>('one_to_three_months');

  // Image state
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [uploadedImages, setUploadedImages] = useState<PhotoReviewImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle star rating
  const handleStarClick = (value: number) => {
    setRating(value);
  };

  // Handle pros/cons
  const updatePros = (index: number, value: string) => {
    const newPros = [...pros];
    newPros[index] = value;
    setPros(newPros);
  };

  const addPro = () => {
    if (pros.length < 5) {
      setPros([...pros, '']);
    }
  };

  const removePro = (index: number) => {
    setPros(pros.filter((_, i) => i !== index));
  };

  const updateCons = (index: number, value: string) => {
    const newCons = [...cons];
    newCons[index] = value;
    setCons(newCons);
  };

  const addCon = () => {
    if (cons.length < 5) {
      setCons([...cons, '']);
    }
  };

  const removeCon = (index: number) => {
    setCons(cons.filter((_, i) => i !== index));
  };

  // Handle image upload
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const maxImages = 5;

    if (images.length + fileArray.length > maxImages) {
      setError(`Максимум ${maxImages} зображень дозволено`);
      return;
    }

    // Validate and preview images
    const newPreviews: ImagePreview[] = [];

    for (const file of fileArray) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.errorUk || 'Помилка валідації');
        continue;
      }

      try {
        const dataUrl = await fileToDataURL(file);
        newPreviews.push({
          file,
          dataUrl,
          id: Math.random().toString(36).substr(2, 9),
        });
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }

    setImages([...images, ...newPreviews]);
    setError('');
  };

  // Drag and drop handlers
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  // Remove image
  const removeImage = (id: string) => {
    setImages(images.filter((img) => img.id !== id));
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (rating === 0) {
      setError('Будь ласка, виберіть оцінку');
      return;
    }

    if (!title.trim()) {
      setError('Будь ласка, введіть заголовок відгуку');
      return;
    }

    if (!content.trim()) {
      setError('Будь ласка, напишіть текст відгуку');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload images if any
      let mediaFiles: File[] = [];

      if (images.length > 0) {
        setIsUploading(true);

        const files = images.map((img) => img.file);

        // Process and upload images
        await processAndUploadImages(
          files,
          undefined,
          (progress: UploadProgress) => {
            setUploadProgress((prev) => ({
              ...prev,
              [progress.imageIndex]: progress.progress,
            }));
          }
        );

        mediaFiles = files;
        setIsUploading(false);
      }

      // Prepare review data
      const reviewData: CreateReviewInput = {
        productId,
        rating,
        title: title.trim(),
        content: content.trim(),
        pros: pros.filter((p) => p.trim() !== ''),
        cons: cons.filter((c) => c.trim() !== ''),
        mediaFiles,
        recommended,
        usagePeriod,
      };

      await onSubmit(reviewData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при відправці відгуку');
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900">Написати відгук на {productName}</h2>

      {/* Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ваша оцінка <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <svg
                className={`w-8 h-8 ${
                  star <= (hoverRating || rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                }`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-sm text-gray-600 mt-1">
            {rating === 5 && 'Відмінно'}
            {rating === 4 && 'Добре'}
            {rating === 3 && 'Нормально'}
            {rating === 2 && 'Погано'}
            {rating === 1 && 'Жахливо'}
          </p>
        )}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
          Заголовок відгуку <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Коротко про ваш досвід"
          maxLength={100}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">{title.length}/100 символів</p>
      </div>

      {/* Content */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
          Ваш відгук <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Розкажіть детально про товар..."
          rows={6}
          maxLength={2000}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">{content.length}/2000 символів</p>
      </div>

      {/* Pros */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Переваги</label>
        <div className="space-y-2">
          {pros.map((pro, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={pro}
                onChange={(e) => updatePros(index, e.target.value)}
                placeholder="Перевага товару"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {pros.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePro(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {pros.length < 5 && (
            <button
              type="button"
              onClick={addPro}
              className="text-sm text-green-600 hover:text-green-700"
            >
              + Додати перевагу
            </button>
          )}
        </div>
      </div>

      {/* Cons */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Недоліки</label>
        <div className="space-y-2">
          {cons.map((con, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={con}
                onChange={(e) => updateCons(index, e.target.value)}
                placeholder="Недолік товару"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
              {cons.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCon(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {cons.length < 5 && (
            <button
              type="button"
              onClick={addCon}
              className="text-sm text-red-600 hover:text-red-700"
            >
              + Додати недолік
            </button>
          )}
        </div>
      </div>

      {/* Photos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Фотографії (необов'язково, макс. 5)
        </label>

        {/* Upload area */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            Перетягніть фото сюди або{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              виберіть файли
            </button>
          </p>
          <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP до 10МБ</p>
        </div>

        {/* Image previews */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.dataUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {formatFileSize(image.file.size)}
                </div>
                {uploadProgress[images.indexOf(image)] !== undefined && (
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-blue-600 h-1 rounded-full transition-all"
                      style={{ width: `${uploadProgress[images.indexOf(image)]}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage Period */}
      <div>
        <label htmlFor="usagePeriod" className="block text-sm font-medium text-gray-700 mb-2">
          Як довго користуєтесь товаром?
        </label>
        <select
          id="usagePeriod"
          value={usagePeriod}
          onChange={(e) => setUsagePeriod(e.target.value as UsagePeriod)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {USAGE_PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {/* Recommendation */}
      <div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={recommended}
            onChange={(e) => setRecommended(e.target.checked)}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Я рекомендую цей товар іншим покупцям
          </span>
        </label>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting || isUploading ? 'Відправка...' : 'Опублікувати відгук'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting || isUploading}
            className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
          >
            Скасувати
          </button>
        )}
      </div>
    </form>
  );
}
