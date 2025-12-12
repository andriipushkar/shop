'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    GiftIcon,
    MagnifyingGlassIcon,
    CreditCardIcon,
    EnvelopeIcon,
    CheckCircleIcon,
    SparklesIcon,
    HeartIcon,
    CakeIcon,
    StarIcon,
    BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface GiftCardDesign {
    id: string;
    name: string;
    category: 'birthday' | 'holiday' | 'general' | 'corporate';
    gradient: string;
    icon: React.ElementType;
}

const designs: GiftCardDesign[] = [
    { id: '1', name: 'День народження', category: 'birthday', gradient: 'from-pink-500 to-purple-500', icon: CakeIcon },
    { id: '2', name: 'З любов\'ю', category: 'general', gradient: 'from-red-500 to-pink-500', icon: HeartIcon },
    { id: '3', name: 'Святковий', category: 'holiday', gradient: 'from-green-500 to-teal-500', icon: SparklesIcon },
    { id: '4', name: 'Подяка', category: 'general', gradient: 'from-yellow-500 to-orange-500', icon: StarIcon },
    { id: '5', name: 'Корпоративний', category: 'corporate', gradient: 'from-blue-500 to-indigo-500', icon: BuildingOfficeIcon },
    { id: '6', name: 'Універсальний', category: 'general', gradient: 'from-teal-500 to-cyan-500', icon: GiftIcon },
];

const amounts = [500, 1000, 2000, 3000, 5000];

export default function GiftCardsPage() {
    const [selectedDesign, setSelectedDesign] = useState<GiftCardDesign | null>(null);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [recipientEmail, setRecipientEmail] = useState('');
    const [message, setMessage] = useState('');
    const [checkCode, setCheckCode] = useState('');
    const [checkResult, setCheckResult] = useState<{ balance: number; expires: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'buy' | 'check'>('buy');
    const [step, setStep] = useState(1);

    const finalAmount = selectedAmount || (customAmount ? parseInt(customAmount) : 0);

    const handleCheckBalance = () => {
        // Mock balance check
        if (checkCode.length >= 10) {
            setCheckResult({
                balance: 750,
                expires: '01.01.2025',
            });
        }
    };

    const handlePurchase = () => {
        alert(`Сертифікат на ${finalAmount} ₴ успішно придбано! Код буде надіслано на ${recipientEmail || 'вашу пошту'}.`);
    };

    const isFormValid = selectedDesign && finalAmount >= 100 && (step === 1 || (recipientEmail || !recipientEmail));

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Breadcrumb */}
                <nav className="text-sm text-gray-500 mb-6">
                    <Link href="/" className="hover:text-teal-600">Головна</Link>
                    <span className="mx-2">/</span>
                    <span className="text-gray-900">Подарункові сертифікати</span>
                </nav>

                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <GiftIcon className="w-8 h-8 text-teal-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Подарункові сертифікати</h1>
                    <p className="text-gray-600">Ідеальний подарунок для ваших близьких</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 justify-center">
                    <button
                        onClick={() => setActiveTab('buy')}
                        className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                            activeTab === 'buy'
                                ? 'bg-teal-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <GiftIcon className="w-5 h-5 inline mr-2" />
                        Придбати
                    </button>
                    <button
                        onClick={() => setActiveTab('check')}
                        className={`px-6 py-3 rounded-xl font-medium transition-colors ${
                            activeTab === 'check'
                                ? 'bg-teal-600 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <MagnifyingGlassIcon className="w-5 h-5 inline mr-2" />
                        Перевірити баланс
                    </button>
                </div>

                {activeTab === 'check' ? (
                    /* Check Balance */
                    <div className="bg-white rounded-2xl shadow-sm p-6 max-w-md mx-auto">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Перевірити баланс сертифікату</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Код сертифікату
                                </label>
                                <input
                                    type="text"
                                    value={checkCode}
                                    onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                                    placeholder="GIFT-XXXX-XXXX-XXXX"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                                />
                            </div>
                            <button
                                onClick={handleCheckBalance}
                                disabled={checkCode.length < 10}
                                className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Перевірити
                            </button>

                            {checkResult && (
                                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                                        <span className="font-medium text-green-800">Сертифікат знайдено</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Баланс</p>
                                            <p className="text-2xl font-bold text-gray-900">{checkResult.balance} ₴</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Дійсний до</p>
                                            <p className="text-lg font-medium text-gray-900">{checkResult.expires}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Buy Gift Card */
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {/* Steps */}
                        <div className="flex border-b">
                            {[
                                { num: 1, name: 'Дизайн та сума' },
                                { num: 2, name: 'Отримувач' },
                                { num: 3, name: 'Підтвердження' },
                            ].map((s) => (
                                <button
                                    key={s.num}
                                    onClick={() => s.num <= step && setStep(s.num)}
                                    className={`flex-1 py-4 text-center text-sm font-medium transition-colors ${
                                        step === s.num
                                            ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                                            : step > s.num
                                            ? 'text-teal-600'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs ${
                                        step >= s.num ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                                    }`}>
                                        {step > s.num ? '✓' : s.num}
                                    </span>
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {step === 1 && (
                                <div className="space-y-6">
                                    {/* Design Selection */}
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-4">Виберіть дизайн</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {designs.map((design) => (
                                                <button
                                                    key={design.id}
                                                    onClick={() => setSelectedDesign(design)}
                                                    className={`relative rounded-xl overflow-hidden transition-all ${
                                                        selectedDesign?.id === design.id
                                                            ? 'ring-4 ring-teal-500 scale-105'
                                                            : 'hover:scale-102'
                                                    }`}
                                                >
                                                    <div className={`bg-gradient-to-br ${design.gradient} aspect-[3/2] p-4 flex flex-col items-center justify-center text-white`}>
                                                        <design.icon className="w-8 h-8 mb-2" />
                                                        <span className="font-medium text-sm">{design.name}</span>
                                                    </div>
                                                    {selectedDesign?.id === design.id && (
                                                        <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                                            <CheckCircleIcon className="w-5 h-5 text-teal-600" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Amount Selection */}
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-4">Виберіть номінал</h3>
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
                                            {amounts.map((amount) => (
                                                <button
                                                    key={amount}
                                                    onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                                                    className={`py-3 rounded-xl font-medium transition-all ${
                                                        selectedAmount === amount
                                                            ? 'bg-teal-600 text-white'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {amount} ₴
                                                </button>
                                            ))}
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-600 mb-2">
                                                Або введіть свою суму (100 - 10 000 ₴)
                                            </label>
                                            <input
                                                type="number"
                                                value={customAmount}
                                                onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                                                placeholder="Введіть суму"
                                                min="100"
                                                max="10000"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!selectedDesign || finalAmount < 100}
                                        className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Далі
                                    </button>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-4">Інформація про отримувача</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Ім&apos;я отримувача
                                                </label>
                                                <input
                                                    type="text"
                                                    value={recipientName}
                                                    onChange={(e) => setRecipientName(e.target.value)}
                                                    placeholder="Введіть ім'я"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Email отримувача
                                                </label>
                                                <input
                                                    type="email"
                                                    value={recipientEmail}
                                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                                    placeholder="email@example.com"
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                />
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Залиште порожнім, щоб отримати сертифікат на свою пошту
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Особисте повідомлення (необов&apos;язково)
                                                </label>
                                                <textarea
                                                    value={message}
                                                    onChange={(e) => setMessage(e.target.value)}
                                                    placeholder="Напишіть щось приємне..."
                                                    rows={3}
                                                    maxLength={200}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                />
                                                <p className="text-sm text-gray-500 text-right">{message.length}/200</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(1)}
                                            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                        >
                                            Назад
                                        </button>
                                        <button
                                            onClick={() => setStep(3)}
                                            className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                                        >
                                            Далі
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-6">
                                    <h3 className="font-semibold text-gray-900 mb-4">Підтвердження замовлення</h3>

                                    {/* Preview */}
                                    {selectedDesign && (
                                        <div className={`bg-gradient-to-br ${selectedDesign.gradient} rounded-2xl p-6 text-white`}>
                                            <div className="flex items-center justify-between mb-8">
                                                <GiftIcon className="w-8 h-8" />
                                                <span className="text-xl font-bold">Подарунковий сертифікат</span>
                                            </div>
                                            <div className="text-center mb-6">
                                                <selectedDesign.icon className="w-12 h-12 mx-auto mb-2" />
                                                <p className="text-3xl font-bold">{finalAmount} ₴</p>
                                            </div>
                                            {recipientName && (
                                                <p className="text-center opacity-90">Для: {recipientName}</p>
                                            )}
                                            {message && (
                                                <p className="text-center mt-4 italic opacity-80">&ldquo;{message}&rdquo;</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Summary */}
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Номінал сертифікату</span>
                                            <span className="font-medium">{finalAmount} ₴</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Отримувач</span>
                                            <span className="font-medium">{recipientEmail || 'Ви'}</span>
                                        </div>
                                        <div className="border-t pt-3 flex justify-between">
                                            <span className="font-semibold">До оплати</span>
                                            <span className="font-bold text-xl">{finalAmount} ₴</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setStep(2)}
                                            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                        >
                                            Назад
                                        </button>
                                        <button
                                            onClick={handlePurchase}
                                            className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors"
                                        >
                                            <CreditCardIcon className="w-5 h-5 inline mr-2" />
                                            Оплатити
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Info Cards */}
                <div className="grid sm:grid-cols-3 gap-4 mt-8">
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <EnvelopeIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h4 className="font-medium text-gray-900">Миттєва доставка</h4>
                        <p className="text-sm text-gray-500">Сертифікат надходить на email одразу після оплати</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CreditCardIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h4 className="font-medium text-gray-900">Гнучкий номінал</h4>
                        <p className="text-sm text-gray-500">Від 100 до 10 000 грн на ваш вибір</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 text-center">
                        <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircleIcon className="w-6 h-6 text-teal-600" />
                        </div>
                        <h4 className="font-medium text-gray-900">Дійсний 1 рік</h4>
                        <p className="text-sm text-gray-500">Достатньо часу для використання</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
