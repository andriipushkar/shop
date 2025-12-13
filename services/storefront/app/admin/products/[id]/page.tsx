'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { logger } from '@/lib/logger';
import {
    ArrowLeftIcon,
    PhotoIcon,
    TrashIcon,
    PlusIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

interface Product {
    id: string;
    name: string;
    nameUa: string;
    description: string;
    descriptionUa: string;
    price: number;
    oldPrice?: number;
    sku: string;
    stock: number;
    categoryId: string;
    brand: string;
    images: string[];
    status: 'active' | 'draft' | 'archived';
    attributes: Record<string, string>;
    seoTitle?: string;
    seoDescription?: string;
    weight?: number;
    dimensions?: { width: number; height: number; depth: number };
}

interface Category {
    id: string;
    name: string;
    slug: string;
}

const mockCategories: Category[] = [
    { id: '1', name: 'Електроніка', slug: 'electronics' },
    { id: '2', name: 'Смартфони', slug: 'smartphones' },
    { id: '3', name: 'Ноутбуки', slug: 'laptops' },
    { id: '4', name: 'Побутова техніка', slug: 'appliances' },
    { id: '5', name: 'Одяг', slug: 'clothing' },
];

const mockProduct: Product = {
    id: '1',
    name: 'iPhone 15 Pro Max',
    nameUa: 'iPhone 15 Pro Max',
    description: 'The most powerful iPhone ever with A17 Pro chip',
    descriptionUa: 'Найпотужніший iPhone з чипом A17 Pro',
    price: 54999,
    oldPrice: 59999,
    sku: 'IPHONE15PM-256-BLK',
    stock: 25,
    categoryId: '2',
    brand: 'Apple',
    images: [
        '/products/iphone15-1.jpg',
        '/products/iphone15-2.jpg',
        '/products/iphone15-3.jpg',
    ],
    status: 'active',
    attributes: {
        'Колір': 'Чорний титан',
        "Пам'ять": '256 ГБ',
        'Дисплей': '6.7"',
        'Процесор': 'A17 Pro',
    },
    seoTitle: 'iPhone 15 Pro Max - купити в Україні',
    seoDescription: 'Купити iPhone 15 Pro Max за найкращою ціною в Україні. Офіційна гарантія.',
    weight: 221,
    dimensions: { width: 76.7, height: 159.9, depth: 8.25 },
};

export default function ProductEditPage() {
    const params = useParams();
    const router = useRouter();
    const productId = params.id as string;
    const isNew = productId === 'new';

    const [product, setProduct] = useState<Product>(
        isNew
            ? {
                id: '',
                name: '',
                nameUa: '',
                description: '',
                descriptionUa: '',
                price: 0,
                sku: '',
                stock: 0,
                categoryId: '',
                brand: '',
                images: [],
                status: 'draft',
                attributes: {},
            }
            : mockProduct
    );

    const [categories] = useState<Category[]>(mockCategories);
    const [activeTab, setActiveTab] = useState<'general' | 'media' | 'attributes' | 'seo'>('general');
    const [isSaving, setIsSaving] = useState(false);
    const [newAttributeKey, setNewAttributeKey] = useState('');
    const [newAttributeValue, setNewAttributeValue] = useState('');

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value, type } = e.target;
        setProduct((prev) => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };

    const handleAddAttribute = () => {
        if (newAttributeKey && newAttributeValue) {
            setProduct((prev) => ({
                ...prev,
                attributes: {
                    ...prev.attributes,
                    [newAttributeKey]: newAttributeValue,
                },
            }));
            setNewAttributeKey('');
            setNewAttributeValue('');
        }
    };

    const handleRemoveAttribute = (key: string) => {
        setProduct((prev) => {
            const newAttributes = { ...prev.attributes };
            delete newAttributes[key];
            return { ...prev, attributes: newAttributes };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // API call would go here
            await new Promise((resolve) => setTimeout(resolve, 1000));
            router.push('/admin/products');
        } catch (error) {
            logger.error('Failed to save product', error);
        } finally {
            setIsSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Основне' },
        { id: 'media', label: 'Медіа' },
        { id: 'attributes', label: 'Характеристики' },
        { id: 'seo', label: 'SEO' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin/products"
                        className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                        <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isNew ? 'Новий товар' : 'Редагування товару'}
                        </h1>
                        {!isNew && (
                            <p className="text-sm text-gray-500">SKU: {product.sku}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        name="status"
                        value={product.status}
                        onChange={handleInputChange}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                        <option value="draft">Чернетка</option>
                        <option value="active">Активний</option>
                        <option value="archived">Архівований</option>
                    </select>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <>Збереження...</>
                        ) : (
                            <>
                                <CheckIcon className="w-5 h-5" />
                                Зберегти
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Інформація про товар</h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Назва (EN)
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={product.name}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Назва (UA)
                                        </label>
                                        <input
                                            type="text"
                                            name="nameUa"
                                            value={product.nameUa}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Опис (EN)
                                    </label>
                                    <textarea
                                        name="description"
                                        value={product.description}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Опис (UA)
                                    </label>
                                    <textarea
                                        name="descriptionUa"
                                        value={product.descriptionUa}
                                        onChange={handleInputChange}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ціна та наявність</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ціна (грн)
                                    </label>
                                    <input
                                        type="number"
                                        name="price"
                                        value={product.price}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Стара ціна
                                    </label>
                                    <input
                                        type="number"
                                        name="oldPrice"
                                        value={product.oldPrice || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        SKU
                                    </label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={product.sku}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Залишок
                                    </label>
                                    <input
                                        type="number"
                                        name="stock"
                                        value={product.stock}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Організація</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Категорія
                                    </label>
                                    <select
                                        name="categoryId"
                                        value={product.categoryId}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    >
                                        <option value="">Оберіть категорію</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Бренд
                                    </label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={product.brand}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Доставка</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Вага (г)
                                    </label>
                                    <input
                                        type="number"
                                        name="weight"
                                        value={product.weight || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Ширина (мм)
                                        </label>
                                        <input
                                            type="number"
                                            value={product.dimensions?.width || ''}
                                            onChange={(e) =>
                                                setProduct((prev) => ({
                                                    ...prev,
                                                    dimensions: {
                                                        ...prev.dimensions,
                                                        width: parseFloat(e.target.value) || 0,
                                                        height: prev.dimensions?.height || 0,
                                                        depth: prev.dimensions?.depth || 0,
                                                    },
                                                }))
                                            }
                                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Висота (мм)
                                        </label>
                                        <input
                                            type="number"
                                            value={product.dimensions?.height || ''}
                                            onChange={(e) =>
                                                setProduct((prev) => ({
                                                    ...prev,
                                                    dimensions: {
                                                        ...prev.dimensions,
                                                        width: prev.dimensions?.width || 0,
                                                        height: parseFloat(e.target.value) || 0,
                                                        depth: prev.dimensions?.depth || 0,
                                                    },
                                                }))
                                            }
                                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Глибина (мм)
                                        </label>
                                        <input
                                            type="number"
                                            value={product.dimensions?.depth || ''}
                                            onChange={(e) =>
                                                setProduct((prev) => ({
                                                    ...prev,
                                                    dimensions: {
                                                        ...prev.dimensions,
                                                        width: prev.dimensions?.width || 0,
                                                        height: prev.dimensions?.height || 0,
                                                        depth: parseFloat(e.target.value) || 0,
                                                    },
                                                }))
                                            }
                                            className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Зображення товару</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {product.images.map((image, index) => (
                            <div
                                key={index}
                                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <PhotoIcon className="w-12 h-12 text-gray-300" />
                                </div>
                                <button
                                    onClick={() =>
                                        setProduct((prev) => ({
                                            ...prev,
                                            images: prev.images.filter((_, i) => i !== index),
                                        }))
                                    }
                                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                                {index === 0 && (
                                    <span className="absolute bottom-2 left-2 px-2 py-1 bg-teal-600 text-white text-xs rounded">
                                        Головне
                                    </span>
                                )}
                            </div>
                        ))}
                        <button className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-teal-500 hover:text-teal-500 transition-colors">
                            <PlusIcon className="w-8 h-8" />
                            <span className="text-sm mt-1">Додати</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Attributes Tab */}
            {activeTab === 'attributes' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Характеристики</h2>
                    <div className="space-y-4">
                        {Object.entries(product.attributes).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-4">
                                <input
                                    type="text"
                                    value={key}
                                    disabled
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                />
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) =>
                                        setProduct((prev) => ({
                                            ...prev,
                                            attributes: {
                                                ...prev.attributes,
                                                [key]: e.target.value,
                                            },
                                        }))
                                    }
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                                <button
                                    onClick={() => handleRemoveAttribute(key)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ))}

                        <div className="flex items-center gap-4 pt-4 border-t">
                            <input
                                type="text"
                                value={newAttributeKey}
                                onChange={(e) => setNewAttributeKey(e.target.value)}
                                placeholder="Назва характеристики"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            <input
                                type="text"
                                value={newAttributeValue}
                                onChange={(e) => setNewAttributeValue(e.target.value)}
                                placeholder="Значення"
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleAddAttribute}
                                disabled={!newAttributeKey || !newAttributeValue}
                                className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                                <PlusIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SEO Tab */}
            {activeTab === 'seo' && (
                <div className="bg-white rounded-xl shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">SEO налаштування</h2>
                    <div className="space-y-4 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Meta Title
                            </label>
                            <input
                                type="text"
                                name="seoTitle"
                                value={product.seoTitle || ''}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {(product.seoTitle || '').length}/60 символів
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Meta Description
                            </label>
                            <textarea
                                name="seoDescription"
                                value={product.seoDescription || ''}
                                onChange={handleInputChange}
                                rows={3}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {(product.seoDescription || '').length}/160 символів
                            </p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-2">Попередній перегляд:</p>
                            <div className="space-y-1">
                                <p className="text-blue-700 text-lg">
                                    {product.seoTitle || product.nameUa || 'Назва товару'}
                                </p>
                                <p className="text-green-700 text-sm">
                                    example.com/product/{product.id || 'new'}
                                </p>
                                <p className="text-gray-600 text-sm">
                                    {product.seoDescription || product.descriptionUa?.slice(0, 160) || 'Опис товару...'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
