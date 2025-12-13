'use client';

import { useState } from 'react';
import {
    DocumentTextIcon,
    PhotoIcon,
    Bars3Icon,
    FolderIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    EyeIcon,
    CheckCircleIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';

interface Page {
    id: string;
    title: string;
    slug: string;
    status: 'published' | 'draft';
    updatedAt: string;
}

interface Banner {
    id: string;
    title: string;
    image: string;
    link: string;
    position: string;
    isActive: boolean;
}

interface MenuItem {
    id: string;
    title: string;
    url: string;
    order: number;
    children?: MenuItem[];
}

const mockPages: Page[] = [
    { id: '1', title: 'Про нас', slug: 'about', status: 'published', updatedAt: new Date().toISOString() },
    { id: '2', title: 'Доставка та оплата', slug: 'delivery', status: 'published', updatedAt: new Date(Date.now() - 86400000).toISOString() },
    { id: '3', title: 'Контакти', slug: 'contacts', status: 'published', updatedAt: new Date(Date.now() - 172800000).toISOString() },
    { id: '4', title: 'Акції', slug: 'promotions', status: 'draft', updatedAt: new Date(Date.now() - 259200000).toISOString() },
];

const mockBanners: Banner[] = [
    { id: '1', title: 'Новорічний розпродаж', image: '/banners/newyear.jpg', link: '/sale', position: 'homepage', isActive: true },
    { id: '2', title: 'Безкоштовна доставка', image: '/banners/delivery.jpg', link: '/delivery', position: 'homepage', isActive: true },
    { id: '3', title: 'Знижки до 50%', image: '/banners/sale50.jpg', link: '/catalog?discount=50', position: 'sidebar', isActive: false },
];

const mockMenu: MenuItem[] = [
    { id: '1', title: 'Головна', url: '/', order: 1 },
    { id: '2', title: 'Каталог', url: '/catalog', order: 2, children: [
        { id: '2-1', title: 'Електроніка', url: '/catalog/electronics', order: 1 },
        { id: '2-2', title: 'Одяг', url: '/catalog/clothing', order: 2 },
        { id: '2-3', title: 'Дім та сад', url: '/catalog/home-garden', order: 3 },
    ]},
    { id: '3', title: 'Акції', url: '/promotions', order: 3 },
    { id: '4', title: 'Про нас', url: '/about', order: 4 },
    { id: '5', title: 'Контакти', url: '/contacts', order: 5 },
];

export default function CMSPage() {
    const [activeTab, setActiveTab] = useState<'pages' | 'banners' | 'menu' | 'media'>('pages');
    const [pages, setPages] = useState<Page[]>(mockPages);
    const [banners, setBanners] = useState<Banner[]>(mockBanners);
    const [menu] = useState<MenuItem[]>(mockMenu);
    const [showPageModal, setShowPageModal] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(dateString));
    };

    const handleDeletePage = (pageId: string) => {
        setPages((prev) => prev.filter((p) => p.id !== pageId));
    };

    const handleToggleBanner = (bannerId: string) => {
        setBanners((prev) =>
            prev.map((b) =>
                b.id === bannerId ? { ...b, isActive: !b.isActive } : b
            )
        );
    };

    const tabs = [
        { id: 'pages', label: 'Сторінки', icon: DocumentTextIcon },
        { id: 'banners', label: 'Банери', icon: PhotoIcon },
        { id: 'menu', label: 'Меню', icon: Bars3Icon },
        { id: 'media', label: 'Медіа', icon: FolderIcon },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Контент</h1>
                    <p className="text-gray-600">Управління сторінками, банерами та медіа файлами</p>
                </div>
                {activeTab === 'pages' && (
                    <button
                        onClick={() => {
                            setEditingPage(null);
                            setShowPageModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Додати сторінку
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Pages Tab */}
            {activeTab === 'pages' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden" data-testid="pages-table">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Назва
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    URL
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Статус
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Оновлено
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Дії
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {pages.map((page) => (
                                <tr key={page.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm font-medium text-gray-900">{page.title}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-500">/{page.slug}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                                page.status === 'published'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                        >
                                            {page.status === 'published' ? (
                                                <CheckCircleIcon className="w-3 h-3" />
                                            ) : (
                                                <XCircleIcon className="w-3 h-3" />
                                            )}
                                            {page.status === 'published' ? 'Опубліковано' : 'Чернетка'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-500">{formatDate(page.updatedAt)}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="p-1 text-gray-400 hover:text-blue-600">
                                                <EyeIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingPage(page);
                                                    setShowPageModal(true);
                                                }}
                                                className="p-1 text-gray-400 hover:text-teal-600"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePage(page.id)}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Banners Tab */}
            {activeTab === 'banners' && (
                <div className="space-y-6" data-testid="banners-grid">
                    <div className="flex justify-end">
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            <PlusIcon className="w-5 h-5" />
                            Додати банер
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {banners.map((banner) => (
                            <div
                                key={banner.id}
                                className={`bg-white rounded-xl shadow-sm overflow-hidden border-2 ${
                                    banner.isActive ? 'border-green-200' : 'border-gray-200'
                                }`}
                            >
                                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                                    <PhotoIcon className="w-16 h-16 text-gray-300" />
                                </div>
                                <div className="p-4">
                                    <h3 className="font-semibold text-gray-900 mb-1">{banner.title}</h3>
                                    <p className="text-sm text-gray-500 mb-3">
                                        Позиція: {banner.position === 'homepage' ? 'Головна' : 'Бічна панель'}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={banner.isActive}
                                                onChange={() => handleToggleBanner(banner.id)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                            <span className="ml-2 text-sm text-gray-600">
                                                {banner.isActive ? 'Активний' : 'Неактивний'}
                                            </span>
                                        </label>
                                        <div className="flex gap-2">
                                            <button className="p-1 text-gray-400 hover:text-teal-600">
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button className="p-1 text-gray-400 hover:text-red-600">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Menu Tab */}
            {activeTab === 'menu' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Структура меню</h2>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            <PlusIcon className="w-5 h-5" />
                            Додати пункт
                        </button>
                    </div>
                    <div className="space-y-2">
                        {menu.map((item) => (
                            <div key={item.id}>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    <Bars3Icon className="w-5 h-5 text-gray-400 cursor-move" />
                                    <span className="flex-1 font-medium text-gray-900">{item.title}</span>
                                    <span className="text-sm text-gray-500">{item.url}</span>
                                    <div className="flex gap-2">
                                        <button className="p-1 text-gray-400 hover:text-teal-600">
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                        <button className="p-1 text-gray-400 hover:text-red-600">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {item.children && (
                                    <div className="ml-8 mt-2 space-y-2">
                                        {item.children.map((child) => (
                                            <div
                                                key={child.id}
                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                                            >
                                                <Bars3Icon className="w-5 h-5 text-gray-400 cursor-move" />
                                                <span className="flex-1 text-gray-900">{child.title}</span>
                                                <span className="text-sm text-gray-500">{child.url}</span>
                                                <div className="flex gap-2">
                                                    <button className="p-1 text-gray-400 hover:text-teal-600">
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button className="p-1 text-gray-400 hover:text-red-600">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <div className="text-center py-12">
                        <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Медіа бібліотека</h3>
                        <p className="text-gray-500 mb-4">
                            Завантажуйте та керуйте зображеннями та файлами
                        </p>
                        <button className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                            <PlusIcon className="w-5 h-5" />
                            Завантажити файли
                        </button>
                    </div>
                </div>
            )}

            {/* Page Modal */}
            {showPageModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowPageModal(false)} />
                        <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">
                                {editingPage ? 'Редагувати сторінку' : 'Нова сторінка'}
                            </h2>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва
                                    </label>
                                    <input
                                        type="text"
                                        name="title"
                                        defaultValue={editingPage?.title}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Введіть назву сторінки"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL (slug)
                                    </label>
                                    <input
                                        type="text"
                                        name="slug"
                                        defaultValue={editingPage?.slug}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="url-сторінки"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Контент
                                    </label>
                                    <textarea
                                        name="content"
                                        rows={8}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Введіть контент сторінки..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Статус
                                    </label>
                                    <select
                                        name="status"
                                        defaultValue={editingPage?.status || 'draft'}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    >
                                        <option value="draft">Чернетка</option>
                                        <option value="published">Опубліковано</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowPageModal(false)}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
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
