'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Squares2X2Icon,
    ShoppingBagIcon,
    ClipboardDocumentListIcon,
    UsersIcon,
    TagIcon,
    TicketIcon,
    Cog6ToothIcon,
    ChartBarIcon,
    Bars3Icon,
    XMarkIcon,
    ArrowLeftOnRectangleIcon,
    BellIcon,
    MagnifyingGlassIcon,
    CloudArrowUpIcon,
    DocumentChartBarIcon,
    GlobeAltIcon,
    StarIcon,
    DocumentTextIcon,
    ChatBubbleLeftRightIcon,
    UserGroupIcon,
    BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

const navigation = [
    { name: 'Дашборд', href: '/admin', icon: Squares2X2Icon },
    { name: 'Товари', href: '/admin/products', icon: ShoppingBagIcon },
    { name: 'Замовлення', href: '/admin/orders', icon: ClipboardDocumentListIcon },
    { name: 'Склад', href: '/admin/warehouse', icon: BuildingStorefrontIcon },
    { name: 'Клієнти', href: '/admin/customers', icon: UsersIcon },
    { name: 'Категорії', href: '/admin/categories', icon: TagIcon },
    { name: 'Промокоди', href: '/admin/promo', icon: TicketIcon },
    { name: 'Відгуки', href: '/admin/reviews', icon: StarIcon },
    { name: 'Контент', href: '/admin/content', icon: DocumentTextIcon },
    { name: 'Підтримка', href: '/admin/support', icon: ChatBubbleLeftRightIcon },
    { name: 'Імпорт', href: '/admin/import', icon: CloudArrowUpIcon },
    { name: 'Маркетплейси', href: '/admin/integrations', icon: GlobeAltIcon },
    { name: 'Звіти', href: '/admin/reports', icon: DocumentChartBarIcon },
    { name: 'Аналітика', href: '/admin/analytics', icon: ChartBarIcon },
    { name: 'Користувачі', href: '/admin/users', icon: UserGroupIcon },
    { name: 'Налаштування', href: '/admin/settings', icon: Cog6ToothIcon },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 transform transition-transform duration-200 lg:translate-x-0 ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-4 bg-gray-800">
                        <Link href="/admin" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">M</span>
                            </div>
                            <span className="text-white font-semibold text-lg">MyShop Admin</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden text-gray-400 hover:text-white"
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/admin' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                        isActive
                                            ? 'bg-teal-600 text-white'
                                            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    }`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-gray-800">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium">А</span>
                            </div>
                            <div>
                                <p className="text-white text-sm font-medium">Адміністратор</p>
                                <p className="text-gray-400 text-xs">admin@myshop.ua</p>
                            </div>
                        </div>
                        <Link
                            href="/"
                            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
                        >
                            <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                            До магазину
                        </Link>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="lg:pl-64">
                {/* Top bar */}
                <header className="sticky top-0 z-30 bg-white shadow-sm">
                    <div className="flex items-center justify-between h-16 px-4 lg:px-6">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className="lg:hidden text-gray-600 hover:text-gray-900"
                            >
                                <Bars3Icon className="w-6 h-6" />
                            </button>

                            {/* Search */}
                            <div className="hidden md:block relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Пошук..."
                                    className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Notifications */}
                            <button className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                                <BellIcon className="w-6 h-6" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            </button>

                            {/* User menu */}
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:block text-right">
                                    <p className="text-sm font-medium text-gray-900">Адміністратор</p>
                                    <p className="text-xs text-gray-500">Супер-адмін</p>
                                </div>
                                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                                    <span className="text-white font-medium">А</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
