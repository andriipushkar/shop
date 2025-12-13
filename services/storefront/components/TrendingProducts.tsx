'use client';

import { useState, useEffect } from 'react';
import ProductCard from './ProductCard';
import { FireIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
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

interface TrendingData {
  productId: string;
  score: number;
  views?: number;
  sales?: number;
  trend?: 'rising' | 'steady' | 'falling';
  product?: Product;
}

interface TrendingProductsProps {
  /** Максимальна кількість товарів */
  limit?: number;
  /** Період для trending (days) */
  period?: 7 | 14 | 30;
  /** Заголовок секції */
  title?: string;
  /** Показати тренди (стрілки вгору/вниз) */
  showTrends?: boolean;
  /** Показати статистику (перегляди, продажі) */
  showStats?: boolean;
  /** Показати посилання "Переглянути всі" */
  showViewAll?: boolean;
  /** Варіант відображення */
  variant?: 'grid' | 'carousel' | 'compact';
  /** CSS класи */
  className?: string;
}

export default function TrendingProducts({
  limit = 8,
  period = 7,
  title = 'Популярні зараз',
  showTrends = true,
  showStats = false,
  showViewAll = true,
  variant = 'grid',
  className = '',
}: TrendingProductsProps) {
  const [trending, setTrending] = useState<TrendingData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrending();
  }, [limit, period]);

  const fetchTrending = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/recommendations/trending?limit=${limit}&period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trending products');
      }

      const data = await response.json();

      if (data.recommendations) {
        setTrending(data.recommendations);

        // Отримуємо деталі продуктів
        const productIds = data.recommendations.map((r: TrendingData) => r.productId);
        await fetchProducts(productIds);
      }
    } catch (err) {
      console.error('Error fetching trending products:', err);
      setError('Не вдалося завантажити популярні товари');
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

  if (loading) {
    return <LoadingSkeleton title={title} variant={variant} />;
  }

  if (error || products.length === 0) {
    return null;
  }

  if (variant === 'compact') {
    return <CompactView products={products} trending={trending} title={title} showTrends={showTrends} />;
  }

  return (
    <section className={`py-8 ${className}`} aria-labelledby="trending-products-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <FireIcon className="w-8 h-8 text-orange-500 animate-pulse" />
            <div className="absolute inset-0 bg-orange-500 blur-lg opacity-30 animate-pulse" />
          </div>
          <div>
            <h2 id="trending-products-title" className="text-2xl font-bold text-gray-900">
              {title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Найбільш популярні товари за {period === 7 ? 'тиждень' : period === 14 ? '2 тижні' : 'місяць'}
            </p>
          </div>
        </div>

        {showViewAll && (
          <Link
            href="/trending"
            className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium group"
          >
            Всі популярні
            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      {/* Products Grid or Carousel */}
      {variant === 'carousel' ? (
        <div className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4">
          {products.map((product, index) => {
            const trendData = trending.find(t => t.productId === product.id);
            return (
              <div key={product.id} className="flex-none w-[280px] relative">
                {/* Trending Badge */}
                <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <FireIcon className="w-4 h-4" />
                  #{index + 1}
                </div>

                {/* Trend Indicator */}
                {showTrends && trendData?.trend && (
                  <div className="absolute top-2 right-2 z-20">
                    {trendData.trend === 'rising' && (
                      <div className="bg-green-500 text-white p-1 rounded-full shadow-lg">
                        <ArrowTrendingUpIcon className="w-5 h-5" />
                      </div>
                    )}
                    {trendData.trend === 'falling' && (
                      <div className="bg-red-500 text-white p-1 rounded-full shadow-lg">
                        <ArrowTrendingDownIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )}

                <ProductCard product={product} priority={index < 4} showQuickView={false} />

                {/* Stats */}
                {showStats && trendData && (
                  <div className="mt-2 px-2 py-1 bg-gray-50 rounded-lg text-xs text-gray-600 flex justify-between">
                    {trendData.views !== undefined && <span>Переглядів: {trendData.views}</span>}
                    {trendData.sales !== undefined && <span>Продажів: {trendData.sales}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product, index) => {
            const trendData = trending.find(t => t.productId === product.id);
            return (
              <div key={product.id} className="relative">
                {/* Trending Badge */}
                <div className="absolute top-2 left-2 z-20 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <FireIcon className="w-4 h-4" />
                  #{index + 1}
                </div>

                {/* Trend Indicator */}
                {showTrends && trendData?.trend && (
                  <div className="absolute top-2 right-2 z-20">
                    {trendData.trend === 'rising' && (
                      <div className="bg-green-500 text-white p-1 rounded-full shadow-lg" title="Зростаючий попит">
                        <ArrowTrendingUpIcon className="w-5 h-5" />
                      </div>
                    )}
                    {trendData.trend === 'falling' && (
                      <div className="bg-red-500 text-white p-1 rounded-full shadow-lg" title="Падаючий попит">
                        <ArrowTrendingDownIcon className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                )}

                <ProductCard product={product} priority={index < 4} showQuickView={false} />

                {/* Stats */}
                {showStats && trendData && (
                  <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 flex justify-between">
                    {trendData.views !== undefined && <span>Переглядів: {trendData.views}</span>}
                    {trendData.sales !== undefined && <span>Продажів: {trendData.sales}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * Компактний вигляд для бічних панелей
 */
function CompactView({
  products,
  trending,
  title,
  showTrends,
}: {
  products: Product[];
  trending: TrendingData[];
  title: string;
  showTrends: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <FireIcon className="w-6 h-6 text-orange-500" />
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>

      <div className="space-y-3">
        {products.slice(0, 5).map((product, index) => {
          const trendData = trending.find(t => t.productId === product.id);
          return (
            <Link
              key={product.id}
              href={`/product/${product.id}`}
              className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold rounded-full flex items-center justify-center text-sm">
                {index + 1}
              </div>

              {/* Image */}
              {product.image_url && (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-teal-600 transition-colors">
                    {product.name}
                  </p>
                  {showTrends && trendData?.trend === 'rising' && (
                    <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-base font-bold text-teal-600 mt-1">
                  {product.price.toLocaleString('uk-UA')} грн
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <Link
        href="/trending"
        className="mt-4 w-full py-2 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium text-center hover:from-orange-600 hover:to-red-600 transition-all flex items-center justify-center gap-2"
      >
        Всі популярні товари
        <ArrowRightIcon className="w-4 h-4" />
      </Link>
    </div>
  );
}

/**
 * Skeleton loader
 */
function LoadingSkeleton({ title, variant }: { title: string; variant: string }) {
  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
              <div className="w-16 h-16 bg-gray-200 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-8" aria-label={`Завантаження ${title}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="aspect-square bg-gray-200 animate-pulse" />
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
 * Widget для головної сторінки з топ-3
 */
export function TrendingProductsWidget() {
  return (
    <TrendingProducts
      limit={3}
      variant="compact"
      title="🔥 Топ-3 тижня"
      showTrends={true}
      showViewAll={true}
    />
  );
}
