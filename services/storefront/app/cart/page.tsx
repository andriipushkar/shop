'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import {
    TrashIcon,
    MinusIcon,
    PlusIcon,
    ShoppingBagIcon,
    TruckIcon,
    ShieldCheckIcon,
    ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export default function CartPage() {
    const { items, updateQuantity, removeFromCart, clearCart, totalPrice, isLoading } = useCart();

    if (isLoading) {
        return (
            <main className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-48"></div>
                        <div className="bg-white rounded-2xl p-6 space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-24 h-24 bg-gray-200 rounded-xl"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-teal-600 mb-2">
                            <ArrowLeftIcon className="w-4 h-4" />
                            Продовжити покупки
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Кошик</h1>
                    </div>
                    {items.length > 0 && (
                        <span className="text-gray-500">{items.length} товар{items.length === 1 ? '' : items.length < 5 ? 'и' : 'ів'}</span>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ShoppingBagIcon className="w-12 h-12 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Кошик порожній</h2>
                        <p className="text-gray-500 mb-8 max-w-md mx-auto">
                            Додайте товари до кошика, щоб оформити замовлення
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 bg-teal-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                        >
                            <ShoppingBagIcon className="w-5 h-5" />
                            Перейти до каталогу
                        </Link>
                    </div>
                ) : (
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Cart Items */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                {items.map((item, index) => (
                                    <div
                                        key={item.product.id}
                                        className={`p-6 flex items-center gap-6 ${index !== items.length - 1 ? 'border-b border-gray-100' : ''}`}
                                    >
                                        {/* Product Image */}
                                        <Link href={`/product/${item.product.id}`} className="flex-shrink-0">
                                            <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                                                {item.product.image_url ? (
                                                    <img
                                                        src={item.product.image_url}
                                                        alt={item.product.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-4xl opacity-30">📦</span>
                                                )}
                                            </div>
                                        </Link>

                                        {/* Product Info */}
                                        <div className="flex-grow min-w-0">
                                            <Link
                                                href={`/product/${item.product.id}`}
                                                className="font-semibold text-gray-900 hover:text-teal-600 transition-colors line-clamp-2"
                                            >
                                                {item.product.name}
                                            </Link>
                                            {item.product.sku && (
                                                <p className="text-sm text-gray-400 mt-1">Код: {item.product.sku}</p>
                                            )}
                                            <p className="text-teal-600 font-bold text-lg mt-2">
                                                {item.product.price.toFixed(0)} грн
                                            </p>
                                        </div>

                                        {/* Quantity Controls */}
                                        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                                            <button
                                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                                className="w-10 h-10 rounded-lg hover:bg-white flex items-center justify-center transition-colors"
                                                disabled={item.quantity <= 1}
                                            >
                                                <MinusIcon className="w-4 h-4" />
                                            </button>
                                            <span className="w-12 text-center font-semibold">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                                className="w-10 h-10 rounded-lg hover:bg-white flex items-center justify-center transition-colors"
                                            >
                                                <PlusIcon className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Total & Delete */}
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900 text-lg">
                                                {(item.product.price * item.quantity).toFixed(0)} грн
                                            </p>
                                            <button
                                                onClick={() => removeFromCart(item.product.id)}
                                                className="mt-2 text-sm text-red-500 hover:text-red-700 flex items-center gap-1 ml-auto"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                                Видалити
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Clear Cart Button */}
                            <button
                                onClick={() => clearCart()}
                                className="text-gray-500 hover:text-red-600 text-sm flex items-center gap-2 transition-colors"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Очистити кошик
                            </button>
                        </div>

                        {/* Order Summary */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Підсумок замовлення</h2>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between text-gray-600">
                                        <span>Товари ({items.length})</span>
                                        <span>{totalPrice.toFixed(0)} грн</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Доставка</span>
                                        <span className="text-teal-600">Безкоштовно</span>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mb-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-semibold text-gray-900">До сплати</span>
                                        <span className="text-2xl font-bold text-teal-600">
                                            {totalPrice.toFixed(0)} грн
                                        </span>
                                    </div>
                                </div>

                                <Link
                                    href="/checkout"
                                    className="block w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-center text-lg hover:bg-teal-700 transition-colors"
                                >
                                    Оформити замовлення
                                </Link>

                                {/* Benefits */}
                                <div className="mt-6 pt-6 border-t space-y-4">
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <TruckIcon className="w-5 h-5 text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Безкоштовна доставка</p>
                                            <p className="text-gray-500">При замовленні від 1000 грн</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-gray-600">
                                        <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <ShieldCheckIcon className="w-5 h-5 text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">Гарантія якості</p>
                                            <p className="text-gray-500">14 днів на повернення</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
