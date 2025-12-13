'use client';

import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

const promoCards = [
    {
        title: 'Електроніка',
        subtitle: 'Новинки сезону',
        discount: '-30%',
        bgColor: 'bg-gradient-to-br from-blue-500 to-indigo-600',
        link: '/category/electronics',
        icon: '💻',
    },
    {
        title: 'Одяг',
        subtitle: 'Зимова колекція',
        discount: '-50%',
        bgColor: 'bg-gradient-to-br from-pink-500 to-rose-600',
        link: '/category/clothing',
        icon: '👕',
    },
    {
        title: 'Дім і сад',
        subtitle: 'Затишок вдома',
        discount: '-25%',
        bgColor: 'bg-gradient-to-br from-teal-500 to-teal-600',
        link: '/category/home',
        icon: '🏠',
    },
];

const categories = [
    { name: 'Смартфони', icon: '📱', count: 245, link: '/category/electronics/smartphones' },
    { name: 'Ноутбуки', icon: '💻', count: 128, link: '/category/electronics/laptops' },
    { name: 'Телевізори', icon: '📺', count: 89, link: '/category/electronics/tv' },
    { name: 'Навушники', icon: '🎧', count: 312, link: '/category/electronics/headphones' },
    { name: 'Годинники', icon: '⌚', count: 156, link: '/category/electronics/watches' },
    { name: 'Камери', icon: '📷', count: 67, link: '/category/electronics/cameras' },
];

export default function PromoSection() {
    return (
        <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                {/* Promo Banners */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {promoCards.map((card) => (
                        <Link
                            key={`promo-${card.title}`}
                            href={card.link}
                            className={`${card.bgColor} rounded-2xl p-6 text-white relative overflow-hidden group card-hover`}
                        >
                            <div className="relative z-10">
                                <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-semibold mb-3">
                                    {card.discount}
                                </span>
                                <h3 className="text-2xl font-bold mb-1">{card.title}</h3>
                                <p className="text-white/80 mb-4">{card.subtitle}</p>
                                <span className="inline-flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                                    Переглянути
                                    <ArrowRightIcon className="w-4 h-4" />
                                </span>
                            </div>
                            <span className="absolute right-4 bottom-4 text-7xl opacity-30 group-hover:scale-125 transition-transform duration-500">
                                {card.icon}
                            </span>
                        </Link>
                    ))}
                </div>

                {/* Categories Grid */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Популярні категорії</h2>
                        <Link
                            href="/categories"
                            className="text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 group"
                        >
                            Всі категорії
                            <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {categories.map((category) => (
                            <Link
                                key={`category-${category.name}`}
                                href={category.link}
                                className="bg-white rounded-2xl p-4 text-center hover:shadow-lg transition-all duration-300 border border-gray-100 group card-hover"
                            >
                                <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">
                                    {category.icon}
                                </span>
                                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-teal-600 transition-colors">
                                    {category.name}
                                </h3>
                                <p className="text-xs text-gray-500">{category.count} товарів</p>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Big Sale Banner */}
                <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                    <div className="relative z-10 max-w-2xl">
                        <span className="inline-block px-4 py-1 bg-white/20 rounded-full text-white text-sm font-semibold mb-4">
                            Обмежена пропозиція
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            Великий розпродаж
                        </h2>
                        <p className="text-white/90 text-lg mb-6">
                            Знижки до 70% на тисячі товарів. Не пропустіть найкращі пропозиції року!
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <Link
                                href="/sale"
                                className="inline-flex items-center px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg"
                            >
                                Дивитись акції
                            </Link>
                            <div className="flex items-center gap-4 text-white">
                                <div className="text-center">
                                    <span className="block text-3xl font-bold">24</span>
                                    <span className="text-sm text-white/70">год</span>
                                </div>
                                <span className="text-2xl">:</span>
                                <div className="text-center">
                                    <span className="block text-3xl font-bold">59</span>
                                    <span className="text-sm text-white/70">хв</span>
                                </div>
                                <span className="text-2xl">:</span>
                                <div className="text-center">
                                    <span className="block text-3xl font-bold">59</span>
                                    <span className="text-sm text-white/70">сек</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Decorative elements */}
                    <div className="absolute right-0 top-0 w-1/2 h-full opacity-20">
                        <div className="absolute right-10 top-10 text-8xl">🔥</div>
                        <div className="absolute right-40 bottom-10 text-7xl">💰</div>
                        <div className="absolute right-20 top-1/2 text-6xl">🎁</div>
                    </div>
                </div>
            </div>
        </section>
    );
}
