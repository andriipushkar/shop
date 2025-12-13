/**
 * Photo Reviews - Complete Usage Example
 *
 * This file demonstrates how to use all Photo Reviews components together
 * in a product page with reviews functionality.
 */

'use client';

import { useState } from 'react';
import ReviewForm from '@/components/ReviewForm';
import ReviewCard from '@/components/ReviewCard';
import ReviewGallery from '@/components/ReviewGallery';
import RatingStars from '@/components/ui/RatingStars';
import { submitReview, filterReviews, calculateReviewSummary } from '@/lib/reviews';
import type { Review, ReviewFilter, CreateReviewInput } from '@/lib/reviews';

interface ProductReviewsPageProps {
  productId: string;
  productName: string;
  initialReviews: Review[];
}

export default function ProductReviewsPage({
  productId,
  productName,
  initialReviews,
}: ProductReviewsPageProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>({
    sortBy: 'newest',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Calculate review summary
  const summary = calculateReviewSummary(productId, reviews);

  // Apply filters
  const filteredReviews = filterReviews(reviews, filter);

  // Handle review submission
  const handleSubmitReview = async (reviewData: CreateReviewInput) => {
    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      const newReview = await submitReview(reviewData);

      // Add new review to list
      setReviews([newReview, ...reviews]);

      // Close form and show success
      setShowReviewForm(false);
      setSubmitSuccess(true);

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Помилка при відправці відгуку');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle vote update
  const handleVoteUpdate = (reviewId: string, newVotes: { helpful: number; notHelpful: number }) => {
    setReviews(
      reviews.map((review) =>
        review.id === reviewId
          ? {
              ...review,
              votes: {
                ...review.votes,
                helpful: newVotes.helpful,
                notHelpful: newVotes.notHelpful,
              },
            }
          : review
      )
    );
  };

  // Handle filter changes
  const handleFilterChange = (newFilter: Partial<ReviewFilter>) => {
    setFilter({ ...filter, ...newFilter });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Success Message */}
      {submitSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-lg flex items-center gap-3">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">Дякуємо за ваш відгук! Він буде опублікований після модерації.</span>
        </div>
      )}

      {/* Review Summary Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Відгуки про {productName}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Overall Rating */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl font-bold text-gray-900">{summary.averageRating.toFixed(1)}</div>
              <div>
                <RatingStars rating={Math.round(summary.averageRating)} size="lg" />
                <p className="text-sm text-gray-600 mt-1">
                  {summary.totalReviews} {summary.totalReviews === 1 ? 'відгук' : 'відгуків'}
                </p>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = summary.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5];
                const percentage = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;

                return (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 w-8">{rating} ★</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Stats & Write Review Button */}
          <div className="flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
                <span className="text-gray-700">
                  {summary.recommendationRate}% рекомендують цей товар
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">
                  {summary.verifiedPurchaseRate}% підтверджених покупок
                </span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">{summary.withMediaCount} відгуків з фото</span>
              </div>
            </div>

            <button
              onClick={() => setShowReviewForm(!showReviewForm)}
              className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              {showReviewForm ? 'Закрити форму' : 'Написати відгук'}
            </button>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="mb-8">
          <ReviewForm
            productId={productId}
            productName={productName}
            onSubmit={handleSubmitReview}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {/* Filter & Sort Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Sort */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Сортування:</label>
            <select
              value={filter.sortBy || 'newest'}
              onChange={(e) => handleFilterChange({ sortBy: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Найновіші</option>
              <option value="oldest">Найстаріші</option>
              <option value="highest_rating">Найвища оцінка</option>
              <option value="lowest_rating">Найнижча оцінка</option>
              <option value="most_helpful">Найкорисніші</option>
              <option value="most_photos">З фото</option>
            </select>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange({ withMedia: !filter.withMedia })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter.withMedia
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              З фото
            </button>
            <button
              onClick={() => handleFilterChange({ verifiedOnly: !filter.verifiedOnly })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter.verifiedOnly
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Підтверджені
            </button>
          </div>

          {/* Rating Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Оцінка:</label>
            <select
              value={filter.rating || ''}
              onChange={(e) =>
                handleFilterChange({ rating: e.target.value ? Number(e.target.value) : undefined })
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Всі</option>
              <option value="5">5 зірок</option>
              <option value="4">4 зірки</option>
              <option value="3">3 зірки</option>
              <option value="2">2 зірки</option>
              <option value="1">1 зірка</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reviews List or Gallery */}
      {filter.withMedia ? (
        <ReviewGallery
          reviews={filteredReviews}
          showPhotosOnly={filter.withMedia}
          onFilterChange={(photosOnly) => handleFilterChange({ withMedia: photosOnly })}
        />
      ) : (
        <div className="space-y-6">
          {filteredReviews.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Відгуків не знайдено за вказаними фільтрами</p>
              <button
                onClick={() => setFilter({ sortBy: 'newest' })}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Скинути фільтри
              </button>
            </div>
          ) : (
            filteredReviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onVoteUpdate={handleVoteUpdate}
              />
            ))
          )}
        </div>
      )}

      {/* Pagination (if needed) */}
      {filteredReviews.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors">
            Завантажити ще
          </button>
        </div>
      )}
    </div>
  );
}
