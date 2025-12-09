'use client';

import { useState } from 'react';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    FolderIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    EyeIcon,
    EyeSlashIcon,
} from '@heroicons/react/24/outline';

// Mock categories data
const categoriesData = [
    {
        id: 1,
        name: 'Електроніка',
        slug: 'electronics',
        products: 156,
        visible: true,
        children: [
            { id: 11, name: 'Смартфони', slug: 'smartphones', products: 45, visible: true },
            { id: 12, name: 'Ноутбуки', slug: 'laptops', products: 32, visible: true },
            { id: 13, name: 'Планшети', slug: 'tablets', products: 18, visible: true },
            { id: 14, name: 'Аудіо', slug: 'audio', products: 61, visible: true },
        ],
    },
    {
        id: 2,
        name: 'Одяг',
        slug: 'clothing',
        products: 324,
        visible: true,
        children: [
            { id: 21, name: 'Чоловічий одяг', slug: 'mens-clothing', products: 145, visible: true },
            { id: 22, name: 'Жіночий одяг', slug: 'womens-clothing', products: 179, visible: true },
        ],
    },
    {
        id: 3,
        name: 'Дім і сад',
        slug: 'home-garden',
        products: 89,
        visible: true,
        children: [
            { id: 31, name: 'Меблі', slug: 'furniture', products: 34, visible: true },
            { id: 32, name: 'Декор', slug: 'decor', products: 55, visible: false },
        ],
    },
    {
        id: 4,
        name: 'Спорт',
        slug: 'sports',
        products: 67,
        visible: true,
        children: [
            { id: 41, name: 'Велосипеди', slug: 'bikes', products: 23, visible: true },
            { id: 42, name: 'Фітнес', slug: 'fitness', products: 44, visible: true },
        ],
    },
    {
        id: 5,
        name: 'Аксесуари',
        slug: 'accessories',
        products: 234,
        visible: true,
        children: [],
    },
];

type Category = {
    id: number;
    name: string;
    slug: string;
    products: number;
    visible: boolean;
    children?: Category[];
};

export default function AdminCategoriesPage() {
    const [categories] = useState(categoriesData);
    const [expandedCategories, setExpandedCategories] = useState<number[]>([1, 2]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editCategory, setEditCategory] = useState<Category | null>(null);

    const toggleCategory = (id: number) => {
        setExpandedCategories(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const totalCategories = categories.reduce(
        (sum, cat) => sum + 1 + (cat.children?.length || 0),
        0
    );

    const totalProducts = categories.reduce(
        (sum, cat) => sum + cat.products,
        0
    );

    const filteredCategories = searchQuery
        ? categories.filter(cat =>
            cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cat.children?.some(child =>
                child.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
        : categories;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Категорії</h1>
                    <p className="text-gray-600">Управління категоріями товарів</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати категорію
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <FolderIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalCategories}</p>
                            <p className="text-sm text-gray-500">Всього категорій</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FolderIcon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
                            <p className="text-sm text-gray-500">Головних категорій</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FolderIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">
                                {categories.reduce((sum, cat) => sum + (cat.children?.length || 0), 0)}
                            </p>
                            <p className="text-sm text-gray-500">Підкатегорій</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FolderIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                            <p className="text-sm text-gray-500">Товарів в категоріях</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="relative max-w-md">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Пошук категорій..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>
            </div>

            {/* Categories tree */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="font-semibold text-gray-900">Дерево категорій</h2>
                </div>
                <div className="divide-y divide-gray-100">
                    {filteredCategories.map((category) => (
                        <div key={category.id}>
                            {/* Parent category */}
                            <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    {category.children && category.children.length > 0 ? (
                                        <button
                                            onClick={() => toggleCategory(category.id)}
                                            className="p-1 hover:bg-gray-100 rounded"
                                        >
                                            <ChevronRightIcon
                                                className={`w-5 h-5 text-gray-400 transition-transform ${
                                                    expandedCategories.includes(category.id) ? 'rotate-90' : ''
                                                }`}
                                            />
                                        </button>
                                    ) : (
                                        <div className="w-7" />
                                    )}
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <FolderIcon className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{category.name}</p>
                                        <p className="text-sm text-gray-500">/{category.slug}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">{category.products} товарів</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className={`p-1.5 rounded-lg transition-colors ${
                                                category.visible
                                                    ? 'text-green-600 hover:bg-green-50'
                                                    : 'text-gray-400 hover:bg-gray-100'
                                            }`}
                                        >
                                            {category.visible ? (
                                                <EyeIcon className="w-5 h-5" />
                                            ) : (
                                                <EyeSlashIcon className="w-5 h-5" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setEditCategory(category)}
                                            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <PencilSquareIcon className="w-5 h-5" />
                                        </button>
                                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Children categories */}
                            {expandedCategories.includes(category.id) && category.children && (
                                <div className="bg-gray-50">
                                    {category.children.map((child) => (
                                        <div
                                            key={child.id}
                                            className="flex items-center justify-between px-6 py-3 pl-16 hover:bg-gray-100"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                                                    <FolderIcon className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{child.name}</p>
                                                    <p className="text-xs text-gray-500">/{category.slug}/{child.slug}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-sm text-gray-500">{child.products} товарів</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className={`p-1.5 rounded-lg transition-colors ${
                                                            child.visible
                                                                ? 'text-green-600 hover:bg-green-50'
                                                                : 'text-gray-400 hover:bg-gray-100'
                                                        }`}
                                                    >
                                                        {child.visible ? (
                                                            <EyeIcon className="w-5 h-5" />
                                                        ) : (
                                                            <EyeSlashIcon className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                    <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {(showAddModal || editCategory) && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div
                            className="fixed inset-0 bg-black/50"
                            onClick={() => {
                                setShowAddModal(false);
                                setEditCategory(null);
                            }}
                        />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {editCategory ? 'Редагувати категорію' : 'Додати категорію'}
                            </h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва категорії
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={editCategory?.name || ''}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Введіть назву"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Slug (URL)
                                    </label>
                                    <input
                                        type="text"
                                        defaultValue={editCategory?.slug || ''}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="category-slug"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Батьківська категорія
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="">Немає (головна категорія)</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="visible"
                                        defaultChecked={editCategory?.visible ?? true}
                                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <label htmlFor="visible" className="text-sm text-gray-700">
                                        Показувати на сайті
                                    </label>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setEditCategory(null);
                                        }}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        {editCategory ? 'Зберегти' : 'Додати'}
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
