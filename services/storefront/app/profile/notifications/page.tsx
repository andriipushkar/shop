import Link from 'next/link';
import NotificationPreferences from '@/components/NotificationPreferences';

export default function NotificationsPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <nav className="text-sm text-gray-500 mb-2">
                        <Link href="/" className="hover:text-blue-600">Головна</Link>
                        <span className="mx-2">/</span>
                        <Link href="/profile" className="hover:text-blue-600">Профіль</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">Налаштування сповіщень</span>
                    </nav>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Налаштування сповіщень</h1>
                    <p className="text-gray-600">Керуйте тим, як ви отримуєте сповіщення про замовлення, акції та інші події</p>
                </div>

                {/* Notification Preferences Component */}
                <NotificationPreferences />
            </div>
        </div>
    );
}
