/**
 * B2B Portal Layout
 * Макет для B2B порталу
 */

import Link from 'next/link';

export default function B2BLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* B2B Navigation */}
      <nav className="bg-blue-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/b2b" className="text-2xl font-bold">
                B2B Portal
              </Link>
              <div className="flex space-x-4">
                <Link
                  href="/b2b"
                  className="px-4 py-2 rounded hover:bg-blue-800 transition"
                >
                  Головна
                </Link>
                <Link
                  href="/b2b/quick-order"
                  className="px-4 py-2 rounded hover:bg-blue-800 transition"
                >
                  Швидке замовлення
                </Link>
                <Link
                  href="/b2b/account"
                  className="px-4 py-2 rounded hover:bg-blue-800 transition"
                >
                  Особистий кабінет
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <div className="font-semibold">ТОВ "Компанія"</div>
                <div className="text-blue-200">Менеджер: Іван Петренко</div>
              </div>
              <Link
                href="/auth/signout"
                className="px-4 py-2 bg-blue-800 rounded hover:bg-blue-700 transition"
              >
                Вийти
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Контакти</h3>
              <p className="text-gray-300">Телефон: +380 44 123 45 67</p>
              <p className="text-gray-300">Email: b2b@example.com</p>
              <p className="text-gray-300">Пн-Пт: 9:00 - 18:00</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Корисні посилання</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/b2b/price-list" className="hover:text-white">Прайс-листи</Link></li>
                <li><Link href="/b2b/terms" className="hover:text-white">Умови співпраці</Link></li>
                <li><Link href="/b2b/delivery" className="hover:text-white">Доставка</Link></li>
                <li><Link href="/b2b/support" className="hover:text-white">Підтримка</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Документи</h3>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/b2b/contract" className="hover:text-white">Договір</Link></li>
                <li><Link href="/b2b/documents" className="hover:text-white">Документи</Link></li>
                <li><Link href="/b2b/reports" className="hover:text-white">Звіти</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 B2B Portal. Всі права захищені.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
