'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  isOnline,
  isOffline,
  isPWAInstalled,
  addNetworkListener,
  getConnectionType,
  isSlowConnection,
  BeforeInstallPromptEvent,
  showInstallPrompt,
  registerBackgroundSync,
  requestNotificationPermission,
  subscribeToPushNotifications,
} from '@/lib/pwa/pwa-utils';

export interface UsePWAReturn {
  // Installation
  isInstalled: boolean;
  canInstall: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  install: () => Promise<'accepted' | 'dismissed' | null>;

  // Network status
  online: boolean;
  connectionType: string;
  slowConnection: boolean;

  // Notifications
  notificationPermission: NotificationPermission;
  requestNotifications: () => Promise<NotificationPermission>;
  subscribePush: () => Promise<PushSubscription | null>;

  // Sync
  syncData: (tag: string) => Promise<void>;
}

export function usePWA(): UsePWAReturn {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [slowConnection, setSlowConnection] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check if installed
    setIsInstalled(isPWAInstalled());

    // Check online status
    setOnline(isOnline());
    setConnectionType(getConnectionType());
    setSlowConnection(isSlowConnection());

    // Check notification permission
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Listen for network changes
    const cleanupNetwork = addNetworkListener((isOnline) => {
      setOnline(isOnline);
      setConnectionType(getConnectionType());
      setSlowConnection(isSlowConnection());
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      cleanupNetwork();
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) {
      return null;
    }

    const result = await showInstallPrompt(installPrompt);
    setInstallPrompt(null);
    return result;
  }, [installPrompt]);

  const requestNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const subscribePush = useCallback(async () => {
    return await subscribeToPushNotifications();
  }, []);

  const syncData = useCallback(async (tag: string) => {
    await registerBackgroundSync(tag);
  }, []);

  return {
    // Installation
    isInstalled,
    canInstall: !!installPrompt,
    installPrompt,
    install,

    // Network status
    online,
    connectionType,
    slowConnection,

    // Notifications
    notificationPermission,
    requestNotifications,
    subscribePush,

    // Sync
    syncData,
  };
}
