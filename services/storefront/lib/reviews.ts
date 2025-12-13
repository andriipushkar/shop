/**
 * Reviews System 2.0
 * Advanced review system with photos, videos, verified purchases, and voting
 */

// ==================== TYPES ====================

export interface ReviewMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  width?: number;
  height?: number;
  duration?: number; // For videos, in seconds
}

export interface ReviewAuthor {
  id: string;
  name: string;
  avatar?: string;
  reviewCount: number;
  helpfulVotes: number;
  isVerifiedBuyer: boolean;
  memberSince: Date;
  badges: ReviewBadge[];
}

export type ReviewBadge =
  | 'top_reviewer'
  | 'verified_buyer'
  | 'early_reviewer'
  | 'helpful_reviewer'
  | 'expert';

export interface ReviewVotes {
  helpful: number;
  notHelpful: number;
  userVote?: 'helpful' | 'not_helpful' | null;
}

export interface ReviewResponse {
  id: string;
  authorName: string;
  authorRole: 'seller' | 'support' | 'admin';
  content: string;
  createdAt: Date;
}

export interface Review {
  id: string;
  productId: string;
  author: ReviewAuthor;
  rating: number; // 1-5
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  media: ReviewMedia[];
  isVerifiedPurchase: boolean;
  purchaseDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
  votes: ReviewVotes;
  response?: ReviewResponse;
  status: ReviewStatus;
  recommended: boolean;
  usagePeriod?: UsagePeriod;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export type UsagePeriod =
  | 'less_than_week'
  | 'week_to_month'
  | 'one_to_three_months'
  | 'three_to_six_months'
  | 'six_months_to_year'
  | 'more_than_year';

export interface ReviewSummary {
  productId: string;
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  recommendationRate: number;
  verifiedPurchaseRate: number;
  withMediaCount: number;
  topPros: string[];
  topCons: string[];
}

export interface ReviewFilter {
  rating?: number;
  withMedia?: boolean;
  verifiedOnly?: boolean;
  sortBy?: ReviewSortOption;
  usagePeriod?: UsagePeriod;
}

export type ReviewSortOption =
  | 'newest'
  | 'oldest'
  | 'highest_rating'
  | 'lowest_rating'
  | 'most_helpful'
  | 'most_photos';

export interface CreateReviewInput {
  productId: string;
  rating: number;
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  mediaFiles?: File[];
  recommended: boolean;
  usagePeriod?: UsagePeriod;
}

// ==================== CONSTANTS ====================

export const USAGE_PERIOD_LABELS: Record<UsagePeriod, { en: string; uk: string }> = {
  less_than_week: { en: 'Less than a week', uk: 'Менше тижня' },
  week_to_month: { en: '1 week to 1 month', uk: '1 тиждень - 1 місяць' },
  one_to_three_months: { en: '1-3 months', uk: '1-3 місяці' },
  three_to_six_months: { en: '3-6 months', uk: '3-6 місяців' },
  six_months_to_year: { en: '6 months to 1 year', uk: '6 місяців - 1 рік' },
  more_than_year: { en: 'More than a year', uk: 'Більше року' },
};

export const REVIEW_BADGE_LABELS: Record<ReviewBadge, { en: string; uk: string }> = {
  top_reviewer: { en: 'Top Reviewer', uk: 'Топ рецензент' },
  verified_buyer: { en: 'Verified Buyer', uk: 'Перевірений покупець' },
  early_reviewer: { en: 'Early Reviewer', uk: 'Ранній рецензент' },
  helpful_reviewer: { en: 'Helpful Reviewer', uk: 'Корисний рецензент' },
  expert: { en: 'Expert', uk: 'Експерт' },
};

export const SORT_OPTIONS: { value: ReviewSortOption; label: string; labelUk: string }[] = [
  { value: 'newest', label: 'Newest', labelUk: 'Найновіші' },
  { value: 'oldest', label: 'Oldest', labelUk: 'Найстаріші' },
  { value: 'highest_rating', label: 'Highest Rating', labelUk: 'Найвища оцінка' },
  { value: 'lowest_rating', label: 'Lowest Rating', labelUk: 'Найнижча оцінка' },
  { value: 'most_helpful', label: 'Most Helpful', labelUk: 'Найкорисніші' },
  { value: 'most_photos', label: 'Most Photos', labelUk: 'З фото' },
];

export const MAX_REVIEW_MEDIA = 10;
export const MAX_MEDIA_SIZE_MB = 50;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// ==================== FUNCTIONS ====================

/**
 * Calculate review summary from reviews array
 */
export function calculateReviewSummary(
  productId: string,
  reviews: Review[]
): ReviewSummary {
  const approvedReviews = reviews.filter(r => r.status === 'approved');
  const totalReviews = approvedReviews.length;

  if (totalReviews === 0) {
    return {
      productId,
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      recommendationRate: 0,
      verifiedPurchaseRate: 0,
      withMediaCount: 0,
      topPros: [],
      topCons: [],
    };
  }

  // Calculate average rating
  const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
  const averageRating = Math.round((totalRating / totalReviews) * 10) / 10;

  // Rating distribution
  const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  approvedReviews.forEach(r => {
    const rating = r.rating as 1 | 2 | 3 | 4 | 5;
    ratingDistribution[rating]++;
  });

  // Recommendation rate
  const recommended = approvedReviews.filter(r => r.recommended).length;
  const recommendationRate = Math.round((recommended / totalReviews) * 100);

  // Verified purchase rate
  const verified = approvedReviews.filter(r => r.isVerifiedPurchase).length;
  const verifiedPurchaseRate = Math.round((verified / totalReviews) * 100);

  // With media count
  const withMediaCount = approvedReviews.filter(r => r.media.length > 0).length;

  // Top pros and cons (count frequency)
  const prosCount: Record<string, number> = {};
  const consCount: Record<string, number> = {};

  approvedReviews.forEach(r => {
    r.pros?.forEach(pro => {
      prosCount[pro] = (prosCount[pro] || 0) + 1;
    });
    r.cons?.forEach(con => {
      consCount[con] = (consCount[con] || 0) + 1;
    });
  });

  const topPros = Object.entries(prosCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([pro]) => pro);

  const topCons = Object.entries(consCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([con]) => con);

  return {
    productId,
    totalReviews,
    averageRating,
    ratingDistribution,
    recommendationRate,
    verifiedPurchaseRate,
    withMediaCount,
    topPros,
    topCons,
  };
}

/**
 * Filter and sort reviews
 */
export function filterReviews(
  reviews: Review[],
  filter: ReviewFilter
): Review[] {
  let result = reviews.filter(r => r.status === 'approved');

  // Filter by rating
  if (filter.rating !== undefined) {
    result = result.filter(r => r.rating === filter.rating);
  }

  // Filter by media
  if (filter.withMedia) {
    result = result.filter(r => r.media.length > 0);
  }

  // Filter verified only
  if (filter.verifiedOnly) {
    result = result.filter(r => r.isVerifiedPurchase);
  }

  // Filter by usage period
  if (filter.usagePeriod) {
    result = result.filter(r => r.usagePeriod === filter.usagePeriod);
  }

  // Sort
  switch (filter.sortBy) {
    case 'oldest':
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'highest_rating':
      result.sort((a, b) => b.rating - a.rating);
      break;
    case 'lowest_rating':
      result.sort((a, b) => a.rating - b.rating);
      break;
    case 'most_helpful':
      result.sort((a, b) => b.votes.helpful - a.votes.helpful);
      break;
    case 'most_photos':
      result.sort((a, b) => b.media.length - a.media.length);
      break;
    case 'newest':
    default:
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return result;
}

/**
 * Validate review media file
 */
export function validateReviewMedia(file: File): { valid: boolean; error?: string; errorUk?: string } {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, WebP images and MP4, WebM videos are allowed.',
      errorUk: 'Невірний тип файлу. Дозволені лише JPEG, PNG, WebP зображення та MP4, WebM відео.',
    };
  }

  const maxSizeBytes = MAX_MEDIA_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_MEDIA_SIZE_MB}MB limit.`,
      errorUk: `Розмір файлу перевищує ліміт ${MAX_MEDIA_SIZE_MB}МБ.`,
    };
  }

  return { valid: true };
}

/**
 * Vote on a review
 */
export async function voteReview(
  reviewId: string,
  voteType: 'helpful' | 'not_helpful'
): Promise<{ success: boolean; newVotes: ReviewVotes }> {
  try {
    const response = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType }),
    });

    if (!response.ok) {
      throw new Error('Failed to vote');
    }

    return await response.json();
  } catch (error) {
    console.error('Vote error:', error);
    throw error;
  }
}

/**
 * Submit a new review
 */
export async function submitReview(input: CreateReviewInput): Promise<Review> {
  const formData = new FormData();

  formData.append('productId', input.productId);
  formData.append('rating', String(input.rating));
  formData.append('title', input.title);
  formData.append('content', input.content);
  formData.append('recommended', String(input.recommended));

  if (input.pros) {
    formData.append('pros', JSON.stringify(input.pros));
  }
  if (input.cons) {
    formData.append('cons', JSON.stringify(input.cons));
  }
  if (input.usagePeriod) {
    formData.append('usagePeriod', input.usagePeriod);
  }

  input.mediaFiles?.forEach(file => {
    formData.append('media', file);
  });

  const response = await fetch('/api/reviews', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to submit review');
  }

  return response.json();
}

/**
 * Report a review
 */
export async function reportReview(
  reviewId: string,
  reason: string
): Promise<{ success: boolean }> {
  const response = await fetch(`/api/reviews/${reviewId}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error('Failed to report review');
  }

  return response.json();
}

/**
 * Format relative time for reviews
 */
export function formatReviewDate(date: Date): { en: string; uk: string } {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (days === 0) {
    return { en: 'Today', uk: 'Сьогодні' };
  } else if (days === 1) {
    return { en: 'Yesterday', uk: 'Вчора' };
  } else if (days < 7) {
    return { en: `${days} days ago`, uk: `${days} днів тому` };
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return { en: `${weeks} week${weeks > 1 ? 's' : ''} ago`, uk: `${weeks} тижн${weeks > 1 ? 'ів' : 'ь'} тому` };
  } else if (months < 12) {
    return { en: `${months} month${months > 1 ? 's' : ''} ago`, uk: `${months} місяц${months > 1 ? 'ів' : 'ь'} тому` };
  } else {
    return { en: `${years} year${years > 1 ? 's' : ''} ago`, uk: `${years} р${years > 1 ? 'оків' : 'ік'} тому` };
  }
}

/**
 * Get rating label
 */
export function getRatingLabel(rating: number): { en: string; uk: string } {
  switch (rating) {
    case 5:
      return { en: 'Excellent', uk: 'Відмінно' };
    case 4:
      return { en: 'Good', uk: 'Добре' };
    case 3:
      return { en: 'Average', uk: 'Нормально' };
    case 2:
      return { en: 'Poor', uk: 'Погано' };
    case 1:
      return { en: 'Terrible', uk: 'Жахливо' };
    default:
      return { en: 'Unknown', uk: 'Невідомо' };
  }
}

/**
 * Check if user can review a product
 */
export function canUserReview(
  userId: string,
  productId: string,
  existingReviews: Review[],
  purchaseHistory: { productId: string; date: Date }[]
): { canReview: boolean; reason?: string; reasonUk?: string; isVerifiedPurchase: boolean } {
  // Check if already reviewed
  const existingReview = existingReviews.find(
    r => r.author.id === userId && r.productId === productId
  );

  if (existingReview) {
    return {
      canReview: false,
      reason: 'You have already reviewed this product',
      reasonUk: 'Ви вже залишили відгук на цей товар',
      isVerifiedPurchase: false,
    };
  }

  // Check purchase history
  const purchase = purchaseHistory.find(p => p.productId === productId);
  const isVerifiedPurchase = !!purchase;

  return {
    canReview: true,
    isVerifiedPurchase,
  };
}
