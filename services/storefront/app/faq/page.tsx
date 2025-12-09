'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    MagnifyingGlassIcon,
    ShoppingCartIcon,
    TruckIcon,
    CreditCardIcon,
    ArrowPathIcon,
    UserIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';

const categories = [
    { id: 'orders', name: 'Замовлення', icon: ShoppingCartIcon },
    { id: 'delivery', name: 'Доставка', icon: TruckIcon },
    { id: 'payment', name: 'Оплата', icon: CreditCardIcon },
    { id: 'returns', name: 'Повернення', icon: ArrowPathIcon },
    { id: 'account', name: 'Акаунт', icon: UserIcon },
];

const faqData: Record<string, { question: string; answer: string }[]> = {
    orders: [
        {
            question: 'Як зробити замовлення?',
            answer: 'Додайте товари в кошик, перейдіть до оформлення замовлення, вкажіть контактні дані, оберіть спосіб доставки та оплати. Після підтвердження ви отримаєте SMS та email з номером замовлення.',
        },
        {
            question: 'Як відстежити моє замовлення?',
            answer: 'Перейдіть в особистий кабінет > Мої замовлення. Там ви знайдете всю інформацію про статус та номер для відстеження у службі доставки.',
        },
        {
            question: 'Чи можу я змінити замовлення після оформлення?',
            answer: 'Так, якщо замовлення ще не передано в доставку. Зв\'яжіться з нашою підтримкою якнайшвидше для внесення змін.',
        },
        {
            question: 'Як скасувати замовлення?',
            answer: 'Зв\'яжіться з підтримкою або скасуйте в особистому кабінеті, якщо замовлення ще в обробці. При скасуванні оплаченого замовлення кошти повертаються протягом 3-5 днів.',
        },
        {
            question: 'Мінімальна сума замовлення?',
            answer: 'Мінімальної суми замовлення немає. Ви можете замовити навіть один товар.',
        },
    ],
    delivery: [
        {
            question: 'Які способи доставки доступні?',
            answer: 'Нова Пошта (відділення та кур\'єр), Укрпошта, Meest, самовивіз з нашого магазину. Терміни доставки: 1-3 дні для більшості міст України.',
        },
        {
            question: 'Скільки коштує доставка?',
            answer: 'Доставка безкоштовна при замовленні від 1000 грн. Для менших замовлень: Нова Пошта від 50 грн, кур\'єр від 80 грн, Укрпошта від 35 грн.',
        },
        {
            question: 'Чи доставляєте в моє місто?',
            answer: 'Так, ми доставляємо по всій Україні, включаючи села та селища (через Укрпошту).',
        },
        {
            question: 'Що робити, якщо мене не було вдома при доставці?',
            answer: 'Кур\'єр зв\'яжеться з вами для узгодження нового часу. Для доставки у відділення - посилка чекатиме на вас 5-7 днів.',
        },
        {
            question: 'Чи можна змінити адресу доставки?',
            answer: 'Так, якщо замовлення ще не відправлено. Зв\'яжіться з підтримкою для зміни адреси.',
        },
    ],
    payment: [
        {
            question: 'Які способи оплати ви приймаєте?',
            answer: 'Картки Visa/Mastercard онлайн, LiqPay, Приват24, Apple Pay, Google Pay, накладений платіж (при отриманні).',
        },
        {
            question: 'Чи безпечно оплачувати карткою?',
            answer: 'Так, всі платежі захищені за стандартом PCI DSS та технологією 3D Secure. Ми не зберігаємо дані вашої картки.',
        },
        {
            question: 'Чи можу я оплатити частинами?',
            answer: 'Так, через сервіс "Оплата частинами" від ПриватБанку або Monobank. Доступно для замовлень від 500 грн.',
        },
        {
            question: 'Коли списуються кошти при онлайн-оплаті?',
            answer: 'Кошти списуються одразу після підтвердження замовлення. Якщо товар недоступний, ми повернемо кошти.',
        },
        {
            question: 'Що таке накладений платіж?',
            answer: 'Це оплата при отриманні посилки у відділенні пошти. Комісія перевізника +20 грн.',
        },
    ],
    returns: [
        {
            question: 'Протягом якого часу можна повернути товар?',
            answer: '14 днів з моменту отримання для товару належної якості. Для бракованого товару - протягом гарантійного терміну.',
        },
        {
            question: 'Як повернути товар?',
            answer: 'Зв\'яжіться з підтримкою або заповніть форму повернення в особистому кабінеті. Ми надішлемо інструкції для відправки.',
        },
        {
            question: 'Хто оплачує доставку при поверненні?',
            answer: 'При поверненні бракованого товару - ми. При поверненні товару належної якості (передумали) - покупець.',
        },
        {
            question: 'Як швидко повернуть кошти?',
            answer: 'Протягом 3-5 робочих днів після отримання та перевірки товару на наш склад.',
        },
        {
            question: 'Чи можна обміняти товар?',
            answer: 'Так, ви можете обміняти на інший розмір, колір або модель. Різниця в ціні компенсується.',
        },
    ],
    account: [
        {
            question: 'Як зареєструватися?',
            answer: 'Натисніть "Увійти" у верхньому меню, оберіть "Реєстрація" та заповніть форму. Або просто оформіть замовлення - акаунт створюється автоматично.',
        },
        {
            question: 'Забув пароль, що робити?',
            answer: 'На сторінці входу натисніть "Забули пароль?" та вкажіть email. Ми надішлемо посилання для відновлення.',
        },
        {
            question: 'Як змінити особисті дані?',
            answer: 'Перейдіть в особистий кабінет > Профіль. Там можна змінити ім\'я, телефон, email та адресу.',
        },
        {
            question: 'Де подивитися історію замовлень?',
            answer: 'В особистому кабінеті > Мої замовлення. Там зберігається вся історія ваших покупок.',
        },
        {
            question: 'Як видалити акаунт?',
            answer: 'Зв\'яжіться з підтримкою з проханням видалити акаунт. Ми видалимо ваші дані згідно з політикою конфіденційності.',
        },
    ],
};

export default function FaqPage() {
    const [activeCategory, setActiveCategory] = useState('orders');
    const [openQuestion, setOpenQuestion] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const allQuestions = Object.entries(faqData).flatMap(([category, questions]) =>
        questions.map(q => ({ ...q, category }))
    );

    const filteredQuestions = searchQuery
        ? allQuestions.filter(
            q =>
                q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                q.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : faqData[activeCategory];

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <h1 className="text-4xl font-bold mb-4">Часті питання</h1>
                    <p className="text-xl text-teal-100 mb-8 max-w-2xl">
                        Знайдіть відповіді на найпопулярніші питання про замовлення, доставку, оплату та повернення.
                    </p>

                    {/* Search */}
                    <div className="relative max-w-xl">
                        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Пошук питання..."
                            className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-teal-300"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {!searchQuery ? (
                    <div className="grid lg:grid-cols-4 gap-8">
                        {/* Categories */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-24">
                                <h3 className="font-semibold text-gray-900 px-4 py-2">Категорії</h3>
                                <nav className="space-y-1">
                                    {categories.map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => {
                                                setActiveCategory(category.id);
                                                setOpenQuestion(null);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                                                activeCategory === category.id
                                                    ? 'bg-teal-50 text-teal-700'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <category.icon className="w-5 h-5" />
                                            {category.name}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        </div>

                        {/* Questions */}
                        <div className="lg:col-span-3">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">
                                {categories.find(c => c.id === activeCategory)?.name}
                            </h2>
                            <div className="space-y-4">
                                {faqData[activeCategory].map((item, index) => (
                                    <div
                                        key={index}
                                        className="bg-white rounded-xl shadow-sm overflow-hidden"
                                    >
                                        <button
                                            onClick={() => setOpenQuestion(openQuestion === index ? null : index)}
                                            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="font-medium text-gray-900 pr-4">{item.question}</span>
                                            <span className={`transform transition-transform text-gray-400 ${openQuestion === index ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        {openQuestion === index && (
                                            <div className="px-6 pb-4 text-gray-600 border-t border-gray-100 pt-4">
                                                {item.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Search Results */
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                            Результати пошуку ({filteredQuestions.length})
                        </h2>
                        {filteredQuestions.length > 0 ? (
                            <div className="space-y-4">
                                {filteredQuestions.map((item, index) => (
                                    <div
                                        key={index}
                                        className="bg-white rounded-xl shadow-sm overflow-hidden"
                                    >
                                        <button
                                            onClick={() => setOpenQuestion(openQuestion === index ? null : index)}
                                            className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                                        >
                                            <div>
                                                <span className="font-medium text-gray-900 block">{item.question}</span>
                                                {'category' in item && (
                                                    <span className="text-sm text-teal-600 mt-1">
                                                        {categories.find(c => c.id === item.category)?.name}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`transform transition-transform text-gray-400 ${openQuestion === index ? 'rotate-180' : ''}`}>
                                                ▼
                                            </span>
                                        </button>
                                        {openQuestion === index && (
                                            <div className="px-6 pb-4 text-gray-600 border-t border-gray-100 pt-4">
                                                {item.answer}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                                <p className="text-gray-500 mb-4">Нічого не знайдено</p>
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-teal-600 font-medium hover:text-teal-700"
                                >
                                    Очистити пошук
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* CTA */}
                <section className="mt-16 bg-teal-50 rounded-2xl p-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center">
                                <ChatBubbleLeftRightIcon className="w-7 h-7 text-teal-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold text-gray-900">Не знайшли відповідь?</h3>
                                <p className="text-gray-600">Наша команда підтримки готова допомогти</p>
                            </div>
                        </div>
                        <Link
                            href="/contact"
                            className="px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                        >
                            Зв&apos;язатися з нами
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
