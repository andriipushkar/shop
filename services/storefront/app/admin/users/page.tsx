'use client';

import { useState } from 'react';
import {
    UserGroupIcon,
    PlusIcon,
    MagnifyingGlassIcon,
    PencilSquareIcon,
    TrashIcon,
    ShieldCheckIcon,
    ShieldExclamationIcon,
    KeyIcon,
    EnvelopeIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';

type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'content_manager';
type UserStatus = 'active' | 'inactive' | 'blocked';

interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    lastLogin: string;
    createdAt: string;
    permissions: string[];
    avatar?: string;
}

const roleLabels: Record<UserRole, string> = {
    super_admin: 'Супер-адмін',
    admin: 'Адміністратор',
    manager: 'Менеджер',
    operator: 'Оператор',
    content_manager: 'Контент-менеджер',
};

const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin: 'bg-red-100 text-red-800',
    manager: 'bg-blue-100 text-blue-800',
    operator: 'bg-green-100 text-green-800',
    content_manager: 'bg-orange-100 text-orange-800',
};

const statusLabels: Record<UserStatus, string> = {
    active: 'Активний',
    inactive: 'Неактивний',
    blocked: 'Заблокований',
};

const statusColors: Record<UserStatus, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    blocked: 'bg-red-100 text-red-800',
};

const allPermissions = [
    { id: 'products', name: 'Товари', description: 'Управління товарами' },
    { id: 'orders', name: 'Замовлення', description: 'Перегляд та управління замовленнями' },
    { id: 'customers', name: 'Клієнти', description: 'Управління клієнтами' },
    { id: 'categories', name: 'Категорії', description: 'Управління категоріями' },
    { id: 'promo', name: 'Промокоди', description: 'Управління знижками та акціями' },
    { id: 'reviews', name: 'Відгуки', description: 'Модерація відгуків' },
    { id: 'content', name: 'Контент', description: 'Управління сторінками та банерами' },
    { id: 'support', name: 'Підтримка', description: 'Обробка звернень клієнтів' },
    { id: 'import', name: 'Імпорт', description: 'Імпорт даних' },
    { id: 'integrations', name: 'Маркетплейси', description: 'Інтеграції з маркетплейсами' },
    { id: 'reports', name: 'Звіти', description: 'Перегляд звітів' },
    { id: 'analytics', name: 'Аналітика', description: 'Перегляд аналітики' },
    { id: 'users', name: 'Користувачі', description: 'Управління адміністраторами' },
    { id: 'settings', name: 'Налаштування', description: 'Налаштування магазину' },
];

const users: AdminUser[] = [
    {
        id: 1,
        name: 'Олександр Петренко',
        email: 'admin@myshop.ua',
        role: 'super_admin',
        status: 'active',
        lastLogin: '10.12.2024 14:30',
        createdAt: '01.01.2024',
        permissions: allPermissions.map(p => p.id),
    },
    {
        id: 2,
        name: 'Марія Коваленко',
        email: 'maria@myshop.ua',
        role: 'admin',
        status: 'active',
        lastLogin: '10.12.2024 12:15',
        createdAt: '15.02.2024',
        permissions: ['products', 'orders', 'customers', 'categories', 'promo', 'reviews', 'reports', 'analytics'],
    },
    {
        id: 3,
        name: 'Іван Сидоренко',
        email: 'ivan@myshop.ua',
        role: 'manager',
        status: 'active',
        lastLogin: '10.12.2024 09:45',
        createdAt: '01.03.2024',
        permissions: ['products', 'orders', 'customers', 'categories'],
    },
    {
        id: 4,
        name: 'Анна Мельник',
        email: 'anna@myshop.ua',
        role: 'operator',
        status: 'active',
        lastLogin: '09.12.2024 18:20',
        createdAt: '10.04.2024',
        permissions: ['orders', 'customers', 'support'],
    },
    {
        id: 5,
        name: 'Дмитро Бондаренко',
        email: 'dmitro@myshop.ua',
        role: 'content_manager',
        status: 'active',
        lastLogin: '08.12.2024 16:00',
        createdAt: '20.05.2024',
        permissions: ['content', 'reviews'],
    },
    {
        id: 6,
        name: 'Тетяна Шевченко',
        email: 'tetiana@myshop.ua',
        role: 'operator',
        status: 'inactive',
        lastLogin: '01.11.2024 10:00',
        createdAt: '01.06.2024',
        permissions: ['orders', 'customers'],
    },
    {
        id: 7,
        name: 'Сергій Козак',
        email: 'sergiy@myshop.ua',
        role: 'manager',
        status: 'blocked',
        lastLogin: '15.10.2024 12:00',
        createdAt: '15.07.2024',
        permissions: ['products', 'orders'],
    },
];

export default function AdminUsersPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
    const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = filterRole === 'all' || user.role === filterRole;
        const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
        return matchesSearch && matchesRole && matchesStatus;
    });

    const stats = {
        total: users.length,
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        blocked: users.filter(u => u.status === 'blocked').length,
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Користувачі</h1>
                    <p className="text-gray-600">Управління адміністраторами та правами доступу</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати користувача
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <UserGroupIcon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
                            <p className="text-sm text-gray-500">Активні</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <ClockIcon className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.inactive}</p>
                            <p className="text-sm text-gray-500">Неактивні</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <XCircleIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.blocked}</p>
                            <p className="text-sm text-gray-500">Заблоковані</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за ім'ям або email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі ролі</option>
                        {Object.entries(roleLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as UserStatus | 'all')}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі статуси</option>
                        {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Користувач</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Останній вхід</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Права</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Дії</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                                                <span className="text-white font-medium">
                                                    {user.name.split(' ').map(n => n[0]).join('')}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{user.name}</p>
                                                <p className="text-sm text-gray-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                                            {user.role === 'super_admin' && <ShieldCheckIcon className="w-3.5 h-3.5" />}
                                            {user.role === 'admin' && <ShieldExclamationIcon className="w-3.5 h-3.5" />}
                                            {roleLabels[user.role]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[user.status]}`}>
                                            {statusLabels[user.status]}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {user.lastLogin}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => {
                                                setSelectedUser(user);
                                                setShowPermissionsModal(true);
                                            }}
                                            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                                        >
                                            {user.permissions.length} прав
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setShowEditModal(true);
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Редагувати"
                                            >
                                                <PencilSquareIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Скинути пароль"
                                            >
                                                <KeyIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Надіслати email"
                                            >
                                                <EnvelopeIcon className="w-5 h-5" />
                                            </button>
                                            {user.role !== 'super_admin' && (
                                                <button
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="Видалити"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">Користувачів не знайдено</p>
                    </div>
                )}
            </div>

            {/* Roles description */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Опис ролей</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
                            <span className="font-medium text-purple-800">Супер-адмін</span>
                        </div>
                        <p className="text-sm text-purple-700">Повний доступ до всіх функцій системи. Може керувати іншими адміністраторами.</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <ShieldExclamationIcon className="w-5 h-5 text-red-600" />
                            <span className="font-medium text-red-800">Адміністратор</span>
                        </div>
                        <p className="text-sm text-red-700">Розширений доступ до управління магазином. Не може керувати іншими адмінами.</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-blue-800">Менеджер</span>
                        </div>
                        <p className="text-sm text-blue-700">Управління товарами, замовленнями та категоріями. Обмежений доступ до налаштувань.</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-green-800">Оператор</span>
                        </div>
                        <p className="text-sm text-green-700">Обробка замовлень та підтримка клієнтів. Базовий рівень доступу.</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-orange-800">Контент-менеджер</span>
                        </div>
                        <p className="text-sm text-orange-700">Управління контентом сайту: сторінки, банери, FAQ, модерація відгуків.</p>
                    </div>
                </div>
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Додати користувача</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ім&apos;я</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Введіть повне ім'я"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        {Object.entries(roleLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Введіть пароль"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Права доступу</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                        {allPermissions.map((perm) => (
                                            <label key={perm.id} className="flex items-center gap-2">
                                                <input type="checkbox" className="rounded text-teal-600 focus:ring-teal-500" />
                                                <span className="text-sm text-gray-700">{perm.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Створити
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && editingUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowEditModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Редагувати: {editingUser.name}</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ім&apos;я</label>
                                    <input
                                        type="text"
                                        defaultValue={editingUser.name}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        defaultValue={editingUser.email}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
                                    <select
                                        defaultValue={editingUser.role}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        disabled={editingUser.role === 'super_admin'}
                                    >
                                        {Object.entries(roleLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
                                    <select
                                        defaultValue={editingUser.status}
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        disabled={editingUser.role === 'super_admin'}
                                    >
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Права доступу</label>
                                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                        {allPermissions.map((perm) => (
                                            <label key={perm.id} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    defaultChecked={editingUser.permissions.includes(perm.id)}
                                                    disabled={editingUser.role === 'super_admin'}
                                                    className="rounded text-teal-600 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-gray-700">{perm.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Зберегти
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Permissions Modal */}
            {showPermissionsModal && selectedUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowPermissionsModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Права доступу</h3>
                            <p className="text-gray-500 mb-4">{selectedUser.name}</p>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {allPermissions.map((perm) => (
                                    <div
                                        key={perm.id}
                                        className={`flex items-center justify-between p-3 rounded-lg ${
                                            selectedUser.permissions.includes(perm.id) ? 'bg-green-50' : 'bg-gray-50'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{perm.name}</p>
                                            <p className="text-sm text-gray-500">{perm.description}</p>
                                        </div>
                                        {selectedUser.permissions.includes(perm.id) ? (
                                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <XCircleIcon className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowPermissionsModal(false)}
                                className="w-full mt-4 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Закрити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
