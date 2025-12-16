// Push Notifications Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import PushNotification, { ReceivedNotification } from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

import { api } from '../services/api';
import { useAppSettingsStore, useAuthStore } from '../store';

export interface NotificationData {
  id: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  type?: 'order' | 'promo' | 'reminder' | 'chat';
}

export interface PushNotificationsState {
  isEnabled: boolean;
  isRegistered: boolean;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationsState>({
    isEnabled: false,
    isRegistered: false,
    token: null,
    isLoading: true,
    error: null,
  });

  const { notificationsEnabled, setNotificationsEnabled } = useAppSettingsStore();
  const { isAuthenticated } = useAuthStore();
  const onNotificationRef = useRef<((notification: NotificationData) => void) | null>(null);

  // Initialize push notifications
  const initialize = useCallback(() => {
    PushNotification.configure({
      // Called when Token is generated (iOS and Android)
      onRegister: async (tokenData) => {
        console.log('Push notification token:', tokenData);

        setState((prev) => ({
          ...prev,
          token: tokenData.token,
          isLoading: false,
        }));

        // Register token with server if authenticated
        if (isAuthenticated && tokenData.token) {
          try {
            await api.registerPushToken(
              tokenData.token,
              Platform.OS as 'ios' | 'android'
            );
            setState((prev) => ({ ...prev, isRegistered: true }));
          } catch (error) {
            console.error('Failed to register push token:', error);
          }
        }
      },

      // Called when a remote or local notification is received/opened
      onNotification: (notification) => {
        console.log('Notification received:', notification);

        const notificationData: NotificationData = {
          id: notification.id?.toString() || String(Date.now()),
          title: notification.title || '',
          message: notification.message?.toString() || '',
          data: notification.data,
          type: notification.data?.type,
        };

        // Call registered handler
        if (onNotificationRef.current) {
          onNotificationRef.current(notificationData);
        }

        // Required on iOS
        if (Platform.OS === 'ios') {
          notification.finish(PushNotificationIOS.FetchResult.NoData);
        }
      },

      // Called when Action is pressed (Android)
      onAction: (notification) => {
        console.log('Notification action:', notification.action);
      },

      // Called when failed to register
      onRegistrationError: (error) => {
        console.error('Push notification registration error:', error);
        setState((prev) => ({
          ...prev,
          error: 'Не вдалося налаштувати сповіщення',
          isLoading: false,
        }));
      },

      // iOS only
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // Request permissions on register (iOS)
      requestPermissions: Platform.OS === 'ios',
    });
  }, [isAuthenticated]);

  useEffect(() => {
    initialize();

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      createNotificationChannels();
    }

    return () => {
      // Cleanup if needed
    };
  }, [initialize]);

  // Create notification channels (Android 8+)
  const createNotificationChannels = useCallback(() => {
    // Order updates channel
    PushNotification.createChannel(
      {
        channelId: 'orders',
        channelName: 'Замовлення',
        channelDescription: 'Оновлення статусу замовлень',
        importance: 4, // High
        vibrate: true,
      },
      (created) => console.log(`Orders channel created: ${created}`)
    );

    // Promotions channel
    PushNotification.createChannel(
      {
        channelId: 'promos',
        channelName: 'Акції та знижки',
        channelDescription: 'Повідомлення про акції та спеціальні пропозиції',
        importance: 3, // Default
        vibrate: true,
      },
      (created) => console.log(`Promos channel created: ${created}`)
    );

    // Reminders channel
    PushNotification.createChannel(
      {
        channelId: 'reminders',
        channelName: 'Нагадування',
        channelDescription: 'Нагадування про товари в кошику',
        importance: 2, // Low
        vibrate: false,
      },
      (created) => console.log(`Reminders channel created: ${created}`)
    );

    // Chat/Support channel
    PushNotification.createChannel(
      {
        channelId: 'chat',
        channelName: 'Повідомлення',
        channelDescription: 'Повідомлення від підтримки та AI-помічника',
        importance: 4, // High
        vibrate: true,
      },
      (created) => console.log(`Chat channel created: ${created}`)
    );
  }, []);

  // Request permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true; // Permissions not required on older Android
      }

      if (Platform.OS === 'ios') {
        const authStatus = await PushNotificationIOS.requestPermissions({
          alert: true,
          badge: true,
          sound: true,
        });

        return authStatus.alert || authStatus.badge || authStatus.sound;
      }

      return false;
    } catch (error) {
      console.error('Request permissions error:', error);
      return false;
    }
  }, []);

  // Enable notifications
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    const granted = await requestPermissions();

    if (!granted) {
      Alert.alert(
        'Дозвіл на сповіщення',
        'Для отримання сповіщень про замовлення, надайте дозвіл у налаштуваннях',
        [
          { text: 'Скасувати', style: 'cancel' },
          { text: 'Налаштування', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    setNotificationsEnabled(true);
    setState((prev) => ({ ...prev, isEnabled: true }));

    // Re-register token with server
    if (state.token && isAuthenticated) {
      try {
        await api.registerPushToken(state.token, Platform.OS as 'ios' | 'android');
        setState((prev) => ({ ...prev, isRegistered: true }));
      } catch (error) {
        console.error('Failed to register push token:', error);
      }
    }

    return true;
  }, [requestPermissions, setNotificationsEnabled, state.token, isAuthenticated]);

  // Disable notifications
  const disableNotifications = useCallback(async (): Promise<void> => {
    setNotificationsEnabled(false);
    setState((prev) => ({ ...prev, isEnabled: false }));

    // Unregister from server
    try {
      await api.unregisterPushToken();
      setState((prev) => ({ ...prev, isRegistered: false }));
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }, [setNotificationsEnabled]);

  // Show local notification
  const showLocalNotification = useCallback(
    (notification: NotificationData): void => {
      let channelId = 'default';
      switch (notification.type) {
        case 'order':
          channelId = 'orders';
          break;
        case 'promo':
          channelId = 'promos';
          break;
        case 'reminder':
          channelId = 'reminders';
          break;
        case 'chat':
          channelId = 'chat';
          break;
      }

      PushNotification.localNotification({
        channelId,
        title: notification.title,
        message: notification.message,
        userInfo: notification.data,
        playSound: true,
        soundName: 'default',
        vibrate: true,
        vibration: 300,
      });
    },
    []
  );

  // Schedule local notification
  const scheduleNotification = useCallback(
    (notification: NotificationData, date: Date): void => {
      PushNotification.localNotificationSchedule({
        channelId: 'reminders',
        title: notification.title,
        message: notification.message,
        date,
        userInfo: notification.data,
        playSound: true,
        soundName: 'default',
      });
    },
    []
  );

  // Cancel scheduled notification
  const cancelNotification = useCallback((id: string): void => {
    PushNotification.cancelLocalNotification(id);
  }, []);

  // Cancel all notifications
  const cancelAllNotifications = useCallback((): void => {
    PushNotification.cancelAllLocalNotifications();
  }, []);

  // Set badge count (iOS)
  const setBadgeCount = useCallback((count: number): void => {
    PushNotification.setApplicationIconBadgeNumber(count);
  }, []);

  // Register notification handler
  const onNotification = useCallback(
    (handler: (notification: NotificationData) => void): (() => void) => {
      onNotificationRef.current = handler;
      return () => {
        onNotificationRef.current = null;
      };
    },
    []
  );

  // Get delivered notifications (iOS)
  const getDeliveredNotifications = useCallback(async (): Promise<ReceivedNotification[]> => {
    return new Promise((resolve) => {
      PushNotification.getDeliveredNotifications((notifications) => {
        resolve(notifications);
      });
    });
  }, []);

  // Remove delivered notifications
  const removeDeliveredNotifications = useCallback((identifiers: string[]): void => {
    PushNotification.removeDeliveredNotifications(identifiers);
  }, []);

  return {
    ...state,
    isEnabled: notificationsEnabled && state.isEnabled,
    enableNotifications,
    disableNotifications,
    showLocalNotification,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    setBadgeCount,
    onNotification,
    getDeliveredNotifications,
    removeDeliveredNotifications,
    requestPermissions,
  };
}

export default usePushNotifications;
