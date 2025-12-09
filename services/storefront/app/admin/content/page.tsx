'use client';

import { useState } from 'react';
import {
    DocumentTextIcon,
    PencilSquareIcon,
    EyeIcon,
    PhotoIcon,
    QuestionMarkCircleIcon,
    InformationCircleIcon,
    TruckIcon,
    ArrowPathIcon,
    PhoneIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

type PageType = 'static' | 'faq' | 'banner';

interface ContentPage {
    id: string;
    title: string;
    slug: string;
    type: PageType;
    lastUpdated: string;
    status: 'published' | 'draft';
    icon: React.ElementType;
}

const pages: ContentPage[] = [
    { id: '1', title: 'Про нас', slug: '/about', type: 'static', lastUpdated: '05.12.2024', status: 'published', icon: InformationCircleIcon },
    { id: '2', title: 'Доставка і оплата', slug: '/delivery', type: 'static', lastUpdated: '03.12.2024', status: 'published', icon: TruckIcon },
    { id: '3', title: 'Повернення і обмін', slug: '/returns', type: 'static', lastUpdated: '01.12.2024', status: 'published', icon: ArrowPathIcon },
    { id: '4', title: 'Контакти', slug: '/contact', type: 'static', lastUpdated: '28.11.2024', status: 'published', icon: PhoneIcon },
    { id: '5', title: 'FAQ', slug: '/faq', type: 'faq', lastUpdated: '10.12.2024', status: 'published', icon: QuestionMarkCircleIcon },
];

interface Banner {
    id: number;
    title: string;
    image: string;
    link: string;
    position: string;
    active: boolean;
    startDate: string;
    endDate: string;
}

const banners: Banner[] = [
    { id: 1, title: 'Зимовий розпродаж', image: '/banners/winter-sale.jpg', link: '/sale', position: 'Головна - слайдер', active: true, startDate: '01.12.2024', endDate: '31.12.2024' },
    { id: 2, title: 'Новорічні знижки', image: '/banners/new-year.jpg', link: '/sale', position: 'Головна - слайдер', active: true, startDate: '15.12.2024', endDate: '15.01.2025' },
    { id: 3, title: 'Безкоштовна доставка', image: '/banners/free-delivery.jpg', link: '/delivery', position: 'Головна - банер', active: true, startDate: '01.01.2024', endDate: '31.12.2024' },
    { id: 4, title: 'Акція iPhone', image: '/banners/iphone.jpg', link: '/category/smartphones', position: 'Категорія - смартфони', active: false, startDate: '01.11.2024', endDate: '30.11.2024' },
];

interface FaqItem {
    id: number;
    category: string;
    question: string;
    answer: string;
    order: number;
}

const faqItems: FaqItem[] = [
    { id: 1, category: 'Замовлення', question: 'Як зробити замовлення?', answer: 'Додайте товари в кошик та оформіть замовлення...', order: 1 },
    { id: 2, category: 'Замовлення', question: 'Як відстежити замовлення?', answer: 'Перейдіть в особистий кабінет...', order: 2 },
    { id: 3, category: 'Доставка', question: 'Скільки коштує доставка?', answer: 'Безкоштовно при замовленні від 1000 грн...', order: 1 },
    { id: 4, category: 'Оплата', question: 'Які способи оплати?', answer: 'Картка онлайн, LiqPay, накладений платіж...', order: 1 },
    { id: 5, category: 'Повернення', question: 'Як повернути товар?', answer: 'Протягом 14 днів без пояснення причин...', order: 1 },
];

export default function AdminContentPage() {
    const [activeTab, setActiveTab] = useState<'pages' | 'banners' | 'faq'>('pages');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPage, setEditingPage] = useState<ContentPage | null>(null);
    const [showBannerModal, setShowBannerModal] = useState(false);
    const [showFaqModal, setShowFaqModal] = useState(false);

    const tabs = [
        { id: 'pages', name: 'Сторінки', count: pages.length },
        { id: 'banners', name: 'Банери', count: banners.length },
        { id: 'faq', name: 'FAQ', count: faqItems.length },
    ];

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Управління контентом</h1>
                    <p className="text-gray-600">Сторінки, банери та FAQ</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
                <div className="border-b">
                    <nav className="flex gap-8 px-6">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`py-4 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                                    activeTab === tab.id
                                        ? 'border-teal-600 text-teal-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.name}
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === tab.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* Pages tab */}
                    {activeTab === 'pages' && (
                        <div className="space-y-4">
                            {pages.map((page) => (
                                <div key={page.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                            <page.icon className="w-5 h-5 text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{page.title}</p>
                                            <p className="text-sm text-gray-500">{page.slug}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm text-gray-500">
                                            Оновлено: {page.lastUpdated}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                            page.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {page.status === 'published' ? 'Опубліковано' : 'Чернетка'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={page.slug}
                                                target="_blank"
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <EyeIcon className="w-5 h-5" />
                                            </a>
                                            <button
                                                onClick={() => {
                                                    setEditingPage(page);
                                                    setShowEditModal(true);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-white rounded-lg transition-colors"
                                            >
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Banners tab */}
                    {activeTab === 'banners' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowBannerModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                >
                                    <PhotoIcon className="w-5 h-5" />
                                    Додати банер
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {banners.map((banner) => (
                                    <div key={banner.id} className={`border rounded-xl overflow-hidden ${banner.active ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
                                        <div className="aspect-[3/1] bg-gray-100 flex items-center justify-center">
                                            <PhotoIcon className="w-12 h-12 text-gray-300" />
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <p className="font-medium text-gray-900">{banner.title}</p>
                                                    <p className="text-sm text-gray-500">{banner.position}</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" defaultChecked={banner.active} className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500">
                                                    {banner.startDate} - {banner.endDate}
                                                </span>
                                                <button className="text-teal-600 hover:text-teal-700 font-medium">
                                                    Редагувати
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* FAQ tab */}
                    {activeTab === 'faq' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowFaqModal(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                >
                                    <QuestionMarkCircleIcon className="w-5 h-5" />
                                    Додати питання
                                </button>
                            </div>

                            {['Замовлення', 'Доставка', 'Оплата', 'Повернення'].map((category) => (
                                <div key={category} className="bg-gray-50 rounded-xl p-4">
                                    <h3 className="font-semibold text-gray-900 mb-3">{category}</h3>
                                    <div className="space-y-2">
                                        {faqItems.filter(item => item.category === category).map((item) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-gray-900 text-sm">{item.question}</p>
                                                    <p className="text-xs text-gray-500 mt-1 truncate">{item.answer}</p>
                                                </div>
                                                <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-lg transition-colors">
                                                    <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Page Modal */}
            {showEditModal && editingPage && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Редагувати: {editingPage.title}
                            </h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Заголовок сторінки
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={editingPage.title}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={editingPage.slug}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Контент
                                    </label>
                                    <textarea
                                        rows={10}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="HTML або Markdown контент..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Підтримується HTML та Markdown</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meta Title
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meta Description
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Зберегти
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
