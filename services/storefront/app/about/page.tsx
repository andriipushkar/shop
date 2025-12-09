'use client';

import Link from 'next/link';
import {
    BuildingStorefrontIcon,
    TruckIcon,
    ShieldCheckIcon,
    UserGroupIcon,
    HeartIcon,
    SparklesIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

const stats = [
    { label: 'Років на ринку', value: '10+' },
    { label: 'Задоволених клієнтів', value: '50 000+' },
    { label: 'Товарів в каталозі', value: '100 000+' },
    { label: 'Міст доставки', value: '500+' },
];

const values = [
    {
        icon: HeartIcon,
        title: 'Турбота про клієнта',
        description: 'Ми ставимо потреби наших клієнтів на перше місце і завжди готові допомогти з будь-яким питанням.',
    },
    {
        icon: ShieldCheckIcon,
        title: 'Якість та надійність',
        description: 'Працюємо тільки з перевіреними постачальниками та гарантуємо якість кожного товару.',
    },
    {
        icon: SparklesIcon,
        title: 'Інновації',
        description: 'Постійно вдосконалюємо наш сервіс та впроваджуємо нові технології для вашої зручності.',
    },
    {
        icon: UserGroupIcon,
        title: 'Команда професіоналів',
        description: 'Наша команда - це досвідчені фахівці, які люблять свою справу та готові допомогти.',
    },
];

const timeline = [
    { year: '2014', event: 'Заснування компанії', description: 'Почали з маленького магазину електроніки' },
    { year: '2016', event: 'Запуск онлайн-магазину', description: 'Вихід в інтернет та перші онлайн-замовлення' },
    { year: '2018', event: 'Розширення асортименту', description: 'Додали категорії одягу, дому та спорту' },
    { year: '2020', event: 'Власна служба доставки', description: 'Запустили швидку доставку по всій Україні' },
    { year: '2022', event: '50 000 клієнтів', description: 'Досягли важливої віхи у розвитку' },
    { year: '2024', event: 'Новий сайт', description: 'Повне оновлення платформи для кращого досвіду покупок' },
];

export default function AboutPage() {
    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                    <div className="max-w-3xl">
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">Про нас</h1>
                        <p className="text-xl text-teal-100 leading-relaxed">
                            Ми - команда ентузіастів, яка вірить, що онлайн-шопінг може бути простим,
                            зручним та приємним. Наша мета - надати вам найкращий досвід покупок
                            з широким вибором товарів та відмінним сервісом.
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {stats.map((stat, index) => (
                            <div key={index} className="text-center">
                                <div className="text-3xl md:text-4xl font-bold text-teal-600 mb-2">
                                    {stat.value}
                                </div>
                                <div className="text-gray-600">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mission */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-6">Наша місія</h2>
                        <p className="text-gray-600 text-lg leading-relaxed mb-6">
                            Ми прагнемо зробити якісні товари доступними для кожного українця.
                            Наша платформа об&apos;єднує найкращих виробників та продавців,
                            щоб ви могли знайти все необхідне в одному місці.
                        </p>
                        <ul className="space-y-3">
                            {[
                                'Широкий асортимент товарів',
                                'Конкурентні ціни',
                                'Швидка доставка по всій Україні',
                                'Гарантія якості на всі товари',
                                'Професійна підтримка клієнтів',
                            ].map((item, index) => (
                                <li key={index} className="flex items-center gap-3 text-gray-700">
                                    <CheckCircleIcon className="w-5 h-5 text-teal-500 flex-shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="bg-gradient-to-br from-teal-100 to-teal-100 rounded-2xl p-8 flex items-center justify-center">
                        <BuildingStorefrontIcon className="w-48 h-48 text-teal-600 opacity-50" />
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="bg-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Наші цінності</h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {values.map((value, index) => (
                            <div key={index} className="text-center">
                                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <value.icon className="w-8 h-8 text-teal-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">{value.title}</h3>
                                <p className="text-gray-600">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Timeline */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Наша історія</h2>
                <div className="relative">
                    <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-teal-200 hidden md:block"></div>
                    <div className="space-y-8">
                        {timeline.map((item, index) => (
                            <div
                                key={index}
                                className={`flex flex-col md:flex-row items-center gap-4 ${
                                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                                }`}
                            >
                                <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                                    <div className="bg-white rounded-xl shadow-sm p-6">
                                        <span className="text-teal-600 font-bold text-lg">{item.year}</span>
                                        <h3 className="text-xl font-semibold text-gray-900 mt-1">{item.event}</h3>
                                        <p className="text-gray-600 mt-2">{item.description}</p>
                                    </div>
                                </div>
                                <div className="w-4 h-4 bg-teal-500 rounded-full border-4 border-teal-100 z-10 hidden md:block"></div>
                                <div className="flex-1 hidden md:block"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="bg-teal-600 text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-bold mb-4">Готові до покупок?</h2>
                    <p className="text-teal-100 text-lg mb-8 max-w-2xl mx-auto">
                        Перегляньте наш каталог та знайдіть все, що вам потрібно
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link
                            href="/"
                            className="px-8 py-4 bg-white text-teal-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        >
                            Перейти до каталогу
                        </Link>
                        <Link
                            href="/contact"
                            className="px-8 py-4 bg-teal-700 text-white rounded-xl font-semibold hover:bg-teal-800 transition-colors"
                        >
                            Зв&apos;язатися з нами
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}
