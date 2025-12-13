/**
 * Tests for Reviews System 2.0
 */

import {
  calculateReviewSummary,
  filterReviews,
  validateReviewMedia,
  formatReviewDate,
  getRatingLabel,
  canUserReview,
  USAGE_PERIOD_LABELS,
  REVIEW_BADGE_LABELS,
  SORT_OPTIONS,
  MAX_REVIEW_MEDIA,
  MAX_MEDIA_SIZE_MB,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  Review,
  ReviewFilter,
  ReviewSummary,
  ReviewAuthor,
} from '../../lib/reviews';

describe('Reviews System', () => {
  // Sample review author
  const createAuthor = (overrides?: Partial<ReviewAuthor>): ReviewAuthor => ({
    id: 'user-1',
    name: 'Іван Петренко',
    reviewCount: 5,
    helpfulVotes: 20,
    isVerifiedBuyer: true,
    memberSince: new Date('2023-01-01'),
    badges: ['verified_buyer'],
    ...overrides,
  });

  // Sample reviews
  const createReview = (overrides?: Partial<Review>): Review => ({
    id: 'review-1',
    productId: 'prod-1',
    author: createAuthor(),
    rating: 5,
    title: 'Чудовий товар!',
    content: 'Дуже задоволений покупкою. Рекомендую всім!',
    pros: ['Якість', 'Ціна'],
    cons: [],
    media: [],
    isVerifiedPurchase: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    votes: { helpful: 10, notHelpful: 1 },
    status: 'approved',
    recommended: true,
    usagePeriod: 'one_to_three_months',
    ...overrides,
  });

  const approvedReviews: Review[] = [
    createReview({
      id: '1',
      rating: 5,
      isVerifiedPurchase: true,
      recommended: true,
      media: [],
      votes: { helpful: 10, notHelpful: 1 },
      createdAt: new Date('2024-01-15'),
    }),
    createReview({
      id: '2',
      author: createAuthor({ id: 'user-2', name: 'Марія Коваленко', isVerifiedBuyer: false }),
      rating: 3,
      title: 'Нормально',
      content: 'Середній товар, нічого особливого.',
      isVerifiedPurchase: false,
      recommended: false,
      media: [{ id: 'media-1', type: 'image', url: 'https://example.com/photo.jpg', thumbnailUrl: 'https://example.com/photo-thumb.jpg' }],
      votes: { helpful: 2, notHelpful: 3 },
      createdAt: new Date('2024-01-10'),
    }),
    createReview({
      id: '3',
      author: createAuthor({ id: 'user-3', name: 'Олег Сидоренко' }),
      rating: 4,
      title: 'Хороший вибір',
      content: 'В цілому задоволений, але є дрібні недоліки.',
      isVerifiedPurchase: true,
      recommended: true,
      media: [],
      votes: { helpful: 5, notHelpful: 0 },
      createdAt: new Date('2024-01-20'),
    }),
  ];

  describe('calculateReviewSummary', () => {
    it('should calculate average rating correctly', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      // (5 + 3 + 4) / 3 = 4
      expect(summary.averageRating).toBe(4);
    });

    it('should count total reviews', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      expect(summary.totalReviews).toBe(3);
    });

    it('should calculate rating distribution', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      expect(summary.ratingDistribution[5]).toBe(1);
      expect(summary.ratingDistribution[4]).toBe(1);
      expect(summary.ratingDistribution[3]).toBe(1);
      expect(summary.ratingDistribution[2]).toBe(0);
      expect(summary.ratingDistribution[1]).toBe(0);
    });

    it('should calculate verified purchase rate', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      // 2 out of 3 are verified
      expect(summary.verifiedPurchaseRate).toBeCloseTo(67, 0);
    });

    it('should count reviews with media', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      expect(summary.withMediaCount).toBe(1);
    });

    it('should calculate recommendation rate', () => {
      const summary = calculateReviewSummary('prod-1', approvedReviews);

      // 2 out of 3 recommend
      expect(summary.recommendationRate).toBeCloseTo(67, 0);
    });

    it('should return zero values for empty reviews', () => {
      const summary = calculateReviewSummary('prod-1', []);

      expect(summary.totalReviews).toBe(0);
      expect(summary.averageRating).toBe(0);
      expect(summary.recommendationRate).toBe(0);
    });

    it('should only count approved reviews', () => {
      const mixedReviews = [
        ...approvedReviews,
        createReview({ id: '4', status: 'pending', rating: 1 }),
        createReview({ id: '5', status: 'rejected', rating: 1 }),
      ];

      const summary = calculateReviewSummary('prod-1', mixedReviews);

      expect(summary.totalReviews).toBe(3); // Only approved ones
    });

    it('should collect top pros', () => {
      const reviewsWithPros = [
        createReview({ id: '1', pros: ['Якість', 'Ціна'] }),
        createReview({ id: '2', pros: ['Якість', 'Дизайн'] }),
      ];

      const summary = calculateReviewSummary('prod-1', reviewsWithPros);

      expect(summary.topPros).toContain('Якість');
    });

    it('should collect top cons', () => {
      const reviewsWithCons = [
        createReview({ id: '1', cons: ['Доставка'] }),
        createReview({ id: '2', cons: ['Доставка', 'Пакування'] }),
      ];

      const summary = calculateReviewSummary('prod-1', reviewsWithCons);

      expect(summary.topCons).toContain('Доставка');
    });
  });

  describe('filterReviews', () => {
    it('should filter by rating', () => {
      const filter: ReviewFilter = { rating: 5 };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].rating).toBe(5);
    });

    it('should filter by media presence', () => {
      const filter: ReviewFilter = { withMedia: true };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].media.length).toBeGreaterThan(0);
    });

    it('should filter verified only', () => {
      const filter: ReviewFilter = { verifiedOnly: true };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered).toHaveLength(2);
      filtered.forEach(review => {
        expect(review.isVerifiedPurchase).toBe(true);
      });
    });

    it('should sort by newest first', () => {
      const filter: ReviewFilter = { sortBy: 'newest' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(new Date(filtered[0].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(filtered[1].createdAt).getTime());
    });

    it('should sort by oldest first', () => {
      const filter: ReviewFilter = { sortBy: 'oldest' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(new Date(filtered[0].createdAt).getTime())
        .toBeLessThanOrEqual(new Date(filtered[1].createdAt).getTime());
    });

    it('should sort by highest rating', () => {
      const filter: ReviewFilter = { sortBy: 'highest_rating' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered[0].rating).toBeGreaterThanOrEqual(filtered[1].rating);
    });

    it('should sort by lowest rating', () => {
      const filter: ReviewFilter = { sortBy: 'lowest_rating' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered[0].rating).toBeLessThanOrEqual(filtered[1].rating);
    });

    it('should sort by most helpful', () => {
      const filter: ReviewFilter = { sortBy: 'most_helpful' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered[0].votes.helpful).toBeGreaterThanOrEqual(filtered[1].votes.helpful);
    });

    it('should sort by most photos', () => {
      const filter: ReviewFilter = { sortBy: 'most_photos' };

      const filtered = filterReviews(approvedReviews, filter);

      expect(filtered[0].media.length).toBeGreaterThanOrEqual(filtered[1].media.length);
    });

    it('should filter by usage period', () => {
      const filter: ReviewFilter = { usagePeriod: 'one_to_three_months' };

      const filtered = filterReviews(approvedReviews, filter);

      filtered.forEach(review => {
        expect(review.usagePeriod).toBe('one_to_three_months');
      });
    });

    it('should only return approved reviews', () => {
      const mixedReviews = [
        ...approvedReviews,
        createReview({ id: '4', status: 'pending' }),
      ];

      const filtered = filterReviews(mixedReviews, {});

      filtered.forEach(review => {
        expect(review.status).toBe('approved');
      });
    });
  });

  describe('validateReviewMedia', () => {
    it('should validate correct image media', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(true);
    });

    it('should validate correct video media', () => {
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid file type', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.errorUk).toBeTruthy();
    });

    it('should accept WebP images', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(true);
    });

    it('should accept PNG images', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(true);
    });

    it('should accept WebM videos', () => {
      const file = new File(['test'], 'test.webm', { type: 'video/webm' });

      const result = validateReviewMedia(file);

      expect(result.valid).toBe(true);
    });
  });

  describe('formatReviewDate', () => {
    it('should format today', () => {
      const today = new Date();
      const formatted = formatReviewDate(today);

      expect(formatted.uk).toBe('Сьогодні');
      expect(formatted.en).toBe('Today');
    });

    it('should format yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const formatted = formatReviewDate(yesterday);

      expect(formatted.uk).toBe('Вчора');
      expect(formatted.en).toBe('Yesterday');
    });

    it('should format days ago', () => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 3);

      const formatted = formatReviewDate(daysAgo);

      expect(formatted.uk).toContain('днів тому');
      expect(formatted.en).toContain('days ago');
    });

    it('should format weeks ago', () => {
      const weeksAgo = new Date();
      weeksAgo.setDate(weeksAgo.getDate() - 14);

      const formatted = formatReviewDate(weeksAgo);

      expect(formatted.uk).toContain('тижн');
      expect(formatted.en).toContain('week');
    });

    it('should format months ago', () => {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 3);

      const formatted = formatReviewDate(monthsAgo);

      expect(formatted.uk).toContain('місяц');
      expect(formatted.en).toContain('month');
    });
  });

  describe('getRatingLabel', () => {
    it('should return label for rating 5', () => {
      const label = getRatingLabel(5);

      expect(label.uk).toBe('Відмінно');
      expect(label.en).toBe('Excellent');
    });

    it('should return label for rating 4', () => {
      const label = getRatingLabel(4);

      expect(label.uk).toBe('Добре');
      expect(label.en).toBe('Good');
    });

    it('should return label for rating 3', () => {
      const label = getRatingLabel(3);

      expect(label.uk).toBe('Нормально');
      expect(label.en).toBe('Average');
    });

    it('should return label for rating 2', () => {
      const label = getRatingLabel(2);

      expect(label.uk).toBe('Погано');
      expect(label.en).toBe('Poor');
    });

    it('should return label for rating 1', () => {
      const label = getRatingLabel(1);

      expect(label.uk).toBe('Жахливо');
      expect(label.en).toBe('Terrible');
    });

    it('should return unknown for invalid rating', () => {
      const label = getRatingLabel(0);

      expect(label.uk).toBe('Невідомо');
      expect(label.en).toBe('Unknown');
    });
  });

  describe('canUserReview', () => {
    it('should allow user to review unreviewed product', () => {
      const result = canUserReview(
        'user-1',
        'prod-1',
        [],
        [{ productId: 'prod-1', date: new Date() }]
      );

      expect(result.canReview).toBe(true);
      expect(result.isVerifiedPurchase).toBe(true);
    });

    it('should not allow duplicate reviews', () => {
      const existingReviews = [
        createReview({ author: createAuthor({ id: 'user-1' }), productId: 'prod-1' }),
      ];

      const result = canUserReview('user-1', 'prod-1', existingReviews, []);

      expect(result.canReview).toBe(false);
      expect(result.reason).toBeTruthy();
      expect(result.reasonUk).toBeTruthy();
    });

    it('should mark as verified when product was purchased', () => {
      const purchaseHistory = [{ productId: 'prod-1', date: new Date() }];

      const result = canUserReview('user-1', 'prod-1', [], purchaseHistory);

      expect(result.isVerifiedPurchase).toBe(true);
    });

    it('should mark as not verified when product was not purchased', () => {
      const result = canUserReview('user-1', 'prod-1', [], []);

      expect(result.canReview).toBe(true);
      expect(result.isVerifiedPurchase).toBe(false);
    });

    it('should allow review for different product', () => {
      const existingReviews = [
        createReview({ author: createAuthor({ id: 'user-1' }), productId: 'prod-2' }),
      ];

      const result = canUserReview('user-1', 'prod-1', existingReviews, []);

      expect(result.canReview).toBe(true);
    });
  });

  describe('USAGE_PERIOD_LABELS', () => {
    it('should have all usage periods', () => {
      expect(USAGE_PERIOD_LABELS.less_than_week).toBeDefined();
      expect(USAGE_PERIOD_LABELS.week_to_month).toBeDefined();
      expect(USAGE_PERIOD_LABELS.one_to_three_months).toBeDefined();
      expect(USAGE_PERIOD_LABELS.three_to_six_months).toBeDefined();
      expect(USAGE_PERIOD_LABELS.six_months_to_year).toBeDefined();
      expect(USAGE_PERIOD_LABELS.more_than_year).toBeDefined();
    });

    it('should have both languages', () => {
      Object.values(USAGE_PERIOD_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
      });
    });
  });

  describe('REVIEW_BADGE_LABELS', () => {
    it('should have all badges', () => {
      expect(REVIEW_BADGE_LABELS.top_reviewer).toBeDefined();
      expect(REVIEW_BADGE_LABELS.verified_buyer).toBeDefined();
      expect(REVIEW_BADGE_LABELS.early_reviewer).toBeDefined();
      expect(REVIEW_BADGE_LABELS.helpful_reviewer).toBeDefined();
      expect(REVIEW_BADGE_LABELS.expert).toBeDefined();
    });

    it('should have both languages', () => {
      Object.values(REVIEW_BADGE_LABELS).forEach(label => {
        expect(label.en).toBeTruthy();
        expect(label.uk).toBeTruthy();
      });
    });
  });

  describe('SORT_OPTIONS', () => {
    it('should have multiple sort options', () => {
      expect(SORT_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have all required properties', () => {
      SORT_OPTIONS.forEach(option => {
        expect(option.value).toBeTruthy();
        expect(option.label).toBeTruthy();
        expect(option.labelUk).toBeTruthy();
      });
    });
  });

  describe('Constants', () => {
    it('should have MAX_REVIEW_MEDIA', () => {
      expect(MAX_REVIEW_MEDIA).toBeGreaterThan(0);
    });

    it('should have MAX_MEDIA_SIZE_MB', () => {
      expect(MAX_MEDIA_SIZE_MB).toBeGreaterThan(0);
    });

    it('should have allowed image types', () => {
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/webp');
    });

    it('should have allowed video types', () => {
      expect(ALLOWED_VIDEO_TYPES).toContain('video/mp4');
      expect(ALLOWED_VIDEO_TYPES).toContain('video/webm');
    });
  });
});
