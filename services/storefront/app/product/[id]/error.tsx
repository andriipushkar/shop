'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

export default function ProductError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Product page error:', error, { digest: error.digest });
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ExclamationTriangleIcon className="w-8 h-8 text-gray-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Не вдалось завантажити товар
                </h1>
                <p className="text-gray-600 mb-6">
                    Товар може бути тимчасово недоступний або видалений. Спробуйте оновити сторінку.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Оновити
                    </button>
                    <Link
                        href="/search"
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <MagnifyingGlassIcon className="w-4 h-4" />
                        Пошук товарів
                    </Link>
                </div>
            </div>
        </div>
    );
}
