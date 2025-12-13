'use client';

import { useState } from 'react';
import { usePWA } from '@/lib/hooks/usePWA';
import {
  BellIcon,
  ArrowDownTrayIcon,
  WifiIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { clearAllCaches, getStorageEstimate, formatStorageSize } from '@/lib/pwa/pwa-utils';
import { clearAllOfflineData } from '@/lib/pwa/offline-storage';

export default function PWASettings() {
  const {
    isInstalled,
    canInstall,
    install,
    online,
    connectionType,
    slowConnection,
    notificationPermission,
    requestNotifications,
    subscribePush,
    syncData,
  } = usePWA();

  const [storageUsage, setStorageUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleInstall = async () => {
    const result = await install();
    if (result === 'accepted') {
      alert('Додаток успішно встановлено!');
    }
  };

  const handleEnableNotifications = async () => {
    const permission = await requestNotifications();

    if (permission === 'granted') {
      await subscribePush();
      alert('Сповіщення увімкнено!');
    } else {
      alert('Сповіщення заблоковано');
    }
  };

  const handleSync = async () => {
    setLoading(true);
    try {
      await syncData('sync-all');
      alert('Синхронізація запущена!');
    } catch (error) {
      alert('Помилка синхронізації');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Ви впевнені, що хочете очистити весь кеш?')) {
      return;
    }

    setLoading(true);
    try {
      await clearAllCaches();
      await clearAllOfflineData();
      alert('Кеш очищено!');
    } catch (error) {
      alert('Помилка очищення кешу');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStorage = async () => {
    const estimate = await getStorageEstimate();
    if (estimate && estimate.usage !== undefined && estimate.quota !== undefined) {
      setStorageUsage({
        usage: estimate.usage,
        quota: estimate.quota,
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Налаштування PWA</h2>

      <div className="space-y-6">
        {/* Installation Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <ArrowDownTrayIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Встановлення</h3>
              <p className="text-sm text-gray-500">
                {isInstalled ? 'Додаток встановлено' : 'Додаток не встановлено'}
              </p>
            </div>
          </div>
          {isInstalled ? (
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          ) : canInstall ? (
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Встановити
            </button>
          ) : (
            <XCircleIcon className="w-6 h-6 text-gray-400" />
          )}
        </div>

        {/* Network Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <WifiIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">З'єднання</h3>
              <p className="text-sm text-gray-500">
                {online ? `Онлайн (${connectionType})` : 'Офлайн'}
              </p>
              {slowConnection && (
                <p className="text-xs text-amber-600">Повільне з'єднання</p>
              )}
            </div>
          </div>
          {online ? (
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          ) : (
            <XCircleIcon className="w-6 h-6 text-red-600" />
          )}
        </div>

        {/* Notifications */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <BellIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Сповіщення</h3>
              <p className="text-sm text-gray-500">
                {notificationPermission === 'granted'
                  ? 'Увімкнено'
                  : notificationPermission === 'denied'
                  ? 'Заблоковано'
                  : 'Вимкнено'}
              </p>
            </div>
          </div>
          {notificationPermission === 'granted' ? (
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          ) : notificationPermission === 'denied' ? (
            <XCircleIcon className="w-6 h-6 text-red-600" />
          ) : (
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              Увімкнути
            </button>
          )}
        </div>

        {/* Sync */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <CloudArrowUpIcon className="w-6 h-6 text-gray-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Синхронізація</h3>
              <p className="text-sm text-gray-500">
                Синхронізувати офлайн дані
              </p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={!online || loading}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Синхронізація...' : 'Синхронізувати'}
          </button>
        </div>

        {/* Storage */}
        {storageUsage && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Використання сховища</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Використано:</span>
                <span className="font-medium">
                  {formatStorageSize(storageUsage.usage)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Доступно:</span>
                <span className="font-medium">
                  {formatStorageSize(storageUsage.quota)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-teal-600 h-2 rounded-full"
                  style={{
                    width: `${(storageUsage.usage / storageUsage.quota) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCheckStorage}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Перевірити сховище
          </button>
          <button
            onClick={handleClearCache}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Очищення...' : 'Очистити кеш'}
          </button>
        </div>
      </div>
    </div>
  );
}
