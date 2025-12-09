'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowPathIcon,
    ClockIcon,
    DocumentTextIcon,
    TruckIcon,
    CurrencyDollarIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    XCircleIcon,
    QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

const returnSteps = [
    {
        step: 1,
        title: 'Зверніться до нас',
        description: 'Зв\'яжіться з підтримкою або заповніть форму повернення в особистому кабінеті',
        icon: DocumentTextIcon,
    },
    {
        step: 2,
        title: 'Отримайте підтвердження',
        description: 'Ми перевіримо вашу заявку і надішлемо інструкції для повернення',
        icon: CheckCircleIcon,
    },
    {
        step: 3,
        title: 'Відправте товар',
        description: 'Упакуйте товар і відправте його за вказаною адресою',
        icon: TruckIcon,
    },
    {
        step: 4,
        title: 'Отримайте кошти',
        description: 'Після перевірки товару ми повернемо гроші протягом 3-5 днів',
        icon: CurrencyDollarIcon,
    },
];

const canReturn = [
    'Товар в оригінальній упаковці',
    'Без слідів використання',
    'З усіма бірками та етикетками',
    'З чеком або накладною',
    'Протягом 14 днів з моменту отримання',
    'Товар належної якості',
];

const cannotReturn = [
    'Білизна та купальники',
    'Косметика та парфумерія (розпечатані)',
    'Товари особистої гігієни',
    'Ліки та медичні вироби',
    'Продукти харчування',
    'Товари на замовлення (індивідуальні)',
    'Програмне забезпечення (активоване)',
];

const faqItems = [
    {
        question: 'Скільки часу займає повернення коштів?',
        answer: 'Після отримання та перевірки товару, кошти повертаються протягом 3-5 робочих днів на карту, з якої була здійснена оплата. При оплаті накладеним платежем - поштовим переказом.',
    },
    {
        question: 'Хто оплачує доставку при поверненні?',
        answer: 'Якщо товар з дефектом або не відповідає опису - доставку оплачуємо ми. При поверненні товару належної якості (передумали) - доставку оплачує покупець.',
    },
    {
        question: 'Чи можна обміняти товар?',
        answer: 'Так, ви можете обміняти товар на аналогічний іншого розміру, кольору або моделі. Якщо різниця в ціні - ви доплачуєте або ми повертаємо різницю.',
    },
    {
        question: 'Що робити, якщо товар прийшов пошкодженим?',
        answer: 'Перевірте товар при отриманні. Якщо виявили пошкодження - зафіксуйте це в акті з перевізником та зверніться до нас протягом 24 годин з фото пошкоджень.',
    },
];

export default function ReturnsPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <h1 className="text-4xl font-bold mb-4">Повернення та обмін</h1>
                    <p className="text-xl text-teal-100 max-w-2xl">
                        Ми хочемо, щоб ви були задоволені покупкою. Якщо щось пішло не так -
                        ми допоможемо з поверненням або обміном товару.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Key Info Cards */}
                <div className="grid md:grid-cols-3 gap-6 -mt-20 mb-12">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                            <ClockIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">14 днів</h3>
                        <p className="text-gray-600">на повернення товару належної якості</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                            <ArrowPathIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Безкоштовно</h3>
                        <p className="text-gray-600">повернення бракованого товару</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                            <CurrencyDollarIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">3-5 днів</h3>
                        <p className="text-gray-600">на повернення коштів</p>
                    </div>
                </div>

                {/* Return Process */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8">Як повернути товар?</h2>
                    <div className="grid md:grid-cols-4 gap-6">
                        {returnSteps.map((step, index) => (
                            <div key={index} className="relative">
                                <div className="bg-white rounded-2xl shadow-sm p-6 h-full">
                                    <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold mb-4">
                                        {step.step}
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                                    <p className="text-gray-600 text-sm">{step.description}</p>
                                </div>
                                {index < returnSteps.length - 1 && (
                                    <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-gray-300 text-2xl">
                                        →
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* What can / cannot be returned */}
                <section className="mb-16">
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                                    <CheckCircleIcon className="w-6 h-6 text-teal-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Можна повернути</h3>
                            </div>
                            <ul className="space-y-3">
                                {canReturn.map((item, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        <CheckCircleIcon className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                                    <XCircleIcon className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900">Не підлягає поверненню</h3>
                            </div>
                            <ul className="space-y-3">
                                {cannotReturn.map((item, index) => (
                                    <li key={index} className="flex items-start gap-3">
                                        <XCircleIcon className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-gray-700">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Warranty Info */}
                <section className="mb-16">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Гарантійні випадки
                                </h3>
                                <p className="text-gray-700 mb-4">
                                    Якщо товар вийшов з ладу протягом гарантійного терміну, ви маєте право на:
                                </p>
                                <ul className="space-y-2 text-gray-700">
                                    <li>• Безкоштовний ремонт</li>
                                    <li>• Заміну на аналогічний товар</li>
                                    <li>• Повернення коштів (якщо ремонт неможливий)</li>
                                </ul>
                                <p className="text-sm text-gray-500 mt-4">
                                    Гарантійний термін вказаний на сторінці кожного товару та в гарантійному талоні.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                        <QuestionMarkCircleIcon className="w-8 h-8 text-teal-600" />
                        Часті питання
                    </h2>
                    <div className="space-y-4">
                        {faqItems.map((item, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-xl shadow-sm overflow-hidden"
                            >
                                <button
                                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                                >
                                    <span className="font-medium text-gray-900">{item.question}</span>
                                    <span className={`transform transition-transform ${openFaq === index ? 'rotate-180' : ''}`}>
                                        ▼
                                    </span>
                                </button>
                                {openFaq === index && (
                                    <div className="px-6 pb-4 text-gray-600">
                                        {item.answer}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA */}
                <section className="bg-teal-600 rounded-2xl p-8 text-center text-white">
                    <h2 className="text-2xl font-bold mb-4">Потрібна допомога з поверненням?</h2>
                    <p className="text-teal-100 mb-6 max-w-xl mx-auto">
                        Наша служба підтримки готова допомогти вам з будь-яким питанням щодо повернення або обміну товару.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link
                            href="/contact"
                            className="px-8 py-4 bg-white text-teal-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        >
                            Зв&apos;язатися з нами
                        </Link>
                        <Link
                            href="/account"
                            className="px-8 py-4 bg-teal-700 text-white rounded-xl font-semibold hover:bg-teal-800 transition-colors"
                        >
                            Створити заявку
                        </Link>
                    </div>
                </section>
            </div>
        </main>
    );
}
