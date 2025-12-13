'use client';

import { useState, useEffect } from 'react';
import { WifiIcon, CloudIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { isOnline, addNetworkListener, getConnectionType, isSlowConnection } from '@/lib/pwa/pwa-utils';
import { syncOfflineData, syncQueueStorage } from '@/lib/pwa/offline-storage';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [showIndicator, setShowIndicator] = useState(false);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [slowConnection, setSlowConnection] = useState(false);

  useEffect(() => {
    // Check initial online status
    setOnline(isOnline());
    setConnectionType(getConnectionType());
    setSlowConnection(isSlowConnection());

    // Load initial queue count
    loadQueueCount();

    // Listen for online/offline events
    const cleanup = addNetworkListener((isOnlineNow) => {
      setOnline(isOnlineNow);
      setShowIndicator(true);

      if (isOnlineNow) {
        // Auto-sync when coming back online
        handleSync();

        // Hide indicator after 5 seconds
        setTimeout(() => {
          setShowIndicator(false);
        }, 5000);
      }
    });

    // Update connection type
    const updateConnectionType = () => {
      setConnectionType(getConnectionType());
      setSlowConnection(isSlowConnection());
    };

    window.addEventListener('online', updateConnectionType);
    window.addEventListener('offline', updateConnectionType);

    return () => {
      cleanup();
      window.removeEventListener('online', updateConnectionType);
      window.removeEventListener('offline', updateConnectionType);
    };
  }, []);

  const loadQueueCount = async () => {
    const queue = await syncQueueStorage.getAll();
    setQueueCount(queue.length);
  };

  const handleSync = async () => {
    if (!online || syncing) return;

    setSyncing(true);

    try {
      await syncOfflineData();
      await loadQueueCount();
    } catch (error) {
      console.error('[Offline Indicator] Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Don't show if online and no queue items
  if (online && queueCount === 0 && !showIndicator) {
    return null;
  }

  // Show slow connection warning
  if (online && slowConnection) {
    return (
      <div className="fixed top-16 right-4 z-40 bg-amber-100 border border-amber-300 text-amber-800 px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
        <WifiIcon className="w-5 h-5 animate-pulse" />
        <span className="text-sm font-medium">Повільне з'єднання ({connectionType})</span>
      </div>
    );
  }

  // Offline indicator
  if (!online) {
    return (
      <div className="fixed top-16 left-0 right-0 z-40 bg-red-600 text-white px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CloudIcon className="w-6 h-6" />
            <div>
              <p className="font-semibold">Немає з'єднання</p>
              <p className="text-sm text-red-100">
                Ви переглядаєте збережені дані. Зміни будуть синхронізовані при поверненні з'єднання.
              </p>
            </div>
          </div>
          {queueCount > 0 && (
            <div className="bg-red-700 px-3 py-1 rounded-full text-sm font-medium">
              {queueCount} в черзі
            </div>
          )}
        </div>
      </div>
    );
  }

  // Syncing indicator
  if (online && (queueCount > 0 || syncing)) {
    return (
      <div className="fixed top-16 right-4 z-40 bg-green-100 border border-green-300 text-green-800 px-4 py-2 rounded-lg shadow-lg">
        <div className="flex items-center space-x-3">
          <ArrowPathIcon className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
          <div>
            <p className="font-semibold text-sm">
              {syncing ? 'Синхронізація...' : 'З'єднання відновлено'}
            </p>
            {queueCount > 0 && !syncing && (
              <p className="text-xs text-green-700">
                {queueCount} елементів в черзі синхронізації
              </p>
            )}
          </div>
          {!syncing && queueCount > 0 && (
            <button
              onClick={handleSync}
              className="ml-2 text-sm font-medium text-green-700 hover:text-green-900 underline"
            >
              Синхронізувати
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
