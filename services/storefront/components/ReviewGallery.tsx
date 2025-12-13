'use client';

import { useState, useEffect } from 'react';
import type { Review } from '@/lib/reviews';

interface ReviewGalleryProps {
  reviews: Review[];
  showPhotosOnly?: boolean;
  onFilterChange?: (photosOnly: boolean) => void;
}

interface LightboxImage {
  url: string;
  caption?: string;
  reviewId: string;
  authorName: string;
}

export default function ReviewGallery({ reviews, showPhotosOnly = false, onFilterChange }: ReviewGalleryProps) {
  const [photosOnlyFilter, setPhotosOnlyFilter] = useState(showPhotosOnly);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [images, setImages] = useState<LightboxImage[]>([]);

  // Filter reviews with photos
  const reviewsWithPhotos = reviews.filter((review) => review.media.length > 0);

  // Display reviews based on filter
  const displayReviews = photosOnlyFilter ? reviewsWithPhotos : reviews;

  // Collect all images from reviews
  useEffect(() => {
    const allImages: LightboxImage[] = [];
    reviewsWithPhotos.forEach((review) => {
      review.media.forEach((media) => {
        if (media.type === 'image') {
          allImages.push({
            url: media.url,
            caption: media.caption,
            reviewId: review.id,
            authorName: review.author.name,
          });
        }
      });
    });
    setImages(allImages);
  }, [reviewsWithPhotos]);

  // Toggle filter
  const togglePhotosOnly = () => {
    const newValue = !photosOnlyFilter;
    setPhotosOnlyFilter(newValue);
    onFilterChange?.(newValue);
  };

  // Open lightbox
  const openLightbox = (reviewId: string, mediaIndex: number) => {
    // Find the global index of this image
    let globalIndex = 0;
    for (const review of reviewsWithPhotos) {
      if (review.id === reviewId) {
        globalIndex += mediaIndex;
        break;
      }
      globalIndex += review.media.filter((m) => m.type === 'image').length;
    }
    setCurrentImageIndex(globalIndex);
    setLightboxOpen(true);
  };

  // Close lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // Navigate lightbox
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') previousImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

  // Prevent scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">Поки що немає відгуків</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Галерея відгуків ({displayReviews.length})
          </h3>
          {reviewsWithPhotos.length > 0 && (
            <button
              onClick={togglePhotosOnly}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                photosOnlyFilter
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              З фото ({reviewsWithPhotos.length})
            </button>
          )}
        </div>
      </div>

      {/* Photo Grid - Only show when photos only filter is active */}
      {photosOnlyFilter && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index) || setLightboxOpen(true)}
              className="relative aspect-square overflow-hidden rounded-lg group cursor-pointer"
            >
              <img
                src={image.url}
                alt={`Фото від ${image.authorName}`}
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                  />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Review Cards with Photos */}
      {!photosOnlyFilter && (
        <div className="space-y-6">
          {displayReviews.map((review) => (
            <div key={review.id} className="bg-white rounded-lg shadow-sm p-6">
              {/* Review Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  {review.author.avatar ? (
                    <img
                      src={review.author.avatar}
                      alt={review.author.name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      {review.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{review.author.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                          }`}
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString('uk-UA')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Title */}
              {review.title && <h5 className="font-semibold text-gray-900 mb-2">{review.title}</h5>}

              {/* Review Content */}
              <p className="text-gray-700 mb-4">{review.content}</p>

              {/* Photos */}
              {review.media.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {review.media
                    .filter((m) => m.type === 'image')
                    .map((media, index) => (
                      <button
                        key={media.id}
                        onClick={() => openLightbox(review.id, index)}
                        className="relative aspect-square overflow-hidden rounded-lg group cursor-pointer"
                      >
                        <img
                          src={media.thumbnailUrl || media.url}
                          alt={media.caption || 'Фото відгуку'}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Previous Button */}
          {images.length > 1 && (
            <button
              onClick={previousImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Image */}
          <div className="max-w-7xl max-h-full p-4">
            <img
              src={images[currentImageIndex].url}
              alt={`Фото від ${images[currentImageIndex].authorName}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
            {/* Image Info */}
            <div className="text-center mt-4 text-white">
              <p className="font-medium">{images[currentImageIndex].authorName}</p>
              {images[currentImageIndex].caption && (
                <p className="text-sm text-gray-300 mt-1">{images[currentImageIndex].caption}</p>
              )}
              <p className="text-sm text-gray-400 mt-2">
                {currentImageIndex + 1} / {images.length}
              </p>
            </div>
          </div>

          {/* Next Button */}
          {images.length > 1 && (
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10"
            >
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
