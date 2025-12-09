'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Application error:', error);
    }, [error]);

    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="text-center max-w-lg">
                {/* Error Icon */}
                <div className="mb-8">
                    <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <ExclamationTriangleIcon className="w-12 h-12 text-red-600" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Щось пішло не так
                </h1>
                <p className="text-gray-600 mb-8">
                    Вибачте, сталася помилка при завантаженні сторінки.
                    Спробуйте оновити сторінку або поверніться пізніше.
                </p>

                {/* Error Details (only in development) */}
                {process.env.NODE_ENV === 'development' && error?.message && (
                    <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
                        <p className="text-sm font-mono text-red-700 break-all">
                            {error.message}
                        </p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                    >
                        <ArrowPathIcon className="w-5 h-5" />
                        Спробувати знову
                    </button>
                    <Link
                        href="/"
                        className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                        На головну
                    </Link>
                </div>

                {/* Support Info */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">
                        Якщо проблема повторюється, зв&apos;яжіться з нами:
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href="tel:0800123456" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            0 800 123 456
                        </a>
                        <Link href="/contact" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Форма зворотного зв&apos;язку
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
