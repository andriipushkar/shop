/**
 * Integration Examples for Product Comparison Feature
 *
 * This file shows how to integrate the comparison feature
 * into existing components of your e-commerce storefront.
 */

// ============================================
// Example 1: Add CompareButton to ProductCard
// ============================================

import CompareButton from '@/components/CompareButton';
import { Product } from '@/lib/api';

interface ProductCardProps {
  product: Product & {
    category?: { id: string; name: string };
    brand?: string;
    rating?: number;
    reviewCount?: number;
    attributes?: Record<string, any>;
  };
}

export function ProductCardWithComparison({ product }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="relative">
        <img
          src={product.image_url || '/placeholder.jpg'}
          alt={product.name}
          className="w-full h-48 object-contain"
        />

        {/* Compare button in top-right corner */}
        <div className="absolute top-2 right-2">
          <CompareButton
            product={product}
            variant="icon"
            size="md"
          />
        </div>
      </div>

      {/* Product Info */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
          {product.name}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-blue-600">
            {product.price.toLocaleString('uk-UA')} ₴
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <button className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            В кошик
          </button>
          <CompareButton
            product={product}
            variant="icon"
            size="md"
            className="flex-shrink-0"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Example 2: Product Detail Page Integration
// ============================================

export function ProductDetailPageWithComparison({ product }: ProductCardProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Images */}
        <div>
          <img
            src={product.image_url || '/placeholder.jpg'}
            alt={product.name}
            className="w-full rounded-lg"
          />
        </div>

        {/* Right: Product Info */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-4xl font-bold text-blue-600">
              {product.price.toLocaleString('uk-UA')} ₴
            </span>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-3">
            <button className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 text-lg font-medium">
              Додати в кошик
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
                В обране
              </button>
              <CompareButton
                product={product}
                variant="icon-text"
                size="md"
              />
            </div>
          </div>

          {/* Product attributes can be used for comparison */}
          {product.attributes && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Характеристики</h3>
              <dl className="space-y-2">
                {Object.entries(product.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-2 border-b">
                    <dt className="text-gray-600">{key}</dt>
                    <dd className="font-medium">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Example 3: Product List with Comparison
// ============================================

interface ProductListProps {
  products: ProductCardProps['product'][];
  category: { id: string; name: string };
}

export function ProductListWithComparison({ products, category }: ProductListProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{category.name}</h2>
        <p className="text-gray-600">
          {products.length} товарів
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map(product => (
          <ProductCardWithComparison
            key={product.id}
            product={{
              ...product,
              category,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Example 4: Header with Comparison Counter
// ============================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { comparisonService } from '@/lib/comparison/comparison-service';

export function HeaderWithComparisonCounter() {
  const [comparisonCount, setComparisonCount] = useState(0);

  useEffect(() => {
    // Initial count
    setComparisonCount(comparisonService.getCount());

    // Subscribe to changes
    const unsubscribe = comparisonService.subscribe(() => {
      setComparisonCount(comparisonService.getCount());
    });

    return unsubscribe;
  }, []);

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Shop
          </Link>

          <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-700 hover:text-blue-600">
              Каталог
            </Link>

            {/* Comparison Link with Counter */}
            <Link
              href="/compare"
              className="relative text-gray-700 hover:text-blue-600"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span>Порівняння</span>
              </div>

              {comparisonCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {comparisonCount}
                </span>
              )}
            </Link>

            <Link href="/cart" className="text-gray-700 hover:text-blue-600">
              Кошик
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

// ============================================
// Example 5: Quick Compare Modal
// ============================================

'use client';

import { useState, useEffect } from 'react';
import { comparisonService, ComparisonProduct } from '@/lib/comparison/comparison-service';
import Link from 'next/link';
import Image from 'next/image';

export function QuickCompareModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<ComparisonProduct[]>([]);

  useEffect(() => {
    const unsubscribe = comparisonService.subscribe(() => {
      const currentProducts = comparisonService.getProducts();
      setProducts(currentProducts);

      // Auto-open when 2+ products
      if (currentProducts.length >= 2) {
        setIsOpen(true);
      }
    });

    return unsubscribe;
  }, []);

  if (!isOpen || products.length < 2) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Готові порівняти?</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          У вас {products.length} товари в порівнянні. Готові побачити їх характеристики поруч?
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {products.map(product => (
            <div key={product.id} className="border rounded-lg p-3">
              {product.image_url && (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  width={100}
                  height={100}
                  className="w-full h-24 object-contain mb-2"
                />
              )}
              <p className="text-sm font-medium line-clamp-2">{product.name}</p>
              <p className="text-sm text-blue-600 font-bold mt-1">
                {product.price.toLocaleString('uk-UA')} ₴
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Link
            href="/compare"
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 text-center font-medium"
          >
            Порівняти зараз
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Пізніше
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Example 6: Complete App Layout Integration
// ============================================

import ComparisonBar from '@/components/ComparisonBar';

export default function AppLayoutWithComparison({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <HeaderWithComparisonCounter />

        <main className="min-h-screen pb-24">
          {children}
        </main>

        {/* Sticky comparison bar at bottom */}
        <ComparisonBar />

        {/* Optional: Quick compare modal */}
        <QuickCompareModal />

        <footer className="bg-gray-900 text-white py-8">
          {/* Footer content */}
        </footer>
      </body>
    </html>
  );
}

// ============================================
// Example 7: Programmatic Usage
// ============================================

export function ProgrammaticComparisonExample() {
  const handleAddToComparison = (product: any) => {
    const result = comparisonService.addProduct(product);

    if (result.success) {
      // Show success notification
      alert('Товар додано до порівняння!');
    } else {
      // Show error notification
      alert(result.error || 'Не вдалося додати товар');
    }
  };

  const handleBulkAdd = (products: any[]) => {
    let successCount = 0;

    for (const product of products) {
      const result = comparisonService.addProduct(product);
      if (result.success) successCount++;
    }

    alert(`Додано ${successCount} з ${products.length} товарів`);
  };

  const handleClearAll = () => {
    if (confirm('Очистити всі товари з порівняння?')) {
      comparisonService.clear();
    }
  };

  const handleShare = async () => {
    const url = comparisonService.getShareableUrl();

    if (navigator.share) {
      await navigator.share({
        title: 'Порівняння товарів',
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
      alert('Посилання скопійовано!');
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => handleAddToComparison(/* product */)}>
        Додати до порівняння
      </button>
      <button onClick={() => handleBulkAdd(/* products */)}>
        Додати декілька
      </button>
      <button onClick={handleClearAll}>
        Очистити все
      </button>
      <button onClick={handleShare}>
        Поділитися порівнянням
      </button>
    </div>
  );
}
