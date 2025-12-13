'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, DevicePhoneMobileIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { BeforeInstallPromptEvent, showInstallPrompt, isPWAInstalled, isIOS, getPlatform } from '@/lib/pwa/pwa-utils';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // Check if already installed
    if (isPWAInstalled()) {
      setInstalled(true);
      return;
    }

    // Check if previously dismissed
    const isDismissed = localStorage.getItem('pwa-install-dismissed');
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // Get platform
    const currentPlatform = getPlatform();
    setPlatform(currentPlatform);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after 3 seconds delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setShowPrompt(false);
      console.log('[PWA] App installed');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    const result = await showInstallPrompt(deferredPrompt);

    if (result === 'accepted') {
      setShowPrompt(false);
      setInstalled(true);
    } else {
      handleDismiss();
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (installed || dismissed || !showPrompt) {
    return null;
  }

  // iOS install instructions
  if (platform === 'ios') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-teal-600 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center mb-2">
                <DevicePhoneMobileIcon className="w-6 h-6 mr-2" />
                <h3 className="font-semibold text-lg">Встановити TechShop</h3>
              </div>
              <p className="text-sm mb-3">
                Додайте додаток на головний екран для швидкого доступу та роботи без інтернету
              </p>
              <div className="text-sm space-y-2">
                <p className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Працює без інтернету
                </p>
                <p className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Швидкий доступ з головного екрану
                </p>
                <p className="flex items-center">
                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                  Повноекранний режим
                </p>
              </div>
              <div className="mt-3 p-3 bg-teal-700 rounded-lg text-sm">
                <p className="font-semibold mb-1">Як встановити:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Натисніть на кнопку "Поділитися" внизу екрану</li>
                  <li>Прокрутіть і виберіть "На екран Домой"</li>
                  <li>Натисніть "Додати"</li>
                </ol>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white hover:text-teal-100 transition-colors"
              aria-label="Закрити"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop install prompt
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          <div className="flex items-center mb-2">
            <ArrowDownTrayIcon className="w-6 h-6 text-teal-600 mr-2" />
            <h3 className="font-semibold text-lg text-gray-900">Встановити TechShop</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Додайте додаток для швидкого доступу та роботи без інтернету
          </p>
          <div className="space-y-1 mb-4">
            <div className="flex items-center text-sm text-gray-700">
              <CheckCircleIcon className="w-4 h-4 text-teal-600 mr-2" />
              Працює без інтернету
            </div>
            <div className="flex items-center text-sm text-gray-700">
              <CheckCircleIcon className="w-4 h-4 text-teal-600 mr-2" />
              Швидкий доступ
            </div>
            <div className="flex items-center text-sm text-gray-700">
              <CheckCircleIcon className="w-4 h-4 text-teal-600 mr-2" />
              Сповіщення про акції
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-teal-700 transition-colors"
            >
              Встановити
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Пізніше
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Закрити"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
