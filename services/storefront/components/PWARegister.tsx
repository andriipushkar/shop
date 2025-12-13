'use client';

import { useEffect } from 'react';
import { registerServiceWorker, addNetworkListener } from '@/lib/pwa/pwa-utils';
import { syncOfflineData } from '@/lib/pwa/offline-storage';

export default function PWARegister() {
  useEffect(() => {
    // Register service worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      registerServiceWorker('/sw-offline.js')
        .then((registration) => {
          if (registration) {
            console.log('[PWA] Service worker registered successfully');

            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;

              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available
                    console.log('[PWA] New service worker available');

                    // Show update notification
                    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                      new Notification('Оновлення TechShop', {
                        body: 'Доступна нова версія додатку. Оновіть сторінку для застосування змін.',
                        icon: '/icons/icon-192x192.png',
                        badge: '/icons/badge-72x72.png',
                        tag: 'app-update',
                      });
                    }
                  }
                });
              }
            });
          }
        })
        .catch((error) => {
          console.error('[PWA] Service worker registration failed:', error);
        });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[PWA] Message from service worker:', event.data);

        if (event.data && event.data.type === 'ORDER_SYNCED') {
          // Show notification when order is synced
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Замовлення синхронізовано', {
              body: 'Ваше замовлення успішно відправлено на сервер.',
              icon: '/icons/icon-192x192.png',
              tag: 'order-sync',
            });
          }
        }
      });
    }

    // Listen for online/offline events and sync data
    const cleanup = addNetworkListener(async (online) => {
      if (online) {
        console.log('[PWA] Device is online, syncing data...');
        await syncOfflineData();
      } else {
        console.log('[PWA] Device is offline');
      }
    });

    // Cleanup
    return () => {
      cleanup();
    };
  }, []);

  return null; // This component doesn't render anything
}
