'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useWishlist } from '@/lib/wishlist-context';
import { useReviews } from '@/lib/reviews-context';
import {
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  HeartIcon,
  ShoppingBagIcon,
  StarIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  MapPinIcon,
  BellIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout, updateProfile } = useAuth();
  const { totalItems: wishlistCount } = useWishlist();
  const { getUserReviews } = useReviews();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '' });
  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'reviews'>('profile');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setEditData({ name: user.name, phone: user.phone || '' });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userReviews = getUserReviews(user.id);

  const handleSave = async () => {
    const result = await updateProfile(editData);
    if (result.success) {
      setIsEditing(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const tabs = [
    { id: 'profile', name: 'Профіль', icon: UserIcon },
    { id: 'orders', name: 'Замовлення', icon: ShoppingBagIcon },
    { id: 'reviews', name: 'Мої відгуки', icon: StarIcon },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                <p className="text-gray-600">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Вийти
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                ))}
                <Link
                  href="/wishlist"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <HeartIcon className="w-5 h-5" />
                  Список бажань
                  {wishlistCount > 0 && (
                    <span className="ml-auto bg-primary-100 text-primary-600 text-xs px-2 py-1 rounded-full">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/comparison"
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <CogIcon className="w-5 h-5" />
                  Порівняння
                </Link>
                <Link
                  href="/profile/addresses"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="w-5 h-5" />
                    Адреси доставки
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </Link>
                <Link
                  href="/profile/notifications"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <BellIcon className="w-5 h-5" />
                    Сповіщення
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </Link>
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Особисті дані</h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Редагувати
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-1 px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Зберегти
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex items-center gap-1 px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Скасувати
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <UserIcon className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Ім&apos;я</p>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                        />
                      ) : (
                        <p className="font-medium text-gray-900">{user.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Електронна пошта</p>
                      <p className="font-medium text-gray-900">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <PhoneIcon className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Телефон</p>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={editData.phone}
                          onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="+380 XX XXX XX XX"
                        />
                      ) : (
                        <p className="font-medium text-gray-900">{user.phone || 'Не вказано'}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t">
                  <p className="text-sm text-gray-500">
                    Дата реєстрації: {new Date(user.createdAt).toLocaleDateString('uk-UA')}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Мої замовлення</h2>
                  <Link
                    href="/profile/orders"
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    Переглянути всі →
                  </Link>
                </div>
                <div className="text-center py-12">
                  <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">У вас поки немає замовлень</p>
                  <Link
                    href="/"
                    className="inline-block bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
                  >
                    Перейти до покупок
                  </Link>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Мої відгуки</h2>
                {userReviews.length === 0 ? (
                  <div className="text-center py-12">
                    <StarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Ви ще не залишали відгуків</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userReviews.map((review) => (
                      <div key={review.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <StarIcon
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString('uk-UA')}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900">{review.title}</h4>
                        <p className="text-gray-600 mt-1">{review.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
