'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  text: string;
  pros?: string;
  cons?: string;
  images?: string[];
  helpful: number;
  notHelpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductReviewStats {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface ReviewsContextType {
  getProductReviews: (productId: string) => Review[];
  getProductStats: (productId: string) => ProductReviewStats;
  addReview: (review: Omit<Review, 'id' | 'createdAt' | 'helpful' | 'notHelpful'>) => Promise<{ success: boolean; error?: string }>;
  updateReview: (reviewId: string, data: Partial<Review>) => Promise<{ success: boolean; error?: string }>;
  deleteReview: (reviewId: string) => Promise<{ success: boolean; error?: string }>;
  markHelpful: (reviewId: string, helpful: boolean) => void;
  getUserReviews: (userId: string) => Review[];
  canUserReview: (productId: string, userId: string) => boolean;
}

const ReviewsContext = createContext<ReviewsContextType | undefined>(undefined);

const REVIEWS_STORAGE_KEY = 'shop_reviews';

// Generate initial mock reviews
function generateMockReviews(): Review[] {
  const reviewTexts = [
    { title: 'Чудовий товар!', text: 'Дуже задоволений покупкою. Рекомендую всім!', pros: 'Якість, ціна, швидка доставка', cons: 'Немає' },
    { title: 'Відмінна якість', text: 'Товар повністю відповідає опису. Працює бездоганно.', pros: 'Надійність, дизайн', cons: 'Трохи дорого' },
    { title: 'Хороший вибір', text: 'Непоганий товар за свою ціну. Є незначні недоліки, але загалом задоволений.', pros: 'Ціна, функціонал', cons: 'Інструкція лише англійською' },
    { title: 'Рекомендую', text: 'Купую вже вдруге. Якість стабільна, сервіс на висоті.', pros: 'Якість збірки, гарантія', cons: 'Довго чекати доставку' },
    { title: 'Задоволений покупкою', text: 'Все як на фото, працює добре. Дякую магазину!', pros: 'Відповідає опису', cons: 'Упаковка могла бути краще' },
  ];

  const names = ['Олександр К.', 'Марія С.', 'Іван П.', 'Наталія В.', 'Андрій Б.', 'Олена М.', 'Дмитро Л.', 'Юлія Т.'];

  const reviews: Review[] = [];

  // Generate reviews for products 1-100
  for (let productNum = 1; productNum <= 100; productNum++) {
    const numReviews = Math.floor(Math.random() * 8) + 2; // 2-9 reviews per product

    for (let i = 0; i < numReviews; i++) {
      const template = reviewTexts[Math.floor(Math.random() * reviewTexts.length)];
      const rating = Math.floor(Math.random() * 3) + 3; // 3-5 stars

      reviews.push({
        id: `review_${productNum}_${i}`,
        productId: `prod-${productNum}`,
        userId: `user_${Math.floor(Math.random() * 1000)}`,
        userName: names[Math.floor(Math.random() * names.length)],
        rating,
        title: template.title,
        text: template.text,
        pros: template.pros,
        cons: template.cons,
        helpful: Math.floor(Math.random() * 50),
        notHelpful: Math.floor(Math.random() * 10),
        verified: Math.random() > 0.3,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString(),
      });
    }
  }

  return reviews;
}

export function ReviewsProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (stored) {
      try {
        setReviews(JSON.parse(stored));
      } catch {
        const mockReviews = generateMockReviews();
        setReviews(mockReviews);
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(mockReviews));
      }
    } else {
      const mockReviews = generateMockReviews();
      setReviews(mockReviews);
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(mockReviews));
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage when reviews change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
    }
  }, [reviews, isInitialized]);

  const getProductReviews = useCallback((productId: string): Review[] => {
    return reviews
      .filter(r => r.productId === productId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reviews]);

  const getProductStats = useCallback((productId: string): ProductReviewStats => {
    const productReviews = reviews.filter(r => r.productId === productId);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    productReviews.forEach(r => {
      distribution[r.rating as keyof typeof distribution]++;
      totalRating += r.rating;
    });

    return {
      productId,
      averageRating: productReviews.length > 0 ? totalRating / productReviews.length : 0,
      totalReviews: productReviews.length,
      ratingDistribution: distribution,
    };
  }, [reviews]);

  const addReview = useCallback(async (review: Omit<Review, 'id' | 'createdAt' | 'helpful' | 'notHelpful'>): Promise<{ success: boolean; error?: string }> => {
    // Check if user already reviewed this product
    if (reviews.some(r => r.productId === review.productId && r.userId === review.userId)) {
      return { success: false, error: 'Ви вже залишили відгук на цей товар' };
    }

    const newReview: Review = {
      ...review,
      id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      helpful: 0,
      notHelpful: 0,
      createdAt: new Date().toISOString(),
    };

    setReviews(prev => [newReview, ...prev]);
    return { success: true };
  }, [reviews]);

  const updateReview = useCallback(async (reviewId: string, data: Partial<Review>): Promise<{ success: boolean; error?: string }> => {
    const reviewIndex = reviews.findIndex(r => r.id === reviewId);
    if (reviewIndex === -1) {
      return { success: false, error: 'Відгук не знайдено' };
    }

    setReviews(prev => {
      const updated = [...prev];
      updated[reviewIndex] = {
        ...updated[reviewIndex],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });

    return { success: true };
  }, [reviews]);

  const deleteReview = useCallback(async (reviewId: string): Promise<{ success: boolean; error?: string }> => {
    setReviews(prev => prev.filter(r => r.id !== reviewId));
    return { success: true };
  }, []);

  const markHelpful = useCallback((reviewId: string, helpful: boolean) => {
    setReviews(prev => prev.map(r => {
      if (r.id === reviewId) {
        return {
          ...r,
          helpful: helpful ? r.helpful + 1 : r.helpful,
          notHelpful: helpful ? r.notHelpful : r.notHelpful + 1,
        };
      }
      return r;
    }));
  }, []);

  const getUserReviews = useCallback((userId: string): Review[] => {
    return reviews.filter(r => r.userId === userId);
  }, [reviews]);

  const canUserReview = useCallback((productId: string, userId: string): boolean => {
    return !reviews.some(r => r.productId === productId && r.userId === userId);
  }, [reviews]);

  return (
    <ReviewsContext.Provider
      value={{
        getProductReviews,
        getProductStats,
        addReview,
        updateReview,
        deleteReview,
        markHelpful,
        getUserReviews,
        canUserReview,
      }}
    >
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewsContext);
  if (context === undefined) {
    throw new Error('useReviews must be used within a ReviewsProvider');
  }
  return context;
}
