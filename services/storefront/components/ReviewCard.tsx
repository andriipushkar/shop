'use client';

import { useState } from 'react';
import type { Review, ReviewBadge } from '@/lib/reviews';
import { voteReview, formatReviewDate } from '@/lib/reviews';

interface ReviewCardProps {
  review: Review;
  onVoteUpdate?: (reviewId: string, newVotes: { helpful: number; notHelpful: number }) => void;
  onImageClick?: (imageUrl: string, imageIndex: number) => void;
}

const BADGE_COLORS: Record<ReviewBadge, string> = {
  top_reviewer: 'bg-purple-100 text-purple-800',
  verified_buyer: 'bg-green-100 text-green-800',
  early_reviewer: 'bg-blue-100 text-blue-800',
  helpful_reviewer: 'bg-orange-100 text-orange-800',
  expert: 'bg-red-100 text-red-800',
};

const BADGE_LABELS: Record<ReviewBadge, string> = {
  top_reviewer: 'Топ рецензент',
  verified_buyer: 'Перевірений покупець',
  early_reviewer: 'Ранній рецензент',
  helpful_reviewer: 'Корисний рецензент',
  expert: 'Експерт',
};

export default function ReviewCard({ review, onVoteUpdate, onImageClick }: ReviewCardProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [userVote, setUserVote] = useState<'helpful' | 'not_helpful' | null>(
    review.votes.userVote || null
  );
  const [votes, setVotes] = useState(review.votes);

  // Handle voting
  const handleVote = async (voteType: 'helpful' | 'not_helpful') => {
    if (isVoting || userVote === voteType) return;

    setIsVoting(true);

    try {
      const result = await voteReview(review.id, voteType);

      if (result.success) {
        setVotes(result.newVotes);
        setUserVote(voteType);
        onVoteUpdate?.(review.id, result.newVotes);
      }
    } catch (error) {
      console.error('Vote error:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const dateFormatted = formatReviewDate(review.createdAt);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {review.author.avatar ? (
            <img
              src={review.author.avatar}
              alt={review.author.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-lg">
              {review.author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Author Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-gray-900 truncate">{review.author.name}</h4>

            {/* Badges */}
            {review.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Підтверджена покупка
              </span>
            )}

            {review.author.badges.map((badge) => (
              <span
                key={badge}
                className={`px-2 py-1 rounded-full text-xs font-medium ${BADGE_COLORS[badge]}`}
              >
                {BADGE_LABELS[badge]}
              </span>
            ))}
          </div>

          {/* Rating & Date */}
          <div className="flex items-center gap-3 mt-2">
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
            <span className="text-sm text-gray-500">{dateFormatted.uk}</span>
          </div>
        </div>
      </div>

      {/* Title */}
      {review.title && (
        <h5 className="font-semibold text-gray-900 text-lg mb-2">{review.title}</h5>
      )}

      {/* Content */}
      <p className="text-gray-700 mb-4 leading-relaxed">{review.content}</p>

      {/* Pros & Cons */}
      {(review.pros && review.pros.length > 0) || (review.cons && review.cons.length > 0) ? (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {/* Pros */}
          {review.pros && review.pros.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4">
              <h6 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Переваги
              </h6>
              <ul className="space-y-1">
                {review.pros.map((pro, index) => (
                  <li key={index} className="text-sm text-green-900 flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">•</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {review.cons && review.cons.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <h6 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                Недоліки
              </h6>
              <ul className="space-y-1">
                {review.cons.map((con, index) => (
                  <li key={index} className="text-sm text-red-900 flex items-start gap-2">
                    <span className="text-red-600 mt-0.5">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Photos */}
      {review.media.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {review.media
              .filter((m) => m.type === 'image')
              .slice(0, 4)
              .map((media, index) => (
                <button
                  key={media.id}
                  onClick={() => onImageClick?.(media.url, index)}
                  className="relative aspect-square overflow-hidden rounded-lg group cursor-pointer"
                >
                  <img
                    src={media.thumbnailUrl || media.url}
                    alt={media.caption || 'Фото відгуку'}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  {index === 3 && review.media.length > 4 && (
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center text-white text-lg font-semibold">
                      +{review.media.length - 4}
                    </div>
                  )}
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
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Recommendation Badge */}
      {review.recommended && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            Рекомендую
          </span>
        </div>
      )}

      {/* Footer - Voting */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center gap-4">
          {/* Helpful button */}
          <button
            onClick={() => handleVote('helpful')}
            disabled={isVoting}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              userVote === 'helpful'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            Корисно ({votes.helpful})
          </button>

          {/* Not helpful button */}
          <button
            onClick={() => handleVote('not_helpful')}
            disabled={isVoting}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              userVote === 'not_helpful'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-5 h-5 transform rotate-180" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
            Не корисно ({votes.notHelpful})
          </button>
        </div>

        {/* Purchase Date */}
        {review.purchaseDate && (
          <span className="text-xs text-gray-500">
            Куплено: {new Date(review.purchaseDate).toLocaleDateString('uk-UA')}
          </span>
        )}
      </div>

      {/* Seller Response */}
      {review.response && (
        <div className="mt-4 pl-4 border-l-4 border-blue-200 bg-blue-50 p-4 rounded-r-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold text-blue-900">
              Відповідь {review.response.authorRole === 'seller' ? 'продавця' : 'підтримки'}
            </span>
            <span className="text-xs text-blue-700">
              {new Date(review.response.createdAt).toLocaleDateString('uk-UA')}
            </span>
          </div>
          <p className="text-sm text-blue-900">{review.response.content}</p>
        </div>
      )}
    </div>
  );
}
