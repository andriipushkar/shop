'use client';

import {
    TruckIcon,
    BuildingStorefrontIcon,
    ClockIcon,
    CurrencyDollarIcon,
    MapPinIcon,
    CreditCardIcon,
    BanknotesIcon,
    DevicePhoneMobileIcon,
    ShieldCheckIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

const deliveryMethods = [
    {
        icon: TruckIcon,
        name: 'Нова Пошта',
        description: 'Доставка у відділення або поштомат',
        time: '1-3 дні',
        price: 'від 50 грн',
        freeFrom: '1000 грн',
        features: ['Відстеження посилки', 'SMS-сповіщення', 'Оплата при отриманні'],
    },
    {
        icon: TruckIcon,
        name: 'Нова Пошта Кур\'єр',
        description: 'Доставка за вашою адресою',
        time: '1-3 дні',
        price: 'від 80 грн',
        freeFrom: '2000 грн',
        features: ['Доставка до дверей', 'Зручний час', 'Примірка одягу'],
    },
    {
        icon: TruckIcon,
        name: 'Укрпошта',
        description: 'Економна доставка',
        time: '3-7 днів',
        price: 'від 35 грн',
        freeFrom: '1500 грн',
        features: ['Найдешевша доставка', 'Широка мережа', 'Доставка в села'],
    },
    {
        icon: BuildingStorefrontIcon,
        name: 'Самовивіз',
        description: 'Забрати з нашого магазину',
        time: 'Сьогодні',
        price: 'Безкоштовно',
        freeFrom: null,
        features: ['Без черги', 'Перевірка товару', 'Консультація'],
    },
];

const paymentMethods = [
    {
        icon: CreditCardIcon,
        name: 'Картка онлайн',
        description: 'Visa, Mastercard',
        features: ['Миттєва оплата', 'Безпечно', '3D Secure'],
    },
    {
        icon: DevicePhoneMobileIcon,
        name: 'LiqPay',
        description: 'Швидка оплата',
        features: ['Оплата в 1 клік', 'Apple/Google Pay', 'Кешбек'],
    },
    {
        icon: DevicePhoneMobileIcon,
        name: 'Приват24',
        description: 'Для клієнтів ПриватБанку',
        features: ['Оплата частинами', 'Бонуси', 'Кредит'],
    },
    {
        icon: BanknotesIcon,
        name: 'Накладений платіж',
        description: 'Оплата при отриманні',
        features: ['Перевірка товару', 'Готівка/картка', '+20 грн комісія'],
    },
];

const regions = [
    { name: 'Київ та область', time: '1 день' },
    { name: 'Харків, Дніпро, Одеса, Львів', time: '1-2 дні' },
    { name: 'Обласні центри', time: '2-3 дні' },
    { name: 'Інші міста', time: '2-4 дні' },
    { name: 'Село', time: '3-7 днів (Укрпошта)' },
];

export default function DeliveryPage() {
    return (
        <main className="min-h-screen bg-gray-50">
            {/* Hero */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-600 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    <h1 className="text-4xl font-bold mb-4">Доставка і оплата</h1>
                    <p className="text-xl text-teal-100 max-w-2xl">
                        Обирайте зручний спосіб доставки та оплати. Безкоштовна доставка при замовленні від 1000 грн!
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Free Delivery Banner */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-6 md:p-8 mb-12 text-white">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                                <TruckIcon className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Безкоштовна доставка</h2>
                                <p className="text-amber-100">При замовленні від 1000 грн</p>
                            </div>
                        </div>
                        <a
                            href="/"
                            className="px-6 py-3 bg-white text-orange-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                        >
                            Почати покупки
                        </a>
                    </div>
                </div>

                {/* Delivery Methods */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                        <TruckIcon className="w-8 h-8 text-teal-600" />
                        Способи доставки
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        {deliveryMethods.map((method, index) => (
                            <div key={index} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <method.icon className="w-6 h-6 text-teal-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900">{method.name}</h3>
                                        <p className="text-gray-600 text-sm mb-4">{method.description}</p>

                                        <div className="flex flex-wrap gap-4 mb-4">
                                            <div className="flex items-center gap-2 text-sm">
                                                <ClockIcon className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-700">{method.time}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <CurrencyDollarIcon className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-700">{method.price}</span>
                                            </div>
                                            {method.freeFrom && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <CheckCircleIcon className="w-4 h-4 text-teal-500" />
                                                    <span className="text-teal-600">Безкоштовно від {method.freeFrom}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {method.features.map((feature, i) => (
                                                <span
                                                    key={i}
                                                    className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600"
                                                >
                                                    {feature}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Delivery Regions */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                        <MapPinIcon className="w-8 h-8 text-teal-600" />
                        Терміни доставки по регіонах
                    </h2>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Регіон</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Орієнтовний термін</th>
                                </tr>
                            </thead>
                            <tbody>
                                {regions.map((region, index) => (
                                    <tr key={index} className="border-t border-gray-100">
                                        <td className="px-6 py-4 text-gray-700">{region.name}</td>
                                        <td className="px-6 py-4 text-gray-900 font-medium">{region.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Payment Methods */}
                <section className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
                        <CreditCardIcon className="w-8 h-8 text-teal-600" />
                        Способи оплати
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {paymentMethods.map((method, index) => (
                            <div key={index} className="bg-white rounded-2xl shadow-sm p-6 text-center hover:shadow-md transition-shadow">
                                <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <method.icon className="w-7 h-7 text-teal-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">{method.name}</h3>
                                <p className="text-gray-500 text-sm mb-4">{method.description}</p>
                                <div className="space-y-2">
                                    {method.features.map((feature, i) => (
                                        <div key={i} className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                            <CheckCircleIcon className="w-4 h-4 text-teal-500" />
                                            {feature}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Security */}
                <section className="bg-teal-50 rounded-2xl p-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="w-20 h-20 bg-teal-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                            <ShieldCheckIcon className="w-10 h-10 text-teal-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Безпечні платежі</h2>
                            <p className="text-gray-600 mb-4">
                                Всі платежі захищені за стандартом PCI DSS. Ваші платіжні дані передаються
                                через захищене з&apos;єднання і не зберігаються на наших серверах.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <span className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-700">
                                    🔒 SSL шифрування
                                </span>
                                <span className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-700">
                                    ✓ 3D Secure
                                </span>
                                <span className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-700">
                                    🛡️ PCI DSS
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
