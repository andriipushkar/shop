'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';

interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  image_url?: string;
  stock: number;
  rating?: number;
  reviewCount?: number;
  oldPrice?: number;
}

interface RecommendedProductsProps {
  /** ID продукту для якого шукаємо рекомендації */
  productId?: string;
  /** ID користувача для персоналізації */
  userId?: string;
  /** Тип рекомендацій */
  type?: 'similar' | 'bought-together' | 'personalized' | 'history';
  /** Заголовок секції */
  title?: string;
  /** Підзаголовок */
  subtitle?: string;
  /** Максимальна кількість товарів */
  limit?: number;
  /** Показати посилання "Переглянути всі" */
  showViewAll?: boolean;
  /** URL для "Переглянути всі" */
  viewAllLink?: string;
  /** Показати причини рекомендації */
  showReasons?: boolean;
  /** CSS класи */
  className?: string;
}

interface RecommendationData {
  productId: string;
  score: number;
  reasons?: string[];
  product?: Product;
}

export default function RecommendedProducts({
  productId,
  userId,
  type = 'similar',
  title,
  subtitle,
  limit = 8,
  showViewAll = false,
  viewAllLink,
  showReasons = false,
  className = '',
}: RecommendedProductsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Автоматичні заголовки
  const defaultTitles = {
    similar: 'Схожі товари',
    'bought-together': 'Часто купують разом',
    personalized: 'Рекомендовані для вас',
    history: 'На основі переглянутого',
  };

  const defaultSubtitles = {
    similar: 'Товари з подібними характеристиками',
    'bought-together': 'Покупці також обрали ці товари',
    personalized: 'Підібрано спеціально для вас',
    history: 'Можливо вас зацікавить',
  };

  const displayTitle = title || defaultTitles[type];
  const displaySubtitle = subtitle || defaultSubtitles[type];

  useEffect(() => {
    fetchRecommendations();
  }, [productId, userId, type, limit]);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '/api/recommendations';
      const params = new URLSearchParams();

      if (type === 'similar' && productId) {
        url = `/api/recommendations?productId=${productId}&type=similar&limit=${limit}`;
      } else if (type === 'bought-together' && productId) {
        url = `/api/recommendations?productId=${productId}&type=bought-together&limit=${limit}`;
      } else if (type === 'personalized' && userId) {
        url = `/api/recommendations/personalized?userId=${userId}&limit=${limit}`;
      } else if (type === 'history') {
        // Отримуємо з localStorage
        const viewedIds = getRecentlyViewedIds();
        if (viewedIds.length > 0) {
          url = `/api/recommendations/history?productIds=${viewedIds.join(',')}&limit=${limit}`;
        } else {
          setLoading(false);
          return;
        }
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();

      if (data.recommendations) {
        setRecommendations(data.recommendations);

        // Отримуємо деталі продуктів
        const productIds = data.recommendations.map((r: RecommendationData) => r.productId);
        await fetchProducts(productIds);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Не вдалося завантажити рекомендації');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (productIds: string[]) => {
    try {
      const response = await fetch(`/api/products?ids=${productIds.join(',')}`);
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const getRecentlyViewedIds = (): string[] => {
    try {
      const stored = localStorage.getItem('recently-viewed');
      if (stored) {
        const items = JSON.parse(stored);
        return items.map((item: any) => item.productId).slice(0, 5);
      }
    } catch (e) {
      console.error('Error reading recently viewed:', e);
    }
    return [];
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById(`recommendations-${type}`);
    if (container) {
      const scrollAmount = 300;
      const newPosition = direction === 'left'
        ? Math.max(0, scrollPosition - scrollAmount)
        : scrollPosition + scrollAmount;

      container.scrollTo({ left: newPosition, behavior: 'smooth' });
      setScrollPosition(newPosition);
    }
  };

  if (loading) {
    return <LoadingSkeleton title={displayTitle} />;
  }

  if (error || products.length === 0) {
    return null;
  }

  return (
    <section className={`py-8 ${className}`} aria-labelledby={`recommendations-title-${type}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <SparklesIcon className="w-6 h-6 text-teal-600" />
          <div>
            <h2
              id={`recommendations-title-${type}`}
              className="text-2xl font-bold text-gray-900"
            >
              {displayTitle}
            </h2>
            {displaySubtitle && (
              <p className="text-sm text-gray-500 mt-1">{displaySubtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Scroll buttons */}
          <div className="hidden lg:flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Прокрутити ліворуч"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              aria-label="Прокрутити праворуч"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {showViewAll && viewAllLink && (
            <Link
              href={viewAllLink}
              className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium group"
            >
              Переглянути всі
              <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Products Carousel */}
      <div className="relative">
        <div
          id={`recommendations-${type}`}
          className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4 -mx-4 px-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {products.map((product, index) => {
            const recommendation = recommendations.find(r => r.productId === product.id);

            return (
              <div key={product.id} className="flex-none w-[280px] relative">
                {/* Recommendation Badge */}
                {showReasons && recommendation?.reasons && recommendation.reasons.length > 0 && (
                  <div className="absolute top-2 left-2 z-20 bg-teal-600 text-white text-xs px-2 py-1 rounded-lg shadow-lg max-w-[200px] truncate">
                    {recommendation.reasons[0]}
                  </div>
                )}

                <ProductCard
                  product={product}
                  priority={index < 4}
                  showQuickView={false}
                />
              </div>
            );
          })}
        </div>

        {/* Gradient overlays for scroll indication */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>

      {/* Mobile: Show all link */}
      {showViewAll && viewAllLink && (
        <div className="lg:hidden mt-6 text-center">
          <Link
            href={viewAllLink}
            className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium"
          >
            Переглянути всі рекомендації
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

/**
 * Skeleton loader для рекомендацій
 */
function LoadingSkeleton({ title }: { title: string }) {
  return (
    <section className="py-8" aria-label={`Завантаження ${title}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div>
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            {/* Image skeleton */}
            <div className="aspect-square bg-gray-200 animate-pulse" />

            {/* Content skeleton */}
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Компактна версія для бічних панелей
 */
export function RecommendedProductsCompact({
  productId,
  type = 'similar',
  limit = 3,
}: Pick<RecommendedProductsProps, 'productId' | 'type' | 'limit'>) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;

    const fetchData = async () => {
      try {
        const response = await fetch(
          `/api/recommendations?productId=${productId}&type=${type}&limit=${limit}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.recommendations) {
            const productIds = data.recommendations.map((r: any) => r.productId);
            const productsRes = await fetch(`/api/products?ids=${productIds.join(',')}`);
            if (productsRes.ok) {
              const productsData = await productsRes.json();
              setProducts(productsData.products || []);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching compact recommendations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [productId, type, limit]);

  if (loading || products.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900">Схожі товари</h3>
      <div className="space-y-3">
        {products.map(product => (
          <Link
            key={product.id}
            href={`/product/${product.id}`}
            className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-2">
                {product.name}
              </p>
              <p className="text-lg font-bold text-teal-600 mt-1">
                {product.price.toLocaleString('uk-UA')} грн
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
