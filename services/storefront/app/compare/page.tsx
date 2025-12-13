'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ComparisonTable from '@/components/ComparisonTable';
import {
  comparisonService,
  ComparisonProduct,
} from '@/lib/comparison/comparison-service';

/**
 * Comparison Page Component
 */
function ComparisonPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ComparisonProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [searchParams]);

  const loadProducts = async () => {
    setIsLoading(true);

    // Check if loading from URL params
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const productIds = idsParam.split(',').filter(Boolean);
      // In a real app, you would fetch these products from your API
      // For now, we'll try to get them from the comparison service
      const currentProducts = comparisonService.getProducts();
      const filteredProducts = currentProducts.filter(p =>
        productIds.includes(p.id)
      );
      setProducts(filteredProducts);
    } else {
      // Load from comparison service
      const currentProducts = comparisonService.getProducts();
      setProducts(currentProducts);
    }

    setIsLoading(false);
    updateShareUrl();
  };

  const updateShareUrl = () => {
    const url = comparisonService.getShareableUrl();
    setShareUrl(url);
  };

  const handleShare = async () => {
    if (!shareUrl) return;

    // Try native share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Порівняння товарів',
          text: 'Подивіться на це порівняння товарів',
          url: shareUrl,
        });
        return;
      } catch (error) {
        // Fall through to copy
      }
    }

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (confirm('Очистити всі товари з порівняння?')) {
      comparisonService.clear();
      setProducts([]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Завантаження порівняння...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 print:border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Порівняння товарів
              </h1>
              {products.length > 0 && (
                <p className="mt-1 text-gray-600">
                  Порівнюється {products.length}{' '}
                  {products.length === 1
                    ? 'товар'
                    : products.length < 5
                    ? 'товари'
                    : 'товарів'}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 print:hidden">
              {products.length > 0 && (
                <>
                  {/* Share button */}
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    <span>{copied ? 'Скопійовано!' : 'Поділитися'}</span>
                  </button>

                  {/* Print button */}
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    <span>Друк</span>
                  </button>

                  {/* Clear button */}
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
                    <span>Очистити</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12">
            <div className="text-center">
              <svg
                className="w-24 h-24 mx-auto text-gray-400 mb-4"
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
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Немає товарів для порівняння
              </h3>
              <p className="text-gray-600 mb-6">
                Почніть додавати товари до порівняння, щоб побачити їх
                характеристики поруч
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                На головну
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ComparisonTable initialProducts={products} />

            {/* Add more products */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 print:hidden">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">
                    Хочете додати більше товарів?
                  </h4>
                  <p className="text-gray-700 mb-4">
                    Ви можете порівняти до {comparisonService.getMaxProducts()}{' '}
                    товарів одночасно. Зараз у порівнянні: {products.length}
                  </p>
                  {products.length < comparisonService.getMaxProducts() && (
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Додати ще товари
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Main page component with Suspense wrapper
 */
export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Завантаження...</p>
          </div>
        </div>
      }
    >
      <ComparisonPageContent />
    </Suspense>
  );
}
