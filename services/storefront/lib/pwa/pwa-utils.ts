/**
 * PWA Utilities
 * Utilities for Progressive Web App functionality
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Check if the app is installed as a PWA
export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check if running as iOS PWA
  const isIOSStandalone = (window.navigator as any).standalone === true;

  // Check if running as Chrome PWA
  const isChromeStandalone = document.referrer.includes('android-app://');

  return isStandalone || isIOSStandalone || isChromeStandalone;
}

// Check if the app is running in a browser
export function isInBrowser(): boolean {
  return !isPWAInstalled();
}

// Check if PWA installation is supported
export function isPWAInstallSupported(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for beforeinstallprompt support
  return 'BeforeInstallPromptEvent' in window || 'onbeforeinstallprompt' in window;
}

// Check if service worker is supported
export function isServiceWorkerSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'serviceWorker' in navigator;
}

// Check if the device is online
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// Check if the device is offline
export function isOffline(): boolean {
  return !isOnline();
}

// Get connection type
export function getConnectionType(): string {
  if (typeof navigator === 'undefined') return 'unknown';

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (!connection) return 'unknown';

  return connection.effectiveType || connection.type || 'unknown';
}

// Check if connection is slow (2G or slow-2g)
export function isSlowConnection(): boolean {
  const connectionType = getConnectionType();
  return connectionType === 'slow-2g' || connectionType === '2g';
}

// Check if connection is fast (4G or better)
export function isFastConnection(): boolean {
  const connectionType = getConnectionType();
  return connectionType === '4g' || connectionType === '5g';
}

// Register service worker
export async function registerServiceWorker(swPath: string = '/sw-offline.js'): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.warn('[PWA] Service Worker is not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
      updateViaCache: 'none',
    });

    console.log('[PWA] Service Worker registered:', registration);

    // Check for updates every hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Check for updates when page regains focus
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        registration.update();
      }
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

// Unregister service worker
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const result = await registration.unregister();
      console.log('[PWA] Service Worker unregistered:', result);
      return result;
    }
    return false;
  } catch (error) {
    console.error('[PWA] Service Worker unregistration failed:', error);
    return false;
  }
}

// Update service worker
export async function updateServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('[PWA] Service Worker updated');
    }
  } catch (error) {
    console.error('[PWA] Service Worker update failed:', error);
  }
}

// Skip waiting and activate new service worker
export async function skipWaitingAndActivate(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Reload page after activation
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  } catch (error) {
    console.error('[PWA] Skip waiting failed:', error);
  }
}

// Cache specific URLs
export async function cacheUrls(urls: string[]): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'CACHE_URLS',
        urls,
      });
    }
  } catch (error) {
    console.error('[PWA] Cache URLs failed:', error);
  }
}

// Clear all caches
export async function clearAllCaches(): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.active) {
      registration.active.postMessage({
        type: 'CLEAR_CACHE',
      });
    }
  } catch (error) {
    console.error('[PWA] Clear caches failed:', error);
  }
}

// Show install prompt
export async function showInstallPrompt(deferredPrompt: BeforeInstallPromptEvent): Promise<'accepted' | 'dismissed' | null> {
  if (!deferredPrompt) {
    console.warn('[PWA] No deferred install prompt available');
    return null;
  }

  try {
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    console.log('[PWA] Install prompt result:', choiceResult.outcome);
    return choiceResult.outcome;
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return null;
  }
}

// Check if iOS
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

// Check if Android
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;

  return /Android/.test(navigator.userAgent);
}

// Get platform
export function getPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  if (typeof navigator !== 'undefined' && /Windows|Mac|Linux/.test(navigator.userAgent)) return 'desktop';
  return 'unknown';
}

// Listen for online/offline events
export function addNetworkListener(callback: (online: boolean) => void): () => void {
  const onlineHandler = () => callback(true);
  const offlineHandler = () => callback(false);

  window.addEventListener('online', onlineHandler);
  window.addEventListener('offline', offlineHandler);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', offlineHandler);
  };
}

// Listen for connection change
export function addConnectionListener(callback: (type: string) => void): () => void {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  if (!connection) {
    return () => {}; // No-op cleanup
  }

  const changeHandler = () => {
    const type = connection.effectiveType || connection.type || 'unknown';
    callback(type);
  };

  connection.addEventListener('change', changeHandler);

  // Return cleanup function
  return () => {
    connection.removeEventListener('change', changeHandler);
  };
}

// Request persistent storage
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    console.log('[PWA] Persistent storage:', isPersisted);
    return isPersisted;
  } catch (error) {
    console.error('[PWA] Persistent storage request failed:', error);
    return false;
  }
}

// Check if storage is persisted
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persisted) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch (error) {
    console.error('[PWA] Storage persistence check failed:', error);
    return false;
  }
}

// Get storage estimate
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    return await navigator.storage.estimate();
  } catch (error) {
    console.error('[PWA] Storage estimate failed:', error);
    return null;
  }
}

// Format storage size
export function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Get storage usage percentage
export async function getStorageUsagePercentage(): Promise<number | null> {
  const estimate = await getStorageEstimate();

  if (!estimate || !estimate.quota || !estimate.usage) {
    return null;
  }

  return (estimate.usage / estimate.quota) * 100;
}

// Background sync utilities
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!isServiceWorkerSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      console.log('[PWA] Background sync registered:', tag);
    }
  } catch (error) {
    console.error('[PWA] Background sync registration failed:', error);
  }
}

// Push notification utilities
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

// Check if notifications are supported
export function areNotificationsSupported(): boolean {
  return typeof Notification !== 'undefined';
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!isServiceWorkerSupported() || !areNotificationsSupported()) {
    return null;
  }

  try {
    const permission = await requestNotificationPermission();

    if (permission !== 'granted') {
      console.warn('[PWA] Notification permission denied');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    console.log('[PWA] Push notification subscription:', subscription);
    return subscription;
  } catch (error) {
    console.error('[PWA] Push notification subscription failed:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const result = await subscription.unsubscribe();
      console.log('[PWA] Push notification unsubscribed:', result);
      return result;
    }

    return false;
  } catch (error) {
    console.error('[PWA] Push notification unsubscription failed:', error);
    return false;
  }
}
