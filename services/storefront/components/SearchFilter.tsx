'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Category } from '@/lib/api';

interface SearchFilterProps {
    categories?: Category[];
}

export default function SearchFilter({ categories = [] }: SearchFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
    const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
    const [categoryId, setCategoryId] = useState(searchParams.get('category_id') || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (minPrice) params.set('min_price', minPrice);
        if (maxPrice) params.set('max_price', maxPrice);
        if (categoryId) params.set('category_id', categoryId);

        const queryString = params.toString();
        router.push(queryString ? `/?${queryString}` : '/');
    };

    const handleClear = () => {
        setSearch('');
        setMinPrice('');
        setMaxPrice('');
        setCategoryId('');
        router.push('/');
    };

    const hasFilters = search || minPrice || maxPrice || categoryId;

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Пошук
                    </label>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Назва або SKU..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="w-full md:w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Від, грн
                    </label>
                    <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                        placeholder="0"
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div className="w-full md:w-32">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        До, грн
                    </label>
                    <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                        placeholder="99999"
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {categories.length > 0 && (
                    <div className="w-full md:w-40">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Категорія
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Всі категорії</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Знайти
                    </button>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Скинути
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}
