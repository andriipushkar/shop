'use client';

import { useState } from 'react';
import {
    PlusIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    EyeIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FunnelIcon,
    ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';

// Mock products data
const productsData = [
    { id: 1, name: 'iPhone 15 Pro Max 256GB', sku: 'IPHONE-15-PRO-256', category: 'Смартфони', price: 54999, stock: 15, status: 'active', image: '/products/iphone.jpg' },
    { id: 2, name: 'Samsung Galaxy S24 Ultra', sku: 'SAMSUNG-S24-ULTRA', category: 'Смартфони', price: 49999, stock: 23, status: 'active', image: '/products/samsung.jpg' },
    { id: 3, name: 'MacBook Pro 14" M3', sku: 'MACBOOK-PRO-14-M3', category: 'Ноутбуки', price: 89999, stock: 8, status: 'active', image: '/products/macbook.jpg' },
    { id: 4, name: 'Sony WH-1000XM5', sku: 'SONY-WH1000XM5', category: 'Аудіо', price: 12999, stock: 19, status: 'active', image: '/products/headphones.jpg' },
    { id: 5, name: 'Apple Watch Ultra 2', sku: 'APPLE-WATCH-ULTRA2', category: 'Годинники', price: 34999, stock: 25, status: 'active', image: '/products/watch.jpg' },
    { id: 6, name: 'iPad Pro 12.9" M2', sku: 'IPAD-PRO-129-M2', category: 'Планшети', price: 58999, stock: 0, status: 'out_of_stock', image: '/products/ipad.jpg' },
    { id: 7, name: 'AirPods Pro 2', sku: 'AIRPODS-PRO-2', category: 'Аудіо', price: 9999, stock: 45, status: 'active', image: '/products/airpods.jpg' },
    { id: 8, name: 'Samsung Galaxy Tab S9', sku: 'SAMSUNG-TAB-S9', category: 'Планшети', price: 32999, stock: 12, status: 'active', image: '/products/tablet.jpg' },
    { id: 9, name: 'Dell XPS 15', sku: 'DELL-XPS-15', category: 'Ноутбуки', price: 67999, stock: 5, status: 'low_stock', image: '/products/dell.jpg' },
    { id: 10, name: 'Logitech MX Master 3S', sku: 'LOGITECH-MX-3S', category: 'Аксесуари', price: 3999, stock: 78, status: 'active', image: '/products/mouse.jpg' },
];

const categories = ['Всі', 'Смартфони', 'Ноутбуки', 'Планшети', 'Аудіо', 'Годинники', 'Аксесуари'];
const statuses = ['Всі', 'Активний', 'Немає в наявності', 'Мало на складі'];

export default function AdminProductsPage() {
    const [products] = useState(productsData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Всі');
    const [selectedStatus, setSelectedStatus] = useState('Всі');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFilters, setShowFilters] = useState(false);

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            product.sku.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'Всі' || product.category === selectedCategory;
        const matchesStatus = selectedStatus === 'Всі' ||
            (selectedStatus === 'Активний' && product.status === 'active') ||
            (selectedStatus === 'Немає в наявності' && product.status === 'out_of_stock') ||
            (selectedStatus === 'Мало на складі' && product.status === 'low_stock');
        return matchesSearch && matchesCategory && matchesStatus;
    });

    const itemsPerPage = 10;
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Активний</span>;
            case 'out_of_stock':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Немає в наявності</span>;
            case 'low_stock':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Мало на складі</span>;
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Товари</h1>
                    <p className="text-gray-600">Управління каталогом товарів</p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати товар
                </Link>
            </div>

            {/* Filters and search */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за назвою або SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 border rounded-lg font-medium transition-colors ${
                                showFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FunnelIcon className="w-5 h-5" />
                            Фільтри
                        </button>
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
                            <ArrowsUpDownIcon className="w-5 h-5" />
                            Сортування
                        </button>
                    </div>
                </div>

                {/* Extended filters */}
                {showFilters && (
                    <div className="mt-4 pt-4 border-t grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Категорія</label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                {statuses.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ціна від</label>
                            <input
                                type="number"
                                placeholder="0"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Ціна до</label>
                            <input
                                type="number"
                                placeholder="999999"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Products table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    <input type="checkbox" className="rounded border-gray-300" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Категорія</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ціна</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Залишок</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <input type="checkbox" className="rounded border-gray-300" />
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                <span className="text-gray-400 text-xs">IMG</span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{product.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{product.category}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{product.price.toLocaleString()} ₴</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{product.stock} шт</td>
                                    <td className="px-6 py-4">{getStatusBadge(product.status)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <EyeIcon className="w-5 h-5" />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                            <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm text-gray-600">
                        Показано {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} з {filteredProducts.length} товарів
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`px-3.5 py-2 rounded-lg font-medium transition-colors ${
                                    currentPage === page
                                        ? 'bg-teal-600 text-white'
                                        : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRightIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
