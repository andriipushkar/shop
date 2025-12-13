'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  comparisonService,
  ComparisonProduct,
  ComparisonAttribute,
} from '@/lib/comparison/comparison-service';

interface ComparisonTableProps {
  initialProducts?: ComparisonProduct[];
  showDifferencesOnly?: boolean;
}

/**
 * ComparisonTable Component
 * Full side-by-side product comparison table
 */
export default function ComparisonTable({
  initialProducts,
  showDifferencesOnly = false,
}: ComparisonTableProps) {
  const [products, setProducts] = useState<ComparisonProduct[]>(
    initialProducts || []
  );
  const [attributes, setAttributes] = useState<ComparisonAttribute[]>([]);
  const [filterDifferences, setFilterDifferences] =
    useState(showDifferencesOnly);
  const [stickyHeader, setStickyHeader] = useState(false);

  useEffect(() => {
    if (!initialProducts) {
      updateProducts();

      const unsubscribe = comparisonService.subscribe(() => {
        updateProducts();
      });

      return unsubscribe;
    }
  }, [initialProducts]);

  useEffect(() => {
    if (products.length > 0) {
      const attrs = comparisonService.getComparableAttributes(products);
      setAttributes(attrs);
    }
  }, [products]);

  useEffect(() => {
    const handleScroll = () => {
      setStickyHeader(window.scrollY > 200);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const updateProducts = () => {
    const currentProducts = comparisonService.getProducts();
    setProducts(currentProducts);
  };

  const handleRemoveProduct = (productId: string) => {
    comparisonService.removeProduct(productId);
  };

  const displayedAttributes = filterDifferences
    ? attributes.filter(attr => attr.hasDifference)
    : attributes;

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
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
          Додайте товари до порівняння, щоб побачити їх характеристики поруч
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Переглянути каталог
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterDifferences}
              onChange={e => setFilterDifferences(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Показувати тільки відмінності
            </span>
          </label>
        </div>

        <div className="text-sm text-gray-600">
          Порівнюється: {products.length} товарів
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Product Cards Header */}
            <thead
              className={`${
                stickyHeader ? 'sticky top-0 z-10 shadow-md' : ''
              } bg-white`}
            >
              <tr>
                <th className="w-48 p-4 bg-gray-50 border-b border-r border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">
                    Характеристика
                  </span>
                </th>
                {products.map(product => (
                  <th
                    key={product.id}
                    className="p-4 border-b border-gray-200 min-w-[250px]"
                  >
                    <div className="space-y-3">
                      {/* Remove button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleRemoveProduct(product.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Видалити з порівняння"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Product image */}
                      <Link href={`/product/${product.id}`}>
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={200}
                            height={200}
                            className="w-full h-40 object-contain rounded"
                          />
                        ) : (
                          <div className="w-full h-40 bg-gray-100 rounded flex items-center justify-center">
                            <svg
                              className="w-16 h-16 text-gray-400"
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
                      </Link>

                      {/* Product name */}
                      <Link
                        href={`/product/${product.id}`}
                        className="block font-medium text-gray-900 hover:text-blue-600 line-clamp-2"
                      >
                        {product.name}
                      </Link>

                      {/* Price */}
                      <div className="text-2xl font-bold text-blue-600">
                        {product.price.toLocaleString('uk-UA')} ₴
                      </div>

                      {/* Stock status */}
                      <div
                        className={`text-sm ${
                          product.stock > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {product.stock > 0
                          ? `В наявності: ${product.stock} шт.`
                          : 'Немає в наявності'}
                      </div>

                      {/* Action button */}
                      <Link
                        href={`/product/${product.id}`}
                        className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Переглянути
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Attributes Body */}
            <tbody>
              {displayedAttributes.map((attr, index) => (
                <tr
                  key={attr.key}
                  className={`${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } ${attr.hasDifference ? 'bg-yellow-50' : ''}`}
                >
                  <td className="p-4 border-r border-gray-200 font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      {attr.label}
                      {attr.hasDifference && (
                        <span
                          className="text-xs text-yellow-600"
                          title="Відмінність"
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                  </td>
                  {attr.values.map((value, idx) => (
                    <td
                      key={idx}
                      className="p-4 border-l border-gray-100 text-center"
                    >
                      {renderAttributeValue(attr, value, idx)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      {filterDifferences && displayedAttributes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Всі характеристики однакові
        </div>
      )}
    </div>
  );
}

/**
 * Render attribute value based on type
 */
function renderAttributeValue(
  attr: ComparisonAttribute,
  value: string | number | boolean | null,
  index: number
): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  switch (attr.type) {
    case 'rating':
      const rating = typeof value === 'number' ? value : 0;
      return (
        <div className="flex items-center justify-center gap-1">
          <span className="text-yellow-500">★</span>
          <span className="font-medium">{rating.toFixed(1)}</span>
        </div>
      );

    case 'boolean':
      return (
        <div
          className={`inline-flex items-center gap-1 ${
            value ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          {value ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Так</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Ні</span>
            </>
          )}
        </div>
      );

    case 'number':
      if (attr.key === 'price') {
        return (
          <span className="font-semibold text-blue-600">
            {(value as number).toLocaleString('uk-UA')} ₴
          </span>
        );
      }
      return <span className="font-medium">{value}</span>;

    case 'text':
    default:
      return <span>{String(value)}</span>;
  }
}
