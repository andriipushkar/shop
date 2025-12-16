// Global State Management with Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, User, Cart, Product, CartItem } from '../services/api';

// =============================================================================
// AUTH STORE
// =============================================================================

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const user = await api.login(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Помилка входу',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const user = await api.register(data);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Помилка реєстрації',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await api.logout();
        } finally {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      loadProfile: async () => {
        set({ isLoading: true });
        try {
          const user = await api.getProfile();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      updateProfile: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const user = await api.updateProfile(data);
          set({ user, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.message || 'Помилка оновлення профілю',
            isLoading: false,
          });
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// =============================================================================
// CART STORE
// =============================================================================

interface CartState {
  cart: Cart | null;
  isLoading: boolean;
  error: string | null;

  loadCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyPromo: (code: string) => Promise<void>;
  clearCart: () => Promise<void>;
  clearError: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  cart: null,
  isLoading: false,
  error: null,

  loadCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const cart = await api.getCart();
      set({ cart, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addItem: async (productId, quantity = 1) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await api.addToCart(productId, quantity);
      set({ cart, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Помилка додавання до кошика', isLoading: false });
      throw error;
    }
  },

  updateItem: async (itemId, quantity) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await api.updateCartItem(itemId, quantity);
      set({ cart, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  removeItem: async (itemId) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await api.removeFromCart(itemId);
      set({ cart, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  applyPromo: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await api.applyPromoCode(code);
      set({ cart, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Невірний промокод', isLoading: false });
      throw error;
    }
  },

  clearCart: async () => {
    set({ isLoading: true });
    try {
      await api.clearCart();
      set({ cart: null, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// =============================================================================
// FAVORITES STORE
// =============================================================================

interface FavoritesState {
  favorites: string[];
  isLoading: boolean;

  addFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      isLoading: false,

      addFavorite: (productId) => {
        const { favorites } = get();
        if (!favorites.includes(productId)) {
          set({ favorites: [...favorites, productId] });
        }
      },

      removeFavorite: (productId) => {
        const { favorites } = get();
        set({ favorites: favorites.filter((id) => id !== productId) });
      },

      isFavorite: (productId) => {
        return get().favorites.includes(productId);
      },

      toggleFavorite: (productId) => {
        const { isFavorite, addFavorite, removeFavorite } = get();
        if (isFavorite(productId)) {
          removeFavorite(productId);
        } else {
          addFavorite(productId);
        }
      },
    }),
    {
      name: 'favorites-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// =============================================================================
// SEARCH HISTORY STORE
// =============================================================================

interface SearchHistoryState {
  history: string[];
  addSearch: (query: string) => void;
  removeSearch: (query: string) => void;
  clearHistory: () => void;
}

export const useSearchHistoryStore = create<SearchHistoryState>()(
  persist(
    (set, get) => ({
      history: [],

      addSearch: (query) => {
        const { history } = get();
        const newHistory = [query, ...history.filter((q) => q !== query)].slice(0, 20);
        set({ history: newHistory });
      },

      removeSearch: (query) => {
        const { history } = get();
        set({ history: history.filter((q) => q !== query) });
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'search-history-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// =============================================================================
// APP SETTINGS STORE
// =============================================================================

interface AppSettingsState {
  theme: 'light' | 'dark' | 'system';
  language: 'uk' | 'en';
  notificationsEnabled: boolean;
  biometricsEnabled: boolean;

  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (language: 'uk' | 'en') => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setBiometricsEnabled: (enabled: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'uk',
      notificationsEnabled: true,
      biometricsEnabled: false,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setBiometricsEnabled: (enabled) => set({ biometricsEnabled: enabled }),
    }),
    {
      name: 'app-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
