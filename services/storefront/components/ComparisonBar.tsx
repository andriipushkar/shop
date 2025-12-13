'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { comparisonService, ComparisonProduct } from '@/lib/comparison/comparison-service';

/**
 * ComparisonBar Component
 * Sticky bar showing selected products for comparison
 */
export default function ComparisonBar() {
  const [products, setProducts] = useState<ComparisonProduct[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    // Load initial state
    updateProducts();

    // Subscribe to changes
    const unsubscribe = comparisonService.subscribe(() => {
      updateProducts();
    });

    return unsubscribe;
  }, []);

  const updateProducts = () => {
    const currentProducts = comparisonService.getProducts();
    setProducts(currentProducts);
    setIsVisible(currentProducts.length > 0);
  };

  const handleRemove = (productId: string) => {
    comparisonService.removeProduct(productId);
  };

  const handleClear = () => {
    if (confirm('Очистити всі товари з порівняння?')) {
      comparisonService.clear();
    }
  };

  if (!isVisible) {
    return null;
  }

  const maxProducts = comparisonService.getMaxProducts();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg transition-transform duration-300">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
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
            <span className="font-medium text-gray-900">
              Порівняння товарів
            </span>
            <span className="text-sm text-gray-500">
              ({products.length} з {maxProducts})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {products.length >= 2 && (
            <Link
              href="/compare"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Порівняти
            </Link>
          )}

          <button
            onClick={handleClear}
            className="text-gray-500 hover:text-red-600 transition-colors p-2"
            title="Очистити все"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Products List */}
      {isExpanded && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-4 overflow-x-auto">
            {products.map(product => (
              <div
                key={product.id}
                className="flex-shrink-0 w-40 bg-white border border-gray-200 rounded-lg p-2 hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  <button
                    onClick={() => handleRemove(product.id)}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
                    title="Видалити"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      width={140}
                      height={140}
                      className="w-full h-24 object-contain rounded"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                <h4 className="mt-2 text-sm font-medium text-gray-900 line-clamp-2">
                  {product.name}
                </h4>

                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-600">
                    {product.price.toLocaleString('uk-UA')} ₴
                  </span>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: maxProducts - products.length }).map(
              (_, index) => (
                <div
                  key={`empty-${index}`}
                  className="flex-shrink-0 w-40 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400"
                >
                  <div className="text-center">
                    <svg
                      className="w-8 h-8 mx-auto mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span className="text-xs">Додайте товар</span>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Help text */}
          {products.length === 1 && (
            <div className="mt-3 text-sm text-gray-500 text-center">
              Додайте ще принаймні один товар для порівняння
            </div>
          )}

          {products.length >= maxProducts && (
            <div className="mt-3 text-sm text-orange-600 text-center">
              Досягнуто максимальної кількості товарів для порівняння
            </div>
          )}
        </div>
      )}
    </div>
  );
}
