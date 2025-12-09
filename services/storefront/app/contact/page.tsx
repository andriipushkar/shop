'use client';

import { useState } from 'react';
import {
    PhoneIcon,
    EnvelopeIcon,
    MapPinIcon,
    ClockIcon,
    ChatBubbleLeftRightIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

const contactInfo = [
    {
        icon: PhoneIcon,
        title: 'Телефон',
        value: '0 800 123 456',
        subtext: 'Безкоштовно по Україні',
        link: 'tel:0800123456',
    },
    {
        icon: EnvelopeIcon,
        title: 'Email',
        value: 'support@shop.ua',
        subtext: 'Відповідаємо протягом 24 годин',
        link: 'mailto:support@shop.ua',
    },
    {
        icon: MapPinIcon,
        title: 'Адреса',
        value: 'м. Київ, вул. Хрещатик, 1',
        subtext: 'Головний офіс',
        link: '#',
    },
    {
        icon: ClockIcon,
        title: 'Графік роботи',
        value: 'Пн-Пт: 9:00 - 20:00',
        subtext: 'Сб-Нд: 10:00 - 18:00',
        link: '#',
    },
];

const faqQuick = [
    { question: 'Як відстежити замовлення?', answer: 'Перейдіть в особистий кабінет > Мої замовлення' },
    { question: 'Як повернути товар?', answer: 'Протягом 14 днів без пояснення причин' },
    { question: 'Скільки коштує доставка?', answer: 'Безкоштовно при замовленні від 1000 грн' },
];

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: 'general',
        message: '',
    });
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsLoading(false);
        setIsSubmitted(true);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <h1 className="text-4xl font-bold mb-4">Зв&apos;яжіться з нами</h1>
                    <p className="text-xl text-teal-100 max-w-2xl">
                        Маєте питання? Ми завжди раді допомогти! Оберіть зручний спосіб зв&apos;язку або заповніть форму нижче.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Contact Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 -mt-20 mb-12">
                    {contactInfo.map((item, index) => (
                        <a
                            key={index}
                            href={item.link}
                            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
                        >
                            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                                <item.icon className="w-6 h-6 text-teal-600" />
                            </div>
                            <h3 className="text-sm text-gray-500 mb-1">{item.title}</h3>
                            <p className="text-lg font-semibold text-gray-900">{item.value}</p>
                            <p className="text-sm text-gray-500 mt-1">{item.subtext}</p>
                        </a>
                    ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-12">
                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm p-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Напишіть нам</h2>

                            {isSubmitted ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircleIcon className="w-8 h-8 text-teal-600" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                        Дякуємо за звернення!
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        Ми отримали ваше повідомлення і відповімо найближчим часом.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setIsSubmitted(false);
                                            setFormData({
                                                name: '',
                                                email: '',
                                                phone: '',
                                                subject: 'general',
                                                message: '',
                                            });
                                        }}
                                        className="text-teal-600 font-medium hover:text-teal-700"
                                    >
                                        Надіслати ще одне повідомлення
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Ім&apos;я *
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                placeholder="Ваше ім'я"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Email *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                placeholder="your@email.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Телефон
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                placeholder="+380 XX XXX XX XX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Тема звернення
                                            </label>
                                            <select
                                                name="subject"
                                                value={formData.subject}
                                                onChange={handleChange}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            >
                                                <option value="general">Загальне питання</option>
                                                <option value="order">Питання по замовленню</option>
                                                <option value="return">Повернення товару</option>
                                                <option value="complaint">Скарга</option>
                                                <option value="partnership">Співпраця</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Повідомлення *
                                        </label>
                                        <textarea
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            rows={5}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                                            placeholder="Опишіть ваше питання детально..."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full md:w-auto px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isLoading ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Надсилання...
                                            </>
                                        ) : (
                                            <>
                                                <ChatBubbleLeftRightIcon className="w-5 h-5" />
                                                Надіслати повідомлення
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick FAQ */}
                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Часті питання</h3>
                            <div className="space-y-4">
                                {faqQuick.map((item, index) => (
                                    <div key={index} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                        <p className="font-medium text-gray-900">{item.question}</p>
                                        <p className="text-sm text-gray-600 mt-1">{item.answer}</p>
                                    </div>
                                ))}
                            </div>
                            <a
                                href="/faq"
                                className="block text-center text-teal-600 font-medium mt-4 hover:text-teal-700"
                            >
                                Всі питання →
                            </a>
                        </div>

                        {/* Live Chat */}
                        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl p-6 text-white">
                            <ChatBubbleLeftRightIcon className="w-10 h-10 mb-4 opacity-80" />
                            <h3 className="text-lg font-semibold mb-2">Онлайн-чат</h3>
                            <p className="text-teal-100 text-sm mb-4">
                                Отримайте миттєву відповідь від нашої служби підтримки
                            </p>
                            <button className="w-full py-3 bg-white text-teal-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                                Почати чат
                            </button>
                        </div>

                        {/* Social */}
                        <div className="bg-white rounded-2xl shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ми в соцмережах</h3>
                            <div className="flex gap-3">
                                {['Facebook', 'Instagram', 'Telegram', 'YouTube'].map((social) => (
                                    <a
                                        key={social}
                                        href="#"
                                        className="flex-1 py-3 bg-gray-100 rounded-xl text-center text-sm font-medium text-gray-700 hover:bg-teal-100 hover:text-teal-600 transition-colors"
                                    >
                                        {social.charAt(0)}
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
