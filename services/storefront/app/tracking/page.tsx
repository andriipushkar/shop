'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trackShipment, NovaPoshtaTrackingDocument } from '@/lib/nova-poshta';
import {
  MagnifyingGlassIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  BuildingStorefrontIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
  '1': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'clock' },     // Новий
  '2': { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'truck' },         // Видалений
  '3': { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'truck' },         // Не знайдено
  '4': { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'truck' },         // У місті відправлення
  '5': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: 'truck' },     // У дорозі
  '6': { bg: 'bg-purple-100', text: 'text-purple-800', icon: 'building' },  // У місті призначення
  '7': { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: 'building' },      // На складі
  '8': { bg: 'bg-orange-100', text: 'text-orange-800', icon: 'clock' },     // Очікує отримання
  '9': { bg: 'bg-green-100', text: 'text-green-800', icon: 'check' },       // Отримано
  '10': { bg: 'bg-red-100', text: 'text-red-800', icon: 'exclamation' },    // Затримка
  '11': { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'arrow' },        // Повернення
};

function getStatusStyle(statusCode: string) {
  return statusColors[statusCode] || { bg: 'bg-gray-100', text: 'text-gray-800', icon: 'info' };
}

function StatusIcon({ type }: { type: string }) {
  switch (type) {
    case 'clock':
      return <ClockIcon className="w-5 h-5" />;
    case 'truck':
      return <TruckIcon className="w-5 h-5" />;
    case 'building':
      return <BuildingStorefrontIcon className="w-5 h-5" />;
    case 'check':
      return <CheckCircleIcon className="w-5 h-5" />;
    case 'exclamation':
      return <ExclamationCircleIcon className="w-5 h-5" />;
    case 'arrow':
      return <ArrowPathIcon className="w-5 h-5" />;
    default:
      return <InformationCircleIcon className="w-5 h-5" />;
  }
}

export default function TrackingPage() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingInfo, setTrackingInfo] = useState<NovaPoshtaTrackingDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trackingNumber.trim()) {
      setError('Введіть номер ТТН');
      return;
    }

    setIsLoading(true);
    setError('');
    setTrackingInfo(null);

    try {
      const info = await trackShipment(trackingNumber.trim());
      if (info) {
        setTrackingInfo(info);
      } else {
        setError('Відправлення не знайдено. Перевірте номер ТТН.');
      }
    } catch (err) {
      setError('Помилка при відстеженні. Спробуйте пізніше.');
      console.error('Tracking error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-teal-600 mb-4">
            <ArrowLeftIcon className="w-4 h-4" />
            На головну
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Відстеження посилки</h1>
          <p className="text-gray-500 mt-2">Введіть номер ТТН Нової Пошти для відстеження</p>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <form onSubmit={handleTrack} className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <TruckIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Номер ТТН (наприклад: 20450000000000)"
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Пошук...
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-5 h-5" />
                  Відстежити
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Tracking Results */}
        {trackingInfo && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Status Header */}
            <div className={`p-6 ${getStatusStyle(trackingInfo.StatusCode).bg}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full bg-white ${getStatusStyle(trackingInfo.StatusCode).text}`}>
                  <StatusIcon type={getStatusStyle(trackingInfo.StatusCode).icon} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${getStatusStyle(trackingInfo.StatusCode).text}`}>
                    {trackingInfo.Status}
                  </h2>
                  <p className="text-sm opacity-80">{trackingInfo.Number}</p>
                </div>
              </div>
            </div>

            {/* Shipment Details */}
            <div className="p-6 space-y-6">
              {/* Route */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                    <MapPinIcon className="w-4 h-4" />
                    Відправлення
                  </div>
                  <p className="font-semibold text-gray-900">{trackingInfo.CitySender}</p>
                  {trackingInfo.CounterpartySenderDescription && (
                    <p className="text-sm text-gray-500">{trackingInfo.CounterpartySenderDescription}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <div className="w-12 h-0.5 bg-gray-300 relative">
                    <TruckIcon className="w-6 h-6 text-teal-600 absolute -top-3 left-1/2 -translate-x-1/2 bg-white" />
                  </div>
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2 text-gray-500 text-sm mb-1">
                    <MapPinIcon className="w-4 h-4" />
                    Отримання
                  </div>
                  <p className="font-semibold text-gray-900">{trackingInfo.CityRecipient}</p>
                  {trackingInfo.WarehouseRecipient && (
                    <p className="text-sm text-gray-500">{trackingInfo.WarehouseRecipient}</p>
                  )}
                </div>
              </div>

              {/* Additional Info */}
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                {trackingInfo.RecipientDateTime && (
                  <div>
                    <p className="text-sm text-gray-500">Дата отримання</p>
                    <p className="font-medium text-gray-900">{trackingInfo.RecipientDateTime}</p>
                  </div>
                )}
                {trackingInfo.ScheduledDeliveryDate && !trackingInfo.RecipientDateTime && (
                  <div>
                    <p className="text-sm text-gray-500">Очікувана дата доставки</p>
                    <p className="font-medium text-gray-900">{trackingInfo.ScheduledDeliveryDate}</p>
                  </div>
                )}
                {trackingInfo.DocumentCost && (
                  <div>
                    <p className="text-sm text-gray-500">Оголошена вартість</p>
                    <p className="font-medium text-gray-900">{trackingInfo.DocumentCost} грн</p>
                  </div>
                )}
                {trackingInfo.DocumentWeight && (
                  <div>
                    <p className="text-sm text-gray-500">Вага</p>
                    <p className="font-medium text-gray-900">{trackingInfo.DocumentWeight} кг</p>
                  </div>
                )}
                {trackingInfo.CargoDescriptionString && (
                  <div>
                    <p className="text-sm text-gray-500">Опис вантажу</p>
                    <p className="font-medium text-gray-900">{trackingInfo.CargoDescriptionString}</p>
                  </div>
                )}
              </div>

              {/* Status Timeline */}
              {trackingInfo.DateScan && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ClockIcon className="w-4 h-4" />
                    Останнє оновлення: {trackingInfo.DateScan}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Корисна інформація</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Де знайти номер ТТН?</strong> Номер ТТН (товарно-транспортна накладна)
              складається з 14 цифр і вказується у SMS-повідомленні або листі про відправку.
            </p>
            <p>
              <strong>Статуси посилки:</strong>
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
                <span>Новий - посилка прийнята до відправки</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                <span>У дорозі - посилка рухається до пункту призначення</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400"></span>
                <span>На складі - посилка прибула до відділення</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400"></span>
                <span>Отримано - посилку успішно доставлено</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          <Link
            href="/orders"
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Мої замовлення
          </Link>
          <span className="text-gray-300">|</span>
          <a
            href="https://novaposhta.ua/tracking/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Офіційний трекінг Нової Пошти
          </a>
        </div>
      </div>
    </main>
  );
}
