'use client';

import Link from 'next/link';
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ExclamationTriangleIcon,
  MapIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
  CubeIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

interface AnalyticsModule {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  stats?: string;
}

const analyticsModules: AnalyticsModule[] = [
  {
    id: 'forecast',
    title: 'Прогнозування попиту',
    description: 'AI-аналітика продажів, прогноз попиту на основі історичних даних, сезонність та тренди',
    href: '/admin/warehouse/analytics/forecast',
    icon: ArrowTrendingUpIcon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    stats: '30 днів вперед',
  },
  {
    id: 'reorder',
    title: 'Точки перезамовлення',
    description: 'Автоматичний розрахунок ROP, страхового запасу та оптимального часу замовлення',
    href: '/admin/warehouse/analytics/reorder',
    icon: BellAlertIcon,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    stats: '12 критичних',
  },
  {
    id: 'anomalies',
    title: 'Виявлення аномалій',
    description: 'Автоматичне виявлення спайків продажів, падінь та незвичайної активності',
    href: '/admin/warehouse/analytics/anomalies',
    icon: ExclamationTriangleIcon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    stats: '3 аномалії',
  },
  {
    id: 'zones',
    title: 'ABC-XYZ та Зони складу',
    description: 'Класифікація товарів за оборотністю, Hot/Cold зони для оптимізації розміщення',
    href: '/admin/warehouse/analytics/zones',
    icon: MapIcon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    stats: '9 категорій',
  },
  {
    id: 'wave-picking',
    title: 'Wave Picking',
    description: 'Оптимізація збору замовлень, групування за зонами, S-подібний маршрут',
    href: '/admin/warehouse/analytics/wave-picking',
    icon: ArrowPathIcon,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    stats: 'Батчі замовлень',
  },
  {
    id: 'ship-from-store',
    title: 'Ship-from-Store',
    description: 'Оптимальний вибір джерела відвантаження на основі наявності, відстані та вартості',
    href: '/admin/warehouse/analytics/ship-from-store',
    icon: BuildingStorefrontIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    stats: '5 локацій',
  },
];

// Швидка статистика
const quickStats = [
  { label: 'Загальна вартість запасів', value: '₴12.4M', change: '+5.2%', positive: true },
  { label: 'Середній оборот', value: '18 днів', change: '-2 дні', positive: true },
  { label: 'Критичні позиції', value: '47', change: '+12', positive: false },
  { label: 'Точність прогнозу', value: '94%', change: '+2%', positive: true },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Аналітика складу</h1>
          <p className="text-gray-600">Інтелектуальний аналіз запасів та оптимізація процесів</p>
        </div>
        <Link
          href="/admin/warehouse"
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Назад до складу
        </Link>
      </div>

      {/* Швидка статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
          >
            <div className="text-sm text-gray-600 mb-1">{stat.label}</div>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div
                className={`text-sm font-medium ${
                  stat.positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Модулі аналітики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {analyticsModules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.id}
              href={module.href}
              className="group bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${module.bgColor}`}>
                  <Icon className={`w-6 h-6 ${module.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                  {module.stats && (
                    <div className="mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {module.stats}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Інформаційний блок */}
      <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <ChartBarIcon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Інтелектуальна аналітика</h3>
            <p className="text-teal-100 mt-1">
              Використовуйте AI-powered інструменти для прогнозування попиту,
              виявлення аномалій та оптимізації складських процесів
            </p>
          </div>
          <Link
            href="/admin/warehouse/analytics/forecast"
            className="px-4 py-2 bg-white text-teal-600 rounded-lg font-medium hover:bg-teal-50 transition-colors"
          >
            Почати аналіз
          </Link>
        </div>
      </div>

      {/* Останні інсайти */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Останні інсайти</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                iPhone 15 Pro - критичний рівень запасу
              </div>
              <div className="text-xs text-gray-600">Залишилось на 5 днів продажів</div>
            </div>
            <Link
              href="/admin/warehouse/analytics/reorder"
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Деталі →
            </Link>
          </div>
          <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
            <ArrowTrendingUpIcon className="w-5 h-5 text-yellow-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Спайк продажів AirPods Pro
              </div>
              <div className="text-xs text-gray-600">+340% за останній тиждень</div>
            </div>
            <Link
              href="/admin/warehouse/analytics/anomalies"
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Деталі →
            </Link>
          </div>
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <CubeIcon className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Рекомендація: перемістити товари в Hot-зону
              </div>
              <div className="text-xs text-gray-600">15 товарів з високим оборотом</div>
            </div>
            <Link
              href="/admin/warehouse/analytics/zones"
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              Деталі →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
