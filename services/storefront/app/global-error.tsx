'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-md w-full text-center">
                        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                            Щось пішло не так
                        </h2>
                        <p className="text-gray-600 mb-8">
                            Вибачте, виникла неочікувана помилка. Ми вже працюємо над її
                            виправленням.
                        </p>
                        <div className="space-x-4">
                            <button
                                onClick={reset}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Спробувати знову
                            </button>
                            <a
                                href="/"
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors inline-block"
                            >
                                На головну
                            </a>
                        </div>
                        {error.digest && (
                            <p className="mt-8 text-sm text-gray-400">
                                Код помилки: {error.digest}
                            </p>
                        )}
                    </div>
                </div>
            </body>
        </html>
    );
}
