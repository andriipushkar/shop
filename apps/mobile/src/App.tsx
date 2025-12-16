// Main App Entry Point
import React, { useEffect, useState } from 'react';
import { StatusBar, useColorScheme, LogBox, Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from 'react-native-splash-screen';
import NetInfo from '@react-native-community/netinfo';

import Navigation from './navigation';
import { useAuthStore, useAppSettingsStore, useCartStore } from './store';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useBiometrics } from './hooks/useBiometrics';

// Ignore specific warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'Require cycle:',
  ]);
}

// Loading Screen Component
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>Завантаження...</Text>
  </View>
);

// Offline Banner Component
const OfflineBanner: React.FC = () => (
  <View style={styles.offlineBanner}>
    <Text style={styles.offlineText}>Немає з'єднання з інтернетом</Text>
  </View>
);

// Main App Component
const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const colorScheme = useColorScheme();
  const { theme } = useAppSettingsStore();
  const { loadProfile, isAuthenticated } = useAuthStore();
  const { loadCart } = useCartStore();
  const { onNotification, enableNotifications } = usePushNotifications();
  const { biometricLogin, isEnabled: biometricsEnabled } = useBiometrics();

  // Determine effective theme
  const effectiveTheme = theme === 'system' ? colorScheme : theme;
  const isDarkMode = effectiveTheme === 'dark';

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load user profile if authenticated
        await loadProfile();

        // Load cart data
        if (isAuthenticated) {
          await loadCart();
        }

        // Request notification permissions
        await enableNotifications();

      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setIsReady(true);
        // Hide splash screen
        if (Platform.OS !== 'web') {
          SplashScreen.hide();
        }
      }
    };

    initializeApp();
  }, []);

  // Network status listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  // Push notification handler
  useEffect(() => {
    const unsubscribe = onNotification((notification) => {
      console.log('Notification received in App:', notification);

      // Handle different notification types
      switch (notification.type) {
        case 'order':
          // Navigate to order details
          // navigation.navigate('OrderDetail', { orderId: notification.data?.orderId });
          break;
        case 'promo':
          // Show promo alert or navigate to promo screen
          break;
        case 'chat':
          // Navigate to chat/support screen
          break;
        default:
          // Default handling
          break;
      }
    });

    return unsubscribe;
  }, [onNotification]);

  // Show loading screen while initializing
  if (!isReady) {
    return (
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={isDarkMode ? '#000' : '#fff'}
        />
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={isDarkMode ? '#000' : '#fff'}
        />
        {isOffline && <OfflineBanner />}
        <Navigation />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  offlineBanner: {
    backgroundColor: '#ff6b6b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default App;
