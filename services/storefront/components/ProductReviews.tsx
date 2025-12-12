'use client';

import { useState } from 'react';
import { useReviews } from '@/lib/reviews-context';
import { useAuth } from '@/lib/auth-context';
import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/solid';

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { getProductReviews, getProductStats, addReview, markHelpful, canUserReview } = useReviews();
  const { user, isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reviews = getProductReviews(productId);
  const stats = getProductStats(productId);
  const canReview = isAuthenticated && user && canUserReview(productId, user.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || newRating === 0) return;

    setIsSubmitting(true);
    setError('');

    const result = await addReview({
      productId,
      userId: user.id,
      userName: user.name,
      rating: newRating,
      title,
      text,
      verified: true,
    });

    setIsSubmitting(false);

    if (result.success) {
      setShowForm(false);
      setNewRating(0);
      setTitle('');
      setText('');
    } else {
      setError(result.error || 'Помилка при додаванні відгуку');
    }
  };

  const handleHelpful = (reviewId: string, isHelpful: boolean) => {
    markHelpful(reviewId, isHelpful);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-8">
        {/* Rating Summary */}
        <div className="flex items-start gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</div>
            <div className="flex items-center justify-center mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarSolidIcon
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(stats.averageRating) ? 'text-yellow-400' : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-1">{stats.totalReviews} відгуків</div>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 min-w-[200px]">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.ratingDistribution[rating as keyof typeof stats.ratingDistribution] || 0;
              const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
              return (
                <div key={rating} className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-gray-600 w-6">{rating}</span>
                  <StarSolidIcon className="w-4 h-4 text-yellow-400" />
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Write Review Button */}
        <div>
          {isAuthenticated ? (
            canReview ? (
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-6 py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
              >
                Залишити відгук
              </button>
            ) : (
              <p className="text-sm text-gray-500">Ви вже залишили відгук</p>
            )
          ) : (
            <p className="text-sm text-gray-500">
              <a href="/auth/login" className="text-teal-600 hover:underline">
                Увійдіть
              </a>
              , щоб залишити відгук
            </p>
          )}
        </div>
      </div>

      {/* Review Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">Ваш відгук</h3>

          {/* Rating */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Оцінка</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setNewRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  {star <= (hoverRating || newRating) ? (
                    <StarSolidIcon className="w-8 h-8 text-yellow-400" />
                  ) : (
                    <StarIcon className="w-8 h-8 text-gray-300" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Заголовок</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Короткий заголовок вашого відгуку"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              required
            />
          </div>

          {/* Text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Відгук</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Розкажіть про ваш досвід використання товару..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isSubmitting || newRating === 0}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Відправлення...' : 'Відправити'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-gray-900">
          Відгуки ({reviews.length})
        </h3>

        {reviews.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">Поки немає відгуків</p>
            <p className="text-sm">Будьте першим, хто залишить відгук про цей товар!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map((review) => (
              <div key={review.id} className="py-6 first:pt-0">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{review.userName}</span>
                      {review.verified && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Підтверджена покупка
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarSolidIcon
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating ? 'text-yellow-400' : 'text-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {review.title && (
                  <h4 className="font-medium text-gray-900 mb-2">{review.title}</h4>
                )}
                <p className="text-gray-600 mb-4">{review.text}</p>

                {/* Helpful buttons */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Чи був цей відгук корисним?</span>
                  <button
                    onClick={() => handleHelpful(review.id, true)}
                    className="flex items-center gap-1 hover:text-green-600 transition-colors"
                  >
                    <HandThumbUpIcon className="w-4 h-4" />
                    <span>{review.helpful}</span>
                  </button>
                  <button
                    onClick={() => handleHelpful(review.id, false)}
                    className="flex items-center gap-1 hover:text-red-600 transition-colors"
                  >
                    <HandThumbDownIcon className="w-4 h-4" />
                    <span>{review.notHelpful}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
