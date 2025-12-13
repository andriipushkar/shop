import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Сторінку не знайдено (404) | TechShop',
    description: 'На жаль, сторінку не знайдено. Поверніться на головну або скористайтесь пошуком.',
    robots: {
        index: false,
        follow: true,
    },
};

export default function NotFound() {
    return (
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="text-center max-w-lg">
                {/* 404 Illustration */}
                <div className="mb-8">
                    <span className="text-9xl font-bold bg-gradient-to-r from-teal-600 to-teal-600 bg-clip-text text-transparent">
                        404
                    </span>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Сторінку не знайдено
                </h1>
                <p className="text-gray-600 mb-8">
                    На жаль, сторінка, яку ви шукаєте, не існує або була переміщена.
                    Перевірте правильність адреси або поверніться на головну.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/"
                        className="px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                    >
                        На головну
                    </Link>
                    <Link
                        href="/contact"
                        className="px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                    >
                        Зв&apos;язатися з нами
                    </Link>
                </div>

                {/* Helpful Links */}
                <div className="mt-12 pt-8 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-4">Можливо, вас зацікавить:</p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link href="/category/electronics" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Електроніка
                        </Link>
                        <Link href="/category/clothing" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Одяг
                        </Link>
                        <Link href="/sale" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            Акції
                        </Link>
                        <Link href="/faq" className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                            FAQ
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
