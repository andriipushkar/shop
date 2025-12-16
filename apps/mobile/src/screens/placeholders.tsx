// Placeholder Screens
// These screens are stubs that will be implemented in future updates

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

// Base placeholder component
const createPlaceholderScreen = (
  name: string,
  iconName: string,
  description: string
) => {
  const Screen: React.FC = () => {
    const navigation = useNavigation();

    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Icon name={iconName} size={64} color="#007AFF" />
        </View>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.description}>{description}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={20} color="#007AFF" />
          <Text style={styles.backText}>Назад</Text>
        </TouchableOpacity>
      </View>
    );
  };

  Screen.displayName = name.replace(/\s/g, '') + 'Screen';
  return Screen;
};

// Product Screen
export const ProductScreen = createPlaceholderScreen(
  'Товар',
  'cube-outline',
  'Детальна інформація про товар'
);

// Search Screen
export const SearchScreen = createPlaceholderScreen(
  'Пошук',
  'search-outline',
  'Пошук товарів за назвою або категорією'
);

// Checkout Screen
export const CheckoutScreen = createPlaceholderScreen(
  'Оформлення',
  'card-outline',
  'Оформлення замовлення та оплата'
);

// Register Screen
export const RegisterScreen = createPlaceholderScreen(
  'Реєстрація',
  'person-add-outline',
  'Створіть новий акаунт'
);

// Orders Screen
export const OrdersScreen = createPlaceholderScreen(
  'Мої замовлення',
  'receipt-outline',
  'Історія та статус замовлень'
);

// Order Detail Screen
export const OrderDetailScreen = createPlaceholderScreen(
  'Деталі замовлення',
  'document-text-outline',
  'Інформація про замовлення'
);

// Favorites Screen
export const FavoritesScreen = createPlaceholderScreen(
  'Обране',
  'heart-outline',
  'Збережені товари'
);

// Visual Search Screen
export const VisualSearchScreen = createPlaceholderScreen(
  'Пошук за фото',
  'camera-outline',
  'Знайдіть товар за фотографією'
);

// Settings Screen
export const SettingsScreen = createPlaceholderScreen(
  'Налаштування',
  'settings-outline',
  'Налаштування додатку'
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 8,
  },
  backText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});
