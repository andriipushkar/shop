'use client'

import Link from 'next/link'
import {
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const categories = [
  { href: '/category/electronics', label: 'Електроніка' },
  { href: '/category/clothing', label: 'Одяг' },
  { href: '/category/home', label: 'Дім і сад' },
  { href: '/category/sports', label: 'Спорт' },
  { href: '/category/beauty', label: 'Краса' },
]

const customerLinks = [
  { href: '/delivery', label: 'Доставка та оплата' },
  { href: '/tracking', label: 'Відстежити посилку' },
  { href: '/returns', label: 'Повернення товару' },
  { href: '/faq', label: 'Часті питання' },
  { href: '/contact', label: 'Контакти' },
  { href: '/sale', label: 'Акції' },
]

const companyLinks = [
  { href: '/about', label: 'Про нас' },
  { href: '/contact', label: 'Контакти' },
  { href: '/faq', label: 'FAQ' },
]

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Newsletter Section */}
      <div className="bg-gradient-hero">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h3 className="text-2xl font-bold text-white mb-2">
                Підпишіться на знижки
              </h3>
              <p className="text-teal-100">
                Отримуйте ексклюзивні пропозиції та знижки до 30%
              </p>
            </div>
            <form className="flex w-full max-w-md">
              <input
                type="email"
                placeholder="Ваш email"
                className="flex-1 px-4 py-3 rounded-l-xl border-2 border-white/20 bg-white/10 text-white placeholder:text-teal-200 focus:outline-none focus:border-white/40"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-white text-teal-700 font-semibold rounded-r-xl hover:bg-teal-50 transition-colors"
              >
                Підписатися
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Company Info */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <span className="text-xl font-bold text-white">MyShop</span>
            </div>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Ваш надійний інтернет-магазин з найкращими цінами та швидкою доставкою по всій Україні.
            </p>
            {/* Social Media */}
            <div className="flex gap-3">
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-teal-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-pink-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-blue-500 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Telegram"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-gray-800 hover:bg-red-600 rounded-xl flex items-center justify-center transition-colors"
                aria-label="YouTube"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Категорії</h4>
            <ul className="space-y-3">
              {categories.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-teal-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Покупцям</h4>
            <ul className="space-y-3">
              {customerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-teal-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Компанія</h4>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-400 hover:text-teal-400 transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Контакти</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <PhoneIcon className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <a href="tel:0800123456" className="text-white font-semibold hover:text-teal-400 transition-colors">
                    0 800 123 456
                  </a>
                  <p className="text-gray-500 text-xs">Безкоштовно</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <a href="mailto:support@myshop.ua" className="text-white hover:text-teal-400 transition-colors text-sm">
                    support@myshop.ua
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">
                    м. Київ, вул. Хрещатик, 1
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-8 h-8 bg-teal-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ClockIcon className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Пн-Пт: 9:00-20:00</p>
                  <p className="text-gray-400 text-sm">Сб-Нд: 10:00-18:00</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payment & Delivery Methods */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Payment Methods */}
            <div>
              <p className="text-gray-500 text-sm mb-3">Способи оплати</p>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-2 bg-gray-800 rounded-lg flex items-center gap-2">
                  <span className="text-blue-500 font-bold text-sm">VISA</span>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg flex items-center gap-2">
                  <span className="text-orange-500 font-bold text-sm">Mastercard</span>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg flex items-center gap-2">
                  <span className="text-green-400 font-bold text-sm">LiqPay</span>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg flex items-center gap-2">
                  <span className="text-white font-bold text-sm">Monobank</span>
                </div>
                <div className="px-4 py-2 bg-gray-800 rounded-lg flex items-center gap-2">
                  <span className="text-yellow-400 font-bold text-sm">Privat24</span>
                </div>
              </div>
            </div>

            {/* Delivery Partners */}
            <div>
              <p className="text-gray-500 text-sm mb-3">Служби доставки</p>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-2 bg-red-600 rounded-lg">
                  <span className="text-white font-semibold text-sm">Нова Пошта</span>
                </div>
                <div className="px-4 py-2 bg-yellow-500 rounded-lg">
                  <span className="text-gray-900 font-semibold text-sm">Укрпошта</span>
                </div>
                <div className="px-4 py-2 bg-orange-500 rounded-lg">
                  <span className="text-white font-semibold text-sm">Meest</span>
                </div>
                <div className="px-4 py-2 bg-teal-600 rounded-lg">
                  <span className="text-white font-semibold text-sm">Самовивіз</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-gray-800 bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {currentYear} MyShop. Всі права захищено.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-teal-400 transition-colors">
                Політика конфіденційності
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-teal-400 transition-colors">
                Умови використання
              </Link>
              <Link href="/cookies" className="text-gray-500 hover:text-teal-400 transition-colors">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
