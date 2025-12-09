'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeftIcon,
    PhotoIcon,
    PlusIcon,
    XMarkIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

const categories = [
    { id: 1, name: 'Електроніка', children: ['Смартфони', 'Ноутбуки', 'Планшети', 'Аудіо'] },
    { id: 2, name: 'Одяг', children: ['Чоловічий одяг', 'Жіночий одяг'] },
    { id: 3, name: 'Дім і сад', children: ['Меблі', 'Декор'] },
    { id: 4, name: 'Спорт', children: ['Велосипеди', 'Фітнес'] },
    { id: 5, name: 'Аксесуари', children: [] },
];

interface ProductVariant {
    id: number;
    name: string;
    sku: string;
    price: string;
    stock: string;
}

export default function NewProductPage() {
    const [images, setImages] = useState<string[]>([]);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [hasVariants, setHasVariants] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'media' | 'pricing' | 'inventory' | 'seo'>('general');

    const addImage = () => {
        // In real app, this would open file picker
        const newImage = `/products/placeholder-${images.length + 1}.jpg`;
        setImages([...images, newImage]);
    };

    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const addVariant = () => {
        const newVariant: ProductVariant = {
            id: Date.now(),
            name: '',
            sku: '',
            price: '',
            stock: '',
        };
        setVariants([...variants, newVariant]);
    };

    const removeVariant = (id: number) => {
        setVariants(variants.filter(v => v.id !== id));
    };

    const updateVariant = (id: number, field: keyof ProductVariant, value: string) => {
        setVariants(variants.map(v =>
            v.id === id ? { ...v, [field]: value } : v
        ));
    };

    const tabs = [
        { id: 'general', name: 'Загальне' },
        { id: 'media', name: 'Медіа' },
        { id: 'pricing', name: 'Ціна' },
        { id: 'inventory', name: 'Склад' },
        { id: 'seo', name: 'SEO' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/products"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Новий товар</h1>
                        <p className="text-gray-600">Створення нового товару</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button className="px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        Зберегти як чернетку
                    </button>
                    <button className="px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors">
                        Опублікувати
                    </button>
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
                                className={`py-4 border-b-2 font-medium text-sm transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-teal-600 text-teal-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {/* General tab */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва товару *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Введіть назву товару"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SKU (артикул) *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="PRODUCT-001"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Штрих-код (EAN/UPC)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="1234567890123"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Категорія *
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="">Оберіть категорію</option>
                                        {categories.map((cat) => (
                                            <optgroup key={cat.id} label={cat.name}>
                                                {cat.children.length > 0 ? (
                                                    cat.children.map((child) => (
                                                        <option key={child} value={child}>{child}</option>
                                                    ))
                                                ) : (
                                                    <option value={cat.name}>{cat.name}</option>
                                                )}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Бренд
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Apple, Samsung, etc."
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Короткий опис
                                    </label>
                                    <textarea
                                        rows={2}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Короткий опис для карток товару"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Повний опис
                                    </label>
                                    <textarea
                                        rows={6}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Детальний опис товару, характеристики, особливості..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Media tab */}
                    {activeTab === 'media' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Зображення товару
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                    {images.map((image, index) => (
                                        <div key={index} className="relative aspect-square bg-gray-100 rounded-lg group">
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <PhotoIcon className="w-8 h-8" />
                                            </div>
                                            <button
                                                onClick={() => removeImage(index)}
                                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <XMarkIcon className="w-4 h-4" />
                                            </button>
                                            {index === 0 && (
                                                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-teal-600 text-white text-xs rounded">
                                                    Головне
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addImage}
                                        className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-teal-500 hover:text-teal-500 transition-colors"
                                    >
                                        <PlusIcon className="w-8 h-8" />
                                        <span className="text-xs mt-1">Додати</span>
                                    </button>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">
                                    Перше зображення буде головним. Рекомендований розмір: 1000x1000px
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Відео (YouTube URL)
                                </label>
                                <input
                                    type="url"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="https://www.youtube.com/watch?v=..."
                                />
                            </div>
                        </div>
                    )}

                    {/* Pricing tab */}
                    {activeTab === 'pricing' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ціна *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">₴</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Стара ціна (для знижки)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">₴</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Собівартість
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="0"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">₴</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Знижка (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="0"
                                            min="0"
                                            max="100"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-medium text-gray-900">Варіанти товару</h3>
                                        <p className="text-sm text-gray-500">Розмір, колір, об&apos;єм пам&apos;яті тощо</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={hasVariants}
                                            onChange={(e) => setHasVariants(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                                    </label>
                                </div>

                                {hasVariants && (
                                    <div className="space-y-4">
                                        {variants.map((variant, index) => (
                                            <div key={variant.id} className="flex gap-4 items-start p-4 bg-gray-50 rounded-lg">
                                                <div className="flex-1 grid grid-cols-4 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                                            Назва варіанту
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={variant.name}
                                                            onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                            placeholder="256GB, Чорний"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                                            SKU
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={variant.sku}
                                                            onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                            placeholder="SKU-001"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                                            Ціна
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={variant.price}
                                                            onChange={(e) => updateVariant(variant.id, 'price', e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">
                                                            Кількість
                                                        </label>
                                                        <input
                                                            type="number"
                                                            value={variant.stock}
                                                            onChange={(e) => updateVariant(variant.id, 'stock', e.target.value)}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeVariant(variant.id)}
                                                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={addVariant}
                                            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-teal-500 hover:text-teal-500 transition-colors"
                                        >
                                            <PlusIcon className="w-5 h-5 inline mr-2" />
                                            Додати варіант
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Inventory tab */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Кількість на складі
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="0"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Мінімальний залишок (для сповіщення)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="5"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Склад
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="main">Головний склад</option>
                                        <option value="kyiv">Склад Київ</option>
                                        <option value="lviv">Склад Львів</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Вага (кг)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="0.5"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Габарити (см)
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Довжина"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Ширина"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Висота"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3">
                                    <input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                    <span className="text-sm text-gray-700">Відстежувати залишки</span>
                                </label>
                                <label className="flex items-center gap-3">
                                    <input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                    <span className="text-sm text-gray-700">Дозволити продаж при відсутності на складі</span>
                                </label>
                                <label className="flex items-center gap-3">
                                    <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                                    <span className="text-sm text-gray-700">Показувати залишок на сайті</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* SEO tab */}
                    {activeTab === 'seo' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    URL (slug)
                                </label>
                                <div className="flex">
                                    <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg text-gray-500 text-sm">
                                        myshop.ua/product/
                                    </span>
                                    <input
                                        type="text"
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="iphone-15-pro-max-256gb"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Meta Title
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="iPhone 15 Pro Max 256GB - Купити в MyShop"
                                />
                                <p className="text-xs text-gray-500 mt-1">Рекомендовано: 50-60 символів</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Meta Description
                                </label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="Купити iPhone 15 Pro Max 256GB в Україні за найкращою ціною. Офіційна гарантія, швидка доставка."
                                />
                                <p className="text-xs text-gray-500 mt-1">Рекомендовано: 150-160 символів</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ключові слова
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    placeholder="iphone 15, apple, смартфон, купити iphone"
                                />
                            </div>

                            {/* Preview */}
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <p className="text-sm text-gray-500 mb-2">Попередній перегляд в Google:</p>
                                <div>
                                    <p className="text-blue-600 text-lg hover:underline cursor-pointer">
                                        iPhone 15 Pro Max 256GB - Купити в MyShop
                                    </p>
                                    <p className="text-green-700 text-sm">myshop.ua/product/iphone-15-pro-max-256gb</p>
                                    <p className="text-gray-600 text-sm">
                                        Купити iPhone 15 Pro Max 256GB в Україні за найкращою ціною. Офіційна гарантія, швидка доставка.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
