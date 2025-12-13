'use client';

import { useMemo } from 'react';
import ProductCard from './ProductCard';
import { products as allProducts, Product } from '@/lib/mock-data';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface RelatedProductsProps {
  /** Current product ID to exclude from results */
  currentProductId: string;
  /** Category ID to find related products */
  categoryId?: string;
  /** Brand name to find related products */
  brand?: string;
  /** Maximum number of products to show */
  maxProducts?: number;
  /** Title for the section */
  title?: string;
  /** Show "View all" link */
  showViewAll?: boolean;
  /** Link for "View all" */
  viewAllLink?: string;
}

/**
 * RelatedProducts component for displaying products related to the current product.
 * Uses category and brand matching to find relevant products.
 * Improves internal linking structure for better SEO.
 */
export default function RelatedProducts({
  currentProductId,
  categoryId,
  brand,
  maxProducts = 4,
  title = 'Схожі товари',
  showViewAll = true,
  viewAllLink,
}: RelatedProductsProps) {
  const relatedProducts = useMemo(() => {
    // Filter out current product
    let candidates = allProducts.filter(p => p.id !== currentProductId);

    // Score products based on relevance
    const scoredProducts = candidates.map(product => {
      let score = 0;

      // Same category - highest priority
      if (categoryId && product.category_id === categoryId) {
        score += 10;
      }

      // Same brand - high priority
      if (brand && product.brand === brand) {
        score += 5;
      }

      // Similar price range (within 30%)
      const currentProduct = allProducts.find(p => p.id === currentProductId);
      if (currentProduct) {
        const priceDiff = Math.abs(product.price - currentProduct.price) / currentProduct.price;
        if (priceDiff < 0.3) {
          score += 3;
        }
      }

      // Has good rating
      if (product.rating && product.rating >= 4.0) {
        score += 2;
      }

      // In stock bonus
      if (product.stock > 0) {
        score += 1;
      }

      return { product, score };
    });

    // Sort by score and take top products
    return scoredProducts
      .filter(item => item.score > 0) // Only show relevant products
      .sort((a, b) => b.score - a.score)
      .slice(0, maxProducts)
      .map(item => item.product);
  }, [currentProductId, categoryId, brand, maxProducts]);

  // Don't render if no related products found
  if (relatedProducts.length === 0) {
    return null;
  }

  const defaultViewAllLink = categoryId ? `/category/${categoryId}` : '/category/all';

  return (
    <section className="py-8" aria-labelledby="related-products-title">
      <div className="flex items-center justify-between mb-6">
        <h2
          id="related-products-title"
          className="text-2xl font-bold text-gray-900"
        >
          {title}
        </h2>
        {showViewAll && (
          <Link
            href={viewAllLink || defaultViewAllLink}
            className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-medium group"
          >
            Переглянути всі
            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {relatedProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            priority={index < 2} // Priority for first 2 images
            showQuickView={false}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Also export variations for different contexts
 */

interface CrossSellProductsProps {
  currentProductId: string;
  categoryId?: string;
  maxProducts?: number;
}

/**
 * CrossSellProducts - Shows products from different categories
 * that complement the current product.
 */
export function CrossSellProducts({
  currentProductId,
  categoryId,
  maxProducts = 4,
}: CrossSellProductsProps) {
  const crossSellProducts = useMemo(() => {
    // Get products from different categories (accessories, related items)
    const candidates = allProducts.filter(p =>
      p.id !== currentProductId &&
      p.category_id !== categoryId &&
      p.stock > 0
    );

    // Prioritize products with good ratings and reasonable prices
    return candidates
      .sort((a, b) => {
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (Math.abs(ratingDiff) > 0.3) return ratingDiff;
        return b.reviewCount - a.reviewCount;
      })
      .slice(0, maxProducts);
  }, [currentProductId, categoryId, maxProducts]);

  if (crossSellProducts.length === 0) {
    return null;
  }

  return (
    <section className="py-8" aria-labelledby="cross-sell-title">
      <h2
        id="cross-sell-title"
        className="text-2xl font-bold text-gray-900 mb-6"
      >
        Вас також може зацікавити
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {crossSellProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showQuickView={false}
          />
        ))}
      </div>
    </section>
  );
}

interface RecentlyBoughtTogetherProps {
  currentProductId: string;
  maxProducts?: number;
}

/**
 * RecentlyBoughtTogether - Shows products frequently purchased together
 * (In a real app, this would use analytics data)
 */
export function RecentlyBoughtTogether({
  currentProductId,
  maxProducts = 3,
}: RecentlyBoughtTogetherProps) {
  const boughtTogetherProducts = useMemo(() => {
    // In a real app, this would come from analytics/recommendation engine
    // For now, we'll show random high-rated products as a simulation
    const candidates = allProducts.filter(p =>
      p.id !== currentProductId &&
      p.stock > 0 &&
      p.rating && p.rating >= 4.0
    );

    // Shuffle and take first few
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, maxProducts);
  }, [currentProductId, maxProducts]);

  if (boughtTogetherProducts.length === 0) {
    return null;
  }

  // Calculate bundle price
  const currentProduct = allProducts.find(p => p.id === currentProductId);
  const bundlePrice = boughtTogetherProducts.reduce(
    (sum, p) => sum + p.price,
    currentProduct?.price || 0
  );
  const originalBundlePrice = boughtTogetherProducts.reduce(
    (sum, p) => sum + (p.oldPrice || p.price),
    currentProduct?.oldPrice || currentProduct?.price || 0
  );

  return (
    <section className="py-8 bg-gray-50 rounded-2xl p-6" aria-labelledby="bought-together-title">
      <h2
        id="bought-together-title"
        className="text-xl font-bold text-gray-900 mb-4"
      >
        Часто купують разом
      </h2>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {boughtTogetherProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              showQuickView={false}
            />
          ))}
        </div>
        <div className="lg:w-64 bg-white rounded-xl p-4 flex flex-col justify-center">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Ціна комплекту</p>
            <p className="text-2xl font-bold text-teal-600">
              {bundlePrice.toLocaleString('uk-UA')} грн
            </p>
            {originalBundlePrice > bundlePrice && (
              <p className="text-sm text-gray-400 line-through">
                {originalBundlePrice.toLocaleString('uk-UA')} грн
              </p>
            )}
            <button className="mt-4 w-full py-3 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors">
              Додати все в кошик
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
