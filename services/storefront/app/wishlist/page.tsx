'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useAuth } from '@/lib/auth-context';
import {
    HeartIcon,
    ShoppingCartIcon,
    TrashIcon,
    ShareIcon,
    BellIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

export default function WishlistPage() {
    const { addToCart } = useCart();
    const { items, removeFromWishlist, clearWishlist, totalItems } = useWishlist();
    const { isAuthenticated } = useAuth();
    const [addedToCart, setAddedToCart] = useState<string | null>(null);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const handleAddToCart = (item: typeof items[0]) => {
        addToCart({
            id: item.productId,
            name: item.name,
            price: item.price,
            sku: item.productId,
            stock: 100,
            image_url: item.image,
        });
        setAddedToCart(item.productId);
        setTimeout(() => setAddedToCart(null), 2000);
    };

    const addAllToCart = () => {
        items.forEach(item => {
            addToCart({
                id: item.productId,
                name: item.name,
                price: item.price,
                sku: item.productId,
                stock: 100,
                image_url: item.image,
            });
        });
        setAddedToCart('all');
        setTimeout(() => setAddedToCart(null), 2000);
    };

    const handleShare = async () => {
        const shareText = `Мій список бажань:\n${items.map(item => `- ${item.name} (${item.price.toLocaleString()} грн)`).join('\n')}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Список бажань - MyShop',
                    text: shareText,
                });
            } catch {
                // User cancelled sharing
            }
        } else {
            await navigator.clipboard.writeText(shareText);
            alert('Список скопійовано в буфер обміну!');
        }
    };

    const getItemCountText = (count: number): string => {
        if (count === 1) return 'товар';
        if (count >= 2 && count <= 4) return 'товари';
        return 'товарів';
    };

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <HeartSolidIcon className="w-8 h-8 text-red-500" />
                            Список бажань
                        </h1>
                        <p className="text-gray-600 mt-1">
                            {totalItems} {getItemCountText(totalItems)}
                        </p>
                    </div>

                    {items.length > 0 && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <ShareIcon className="w-5 h-5" />
                                Поділитися
                            </button>
                            <button
                                onClick={addAllToCart}
                                className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                <ShoppingCartIcon className="w-5 h-5" />
                                {addedToCart === 'all' ? 'Додано!' : 'Додати все в кошик'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Auth reminder for guests */}
                {!isAuthenticated && items.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <p className="text-blue-800">
                            <Link href="/auth/login" className="font-semibold hover:underline">Увійдіть</Link> або{' '}
                            <Link href="/auth/register" className="font-semibold hover:underline">зареєструйтесь</Link>,
                            щоб зберегти список бажань та отримувати сповіщення про зниження цін.
                        </p>
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <HeartIcon className="w-12 h-12 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Список бажань порожній</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            Додавайте товари до списку бажань, натискаючи на серце на сторінці товару
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-700 transition-colors"
                        >
                            Перейти до каталогу
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Notification Settings */}
                        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-8 flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                                <BellIcon className="w-6 h-6 text-primary-600" />
                                <div>
                                    <p className="font-medium text-gray-900">Сповіщення про зниження ціни</p>
                                    <p className="text-sm text-gray-600">Отримуйте сповіщення, коли ціна на товар знизиться</p>
                                </div>
                            </div>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={notificationsEnabled}
                                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                                />
                                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>

                        {/* Clear All Button */}
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={clearWishlist}
                                className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Очистити список
                            </button>
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {items.map((item) => (
                                <div key={item.productId} className="bg-white rounded-2xl shadow-sm overflow-hidden group">
                                    {/* Image */}
                                    <div className="relative aspect-square bg-gray-100">
                                        <Link href={`/product/${item.productId}`}>
                                            {item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <span className="text-6xl opacity-30">📦</span>
                                                </div>
                                            )}
                                        </Link>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => removeFromWishlist(item.productId)}
                                            className="absolute top-3 right-3 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors"
                                        >
                                            <HeartSolidIcon className="w-5 h-5 text-red-500" />
                                        </button>

                                        {/* Date added badge */}
                                        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-600">
                                            Додано: {new Date(item.addedAt).toLocaleDateString('uk-UA')}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <Link href={`/product/${item.productId}`}>
                                            <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary-600 transition-colors">
                                                {item.name}
                                            </h3>
                                        </Link>
                                        <p className="text-lg font-bold text-primary-600 mt-2">
                                            {item.price.toLocaleString()} грн
                                        </p>

                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={() => handleAddToCart(item)}
                                                className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
                                                    addedToCart === item.productId
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-primary-600 text-white hover:bg-primary-700'
                                                }`}
                                            >
                                                <ShoppingCartIcon className="w-5 h-5" />
                                                {addedToCart === item.productId ? 'Додано!' : 'В кошик'}
                                            </button>
                                            <button
                                                onClick={() => removeFromWishlist(item.productId)}
                                                className="p-3 border border-gray-300 rounded-xl hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
