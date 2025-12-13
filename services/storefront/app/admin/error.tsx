'use client';

import { useEffect } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logger.error('Admin panel error:', error, { digest: error.digest });
    }, [error]);

    return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Помилка в адмін-панелі
                </h2>
                <p className="text-gray-600 mb-6">
                    Виникла помилка при завантаженні сторінки. Спробуйте оновити сторінку або зверніться до підтримки.
                </p>
                {error.digest && (
                    <p className="text-xs text-gray-400 mb-4">
                        Код помилки: {error.digest}
                    </p>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                        Спробувати знову
                    </button>
                    <a
                        href="/admin"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        На головну
                    </a>
                </div>
            </div>
        </div>
    );
}
