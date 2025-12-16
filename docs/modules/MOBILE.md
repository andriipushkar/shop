# Mobile Native App

React Native додаток для iOS та Android з підтримкою AI-функцій, біометричної аутентифікації та push-сповіщень.

## Архітектура

```
apps/mobile/
├── src/
│   ├── App.tsx              # Головний компонент
│   ├── screens/             # Екрани додатку
│   │   ├── HomeScreen.tsx
│   │   ├── CatalogScreen.tsx
│   │   ├── CartScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── LoginScreen.tsx
│   │   ├── AIAssistantScreen.tsx
│   │   └── placeholders.tsx
│   ├── navigation/          # React Navigation
│   │   └── index.tsx
│   ├── hooks/               # Custom hooks
│   │   ├── useBiometrics.ts
│   │   └── usePushNotifications.ts
│   ├── services/            # API клієнт
│   │   └── api.ts
│   └── store/               # Zustand stores
│       └── index.ts
├── app.json                 # Expo/RN конфігурація
├── babel.config.js
├── metro.config.js
├── tsconfig.json
└── package.json
```

## Основні функції

### 1. AI Shopping Assistant
Чат-бот з RAG для пошуку товарів та відповідей на питання.

```typescript
// AIAssistantScreen.tsx
const sendMessage = async (text: string) => {
  const response = await api.sendChatMessage({
    message: text,
    sessionId: sessionId,
  });
  // Відображення відповіді та рекомендованих товарів
};
```

### 2. Біометрична аутентифікація

Підтримка Face ID, Touch ID та відбитка пальця.

```typescript
// useBiometrics.ts
import ReactNativeBiometrics from 'react-native-biometrics';
import * as Keychain from 'react-native-keychain';

// Збереження credentials з біометричним захистом
await Keychain.setGenericPassword(email, password, {
  accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
  accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

// Біометричний вхід
const credentials = await biometricLogin();
if (credentials) {
  await login(credentials.email, credentials.password);
}
```

### 3. Push сповіщення

FCM (Android) та APNS (iOS) з категоризованими каналами.

```typescript
// usePushNotifications.ts
// Канали сповіщень (Android)
const channels = [
  { id: 'orders', name: 'Замовлення', importance: 4 },
  { id: 'promos', name: 'Акції та знижки', importance: 3 },
  { id: 'reminders', name: 'Нагадування', importance: 2 },
  { id: 'chat', name: 'Повідомлення', importance: 4 },
];

// Реєстрація токена
await api.registerPushToken(token, Platform.OS);
```

## State Management

Використовуємо Zustand з persist middleware.

### Stores

```typescript
// Auth Store
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email, password) => Promise<void>;
  logout: () => Promise<void>;
}

// Cart Store
interface CartState {
  cart: Cart | null;
  addItem: (productId, quantity) => Promise<void>;
  updateItem: (itemId, quantity) => Promise<void>;
  removeItem: (itemId) => Promise<void>;
  applyPromo: (code) => Promise<void>;
}

// Favorites Store
interface FavoritesState {
  favorites: string[];
  toggleFavorite: (productId) => void;
  isFavorite: (productId) => boolean;
}

// App Settings Store
interface AppSettingsState {
  theme: 'light' | 'dark' | 'system';
  language: 'uk' | 'en';
  notificationsEnabled: boolean;
  biometricsEnabled: boolean;
}
```

## Navigation

React Navigation з Tab Navigator та Stack Navigators.

```
RootStack
├── AuthStack (неавторизований)
│   ├── Login
│   └── Register
└── Main (авторизований)
    ├── MainTab (Bottom Tab)
    │   ├── Home
    │   ├── Catalog
    │   ├── Cart (badge з кількістю)
    │   ├── Favorites
    │   └── Profile (Stack)
    │       ├── ProfileMain
    │       ├── Orders
    │       └── Settings
    ├── Product (Modal)
    ├── Search
    ├── Checkout
    ├── OrderDetail
    ├── AIAssistant
    └── VisualSearch
```

## API Client

Axios-based клієнт з interceptors.

```typescript
// Автоматичне додавання токена
api.interceptors.request.use((config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обробка 401 помилок
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('auth_token');
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

## Екрани

### HomeScreen
- AI Assistant та Visual Search банери
- Категорії (горизонтальний scroll)
- Популярні товари (grid)
- Pull-to-refresh

### CatalogScreen
- Пошук по назві
- Фільтрація по категоріях (chips)
- Infinite scroll з пагінацією
- Favorites toggle

### CartScreen
- Список товарів з quantity controls
- Промокод
- Підсумок з breakdown
- Checkout button

### ProfileScreen
- Аватар та статистика
- Біометричний badge
- Меню налаштувань
- Logout

### LoginScreen
- Email/Password форма
- Біометричний вхід
- Social login buttons
- Forgot password

### AIAssistantScreen
- Chat інтерфейс
- Quick suggestions
- Product recommendations в відповідях
- Streaming responses (планується)

## Залежності

```json
{
  "dependencies": {
    "react-native": "0.73.x",
    "@react-navigation/native": "^6.x",
    "@react-navigation/native-stack": "^6.x",
    "@react-navigation/bottom-tabs": "^6.x",
    "zustand": "^4.x",
    "axios": "^1.x",
    "react-native-biometrics": "^3.x",
    "react-native-keychain": "^8.x",
    "react-native-push-notification": "^8.x",
    "@react-native-async-storage/async-storage": "^1.x"
  }
}
```

## Запуск

```bash
# Встановлення залежностей
cd apps/mobile
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android

# Metro bundler
npm start
```

## Build

### iOS (App Store)
```bash
# Development
npm run ios -- --configuration Release

# Production
cd ios
xcodebuild -workspace ShopMobile.xcworkspace -scheme ShopMobile -configuration Release archive
```

### Android (Play Store)
```bash
# Release APK
cd android
./gradlew assembleRelease

# Release AAB (App Bundle)
./gradlew bundleRelease
```

## Testing

```bash
# Unit tests
npm test

# E2E tests (Detox)
npm run e2e:ios
npm run e2e:android
```

## Environment Variables

```env
# .env
API_URL=https://api.shop.com
GOOGLE_MAPS_API_KEY=xxx
SENTRY_DSN=xxx
```

## Roadmap

- [ ] Visual Search з камерою
- [ ] Offline mode з sync
- [ ] AR перегляд товарів
- [ ] Widget для iOS
- [ ] Deep linking
- [ ] App Clips / Instant Apps
