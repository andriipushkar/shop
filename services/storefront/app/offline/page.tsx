'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WifiIcon, ArrowPathIcon, HomeIcon, ShoppingCartIcon, HeartIcon, ClockIcon } from '@heroicons/react/24/outline';
import { cartStorage, recentlyViewedStorage, Product } from '@/lib/pwa/offline-storage';

export default function OfflinePage() {
  const [cartCount, setCartCount] = useState(0);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  useEffect(() => {
    loadOfflineData();
  }, []);

  const loadOfflineData = async () => {
    // Load cart count
    const cartItems = await cartStorage.getAll();
    setCartCount(cartItems.length);

    // Load recently viewed products
    const recent = await recentlyViewedStorage.getAll(3);
    setRecentProducts(recent);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm p-8">
          {/* Offline Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiIcon className="w-10 h-10 text-red-600" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Немає з'єднання
          </h1>

          {/* Description */}
          <p className="text-gray-500 mb-8">
            Перевірте підключення до інтернету та спробуйте ще раз.
            Ви можете переглядати збережені дані в офлайн-режимі.
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRefresh}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Спробувати знову
            </button>

            <div className="grid grid-cols-3 gap-2">
              <Link
                href="/"
                className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <HomeIcon className="w-6 h-6 text-gray-600 mb-1" />
                <span className="text-xs text-gray-700 font-medium">Головна</span>
              </Link>
              <Link
                href="/cart"
                className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors relative"
              >
                <ShoppingCartIcon className="w-6 h-6 text-gray-600 mb-1" />
                <span className="text-xs text-gray-700 font-medium">Кошик</span>
                {cartCount > 0 && (
                  <span className="absolute top-2 right-2 bg-teal-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link
                href="/wishlist"
                className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                <HeartIcon className="w-6 h-6 text-gray-600 mb-1" />
                <span className="text-xs text-gray-700 font-medium">Улюблені</span>
              </Link>
            </div>
          </div>

          {/* Recently viewed products */}
          {recentProducts.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center gap-2 mb-4">
                <ClockIcon className="w-5 h-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">
                  Нещодавно переглянуті
                </h3>
              </div>
              <div className="space-y-3">
                {recentProducts.map((product) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                  >
                    {product.image && (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-sm text-teal-600 font-semibold">
                        {product.price} ₴
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Що можна зробити:
            </h3>
            <ul className="text-sm text-gray-500 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5 font-bold">•</span>
                Перевірте налаштування Wi-Fi або мобільних даних
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5 font-bold">•</span>
                Спробуйте перезавантажити сторінку
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5 font-bold">•</span>
                Переглядайте збережені товари в кошику
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5 font-bold">•</span>
                Зміни будуть синхронізовані при з'єднанні
              </li>
            </ul>
          </div>
        </div>

        {/* App Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Порада:</strong> Встановіть TechShop як додаток для кращої роботи в офлайн режимі
          </p>
        </div>
      </div>
    </main>
  );
}
