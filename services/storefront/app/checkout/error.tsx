'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon, ArrowPathIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

export default function CheckoutError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Checkout error:', error, { digest: error.digest });
    }, [error]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Помилка оформлення
                </h1>
                <p className="text-gray-600 mb-6">
                    На жаль, виникла помилка при оформленні замовлення. Ваш кошик збережено, спробуйте ще раз.
                </p>
                {error.digest && (
                    <p className="text-xs text-gray-400 mb-4">
                        Код: {error.digest}
                    </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-medium"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                        Спробувати знову
                    </button>
                    <Link
                        href="/cart"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                        <ShoppingCartIcon className="w-5 h-5" />
                        До кошика
                    </Link>
                </div>
                <p className="text-sm text-gray-500 mt-6">
                    Якщо проблема повторюється, зверніться до{' '}
                    <Link href="/contact" className="text-teal-600 hover:underline">
                        служби підтримки
                    </Link>
                </p>
            </div>
        </div>
    );
}
