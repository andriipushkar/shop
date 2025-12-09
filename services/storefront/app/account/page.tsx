'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  UserIcon,
  MapPinIcon,
  ShoppingBagIcon,
  HeartIcon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

type TabType = 'profile' | 'addresses' | 'orders' | 'wishlist' | 'payment' | 'notifications' | 'security'

// Mock user data
const mockUser = {
  id: '1',
  firstName: 'Олександр',
  lastName: 'Петренко',
  email: 'oleksandr@example.com',
  phone: '+380 67 123 4567',
  avatar: null,
  createdAt: '2024-01-15',
}

// Mock addresses
const mockAddresses = [
  {
    id: '1',
    name: 'Домашня',
    recipient: 'Олександр Петренко',
    phone: '+380 67 123 4567',
    city: 'Київ',
    address: 'вул. Хрещатик, 1, кв. 10',
    postalCode: '01001',
    isDefault: true,
  },
  {
    id: '2',
    name: 'Робоча',
    recipient: 'Олександр Петренко',
    phone: '+380 67 123 4567',
    city: 'Київ',
    address: 'вул. Грушевського, 5, офіс 100',
    postalCode: '01008',
    isDefault: false,
  },
]

// Mock orders
const mockOrders = [
  {
    id: 'ORD-2024-001',
    date: '2024-12-01',
    status: 'delivered',
    total: 54999,
    items: 1,
  },
  {
    id: 'ORD-2024-002',
    date: '2024-11-28',
    status: 'shipped',
    total: 8299,
    items: 2,
  },
  {
    id: 'ORD-2024-003',
    date: '2024-11-20',
    status: 'processing',
    total: 24999,
    items: 1,
  },
]

// Mock wishlist
const mockWishlist = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    price: 54999,
    image: '/products/iphone-1.jpg',
    inStock: true,
  },
  {
    id: '2',
    name: 'MacBook Pro 14"',
    price: 89999,
    image: '/products/macbook-1.jpg',
    inStock: true,
  },
  {
    id: '3',
    name: 'AirPods Pro 2',
    price: 9999,
    image: '/products/airpods-1.jpg',
    inStock: false,
  },
]

const statusLabels: Record<string, { text: string; color: string }> = {
  pending: { text: 'Очікує', color: 'bg-yellow-100 text-yellow-800' },
  processing: { text: 'Обробляється', color: 'bg-blue-100 text-blue-800' },
  shipped: { text: 'Відправлено', color: 'bg-purple-100 text-purple-800' },
  delivered: { text: 'Доставлено', color: 'bg-green-100 text-green-800' },
  cancelled: { text: 'Скасовано', color: 'bg-red-100 text-red-800' },
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [user, setUser] = useState(mockUser)
  const [isEditing, setIsEditing] = useState(false)

  const tabs = [
    { id: 'profile' as TabType, name: 'Профіль', icon: UserIcon },
    { id: 'addresses' as TabType, name: 'Адреси', icon: MapPinIcon },
    { id: 'orders' as TabType, name: 'Замовлення', icon: ShoppingBagIcon },
    { id: 'wishlist' as TabType, name: 'Список бажань', icon: HeartIcon },
    { id: 'payment' as TabType, name: 'Оплата', icon: CreditCardIcon },
    { id: 'notifications' as TabType, name: 'Сповіщення', icon: BellIcon },
    { id: 'security' as TabType, name: 'Безпека', icon: ShieldCheckIcon },
  ]

  const handleSaveProfile = () => {
    setIsEditing(false)
    // Save to API
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <nav className="bg-white rounded-xl shadow-sm overflow-hidden">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  <span>{tab.name}</span>
                </button>
              ))}
              <button
                className="w-full flex items-center space-x-3 px-4 py-3 text-left text-red-600 hover:bg-red-50 border-t"
              >
                <ArrowRightOnRectangleIcon className="w-5 h-5" />
                <span>Вийти</span>
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Особисті дані</h2>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center space-x-2 text-primary-600 hover:text-primary-700"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span>Редагувати</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ім'я</label>
                      <input
                        type="text"
                        value={user.firstName}
                        onChange={(e) => setUser({ ...user, firstName: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Прізвище</label>
                      <input
                        type="text"
                        value={user.lastName}
                        onChange={(e) => setUser({ ...user, lastName: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={user.email}
                        onChange={(e) => setUser({ ...user, email: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                      <input
                        type="tel"
                        value={user.phone}
                        onChange={(e) => setUser({ ...user, phone: e.target.value })}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        Скасувати
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                      >
                        Зберегти
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Addresses Tab */}
              {activeTab === 'addresses' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Адреси доставки</h2>
                    <button className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                      <PlusIcon className="w-4 h-4" />
                      <span>Додати адресу</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {mockAddresses.map((address) => (
                      <div
                        key={address.id}
                        className={`p-4 border rounded-lg ${
                          address.isDefault ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="font-medium text-gray-900">{address.name}</span>
                              {address.isDefault && (
                                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                                  За замовчуванням
                                </span>
                              )}
                            </div>
                            <p className="text-gray-700">{address.recipient}</p>
                            <p className="text-gray-500">{address.phone}</p>
                            <p className="text-gray-500 mt-1">
                              {address.city}, {address.address}, {address.postalCode}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button className="p-2 text-gray-400 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Tab */}
              {activeTab === 'orders' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Мої замовлення</h2>

                  <div className="space-y-4">
                    {mockOrders.map((order) => (
                      <div key={order.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center space-x-3">
                              <span className="font-medium text-gray-900">{order.id}</span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusLabels[order.status].color}`}>
                                {statusLabels[order.status].text}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(order.date).toLocaleDateString('uk-UA')} • {order.items} товар(ів)
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="font-bold text-gray-900">
                              {order.total.toLocaleString()} ₴
                            </span>
                            <Link
                              href={`/orders/${order.id}`}
                              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                            >
                              Деталі
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-center">
                    <Link
                      href="/orders"
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      Переглянути всі замовлення
                    </Link>
                  </div>
                </div>
              )}

              {/* Wishlist Tab */}
              {activeTab === 'wishlist' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">
                    Список бажань ({mockWishlist.length})
                  </h2>

                  <div className="space-y-4">
                    {mockWishlist.map((item) => (
                      <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                          <span className="text-gray-400 text-xs">Фото</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{item.name}</h3>
                          <p className="text-lg font-bold text-gray-900 mt-1">
                            {item.price.toLocaleString()} ₴
                          </p>
                          <p className={`text-sm mt-1 ${item.inStock ? 'text-green-600' : 'text-red-500'}`}>
                            {item.inStock ? 'В наявності' : 'Немає в наявності'}
                          </p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            disabled={!item.inStock}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                          >
                            В кошик
                          </button>
                          <button className="p-2 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-5 h-5 mx-auto" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Tab */}
              {activeTab === 'payment' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Способи оплати</h2>
                    <button className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                      <PlusIcon className="w-4 h-4" />
                      <span>Додати картку</span>
                    </button>
                  </div>

                  <div className="text-center py-12 text-gray-500">
                    <CreditCardIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>У вас ще немає збережених карток</p>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Сповіщення</h2>

                  <div className="space-y-4">
                    {[
                      { id: 'orders', label: 'Статус замовлень', desc: 'Отримувати повідомлення про зміну статусу замовлень', enabled: true },
                      { id: 'promo', label: 'Акції та знижки', desc: 'Отримувати інформацію про спеціальні пропозиції', enabled: true },
                      { id: 'stock', label: 'Наявність товару', desc: 'Сповіщення про появу товару зі списку бажань', enabled: false },
                      { id: 'news', label: 'Новини магазину', desc: 'Розсилка новин та оновлень', enabled: false },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            defaultChecked={item.enabled}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Tab */}
              {activeTab === 'security' && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Безпека</h2>

                  <div className="space-y-6">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">Змінити пароль</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Для зміни пароля вам потрібно ввести поточний пароль
                      </p>
                      <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                        Змінити пароль
                      </button>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">Двофакторна автентифікація</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Додатковий рівень захисту для вашого акаунту
                      </p>
                      <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        Увімкнути 2FA
                      </button>
                    </div>

                    <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                      <h3 className="font-medium text-red-800 mb-2">Видалити акаунт</h3>
                      <p className="text-sm text-red-600 mb-4">
                        Ця дія незворотня. Всі ваші дані будуть видалені.
                      </p>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Видалити акаунт
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
