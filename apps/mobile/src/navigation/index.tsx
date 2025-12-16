// Navigation Structure
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';

import { useAuthStore, useCartStore } from '../store';

// Screen imports
import {
  HomeScreen,
  CatalogScreen,
  ProductScreen,
  SearchScreen,
  CartScreen,
  CheckoutScreen,
  ProfileScreen,
  LoginScreen,
  RegisterScreen,
  OrdersScreen,
  OrderDetailScreen,
  FavoritesScreen,
  AIAssistantScreen,
  VisualSearchScreen,
  SettingsScreen,
} from '../screens';

// Types
export type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
  Product: { productId: string };
  Search: { query?: string };
  Checkout: undefined;
  OrderDetail: { orderId: string };
  AIAssistant: undefined;
  VisualSearch: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Catalog: undefined;
  Cart: undefined;
  Favorites: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  Orders: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// Auth Navigator
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// Profile Navigator
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerBackTitle: 'Назад',
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ title: 'Мої замовлення' }}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Налаштування' }}
      />
    </ProfileStack.Navigator>
  );
}

// Main Tab Navigator
function MainNavigator() {
  const { cart } = useCartStore();
  const cartItemCount = cart?.items?.length || 0;

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Catalog':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Cart':
              iconName = focused ? 'cart' : 'cart-outline';
              break;
            case 'Favorites':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <MainTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Головна' }}
      />
      <MainTab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ tabBarLabel: 'Каталог' }}
      />
      <MainTab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: 'Кошик',
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
        }}
      />
      <MainTab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ tabBarLabel: 'Обране' }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{ tabBarLabel: 'Профіль' }}
      />
    </MainTab.Navigator>
  );
}

// Root Navigator
export default function Navigation() {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerBackTitle: 'Назад',
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <RootStack.Screen
              name="Main"
              component={MainNavigator}
              options={{ headerShown: false }}
            />
            <RootStack.Screen
              name="Product"
              component={ProductScreen}
              options={{ title: '' }}
            />
            <RootStack.Screen
              name="Search"
              component={SearchScreen}
              options={{ title: 'Пошук' }}
            />
            <RootStack.Screen
              name="Checkout"
              component={CheckoutScreen}
              options={{ title: 'Оформлення замовлення' }}
            />
            <RootStack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ title: 'Деталі замовлення' }}
            />
            <RootStack.Screen
              name="AIAssistant"
              component={AIAssistantScreen}
              options={{ title: 'AI Помічник' }}
            />
            <RootStack.Screen
              name="VisualSearch"
              component={VisualSearchScreen}
              options={{ title: 'Пошук за фото' }}
            />
            <RootStack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Налаштування' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
