// API Service - Core API Integration
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// Types
export interface ApiConfig {
  baseURL: string;
  timeout: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  images: string[];
  category: Category;
  brand?: string;
  inStock: boolean;
  quantity: number;
  attributes: Record<string, string>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  parentId?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
}

export interface Order {
  id: string;
  number: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shippingAddress: Address;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// API Client
class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<AuthTokens> | null = null;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Platform': 'mobile',
        'X-App-Version': '1.0.0',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        const tokens = await this.getTokens();
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          try {
            const tokens = await this.refreshTokens();
            if (tokens) {
              originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.logout();
            throw refreshError;
          }
        }

        throw error;
      }
    );
  }

  // Token management
  private async getTokens(): Promise<AuthTokens | null> {
    try {
      const credentials = await Keychain.getGenericPassword({ service: 'auth_tokens' });
      if (credentials) {
        return JSON.parse(credentials.password);
      }
    } catch (error) {
      console.error('Error getting tokens:', error);
    }
    return null;
  }

  private async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      await Keychain.setGenericPassword('tokens', JSON.stringify(tokens), {
        service: 'auth_tokens',
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
      });
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      await Keychain.resetGenericPassword({ service: 'auth_tokens' });
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  private async refreshTokens(): Promise<AuthTokens | null> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const currentTokens = await this.getTokens();
        if (!currentTokens?.refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${this.client.defaults.baseURL}/auth/refresh`, {
          refreshToken: currentTokens.refreshToken,
        });

        const newTokens: AuthTokens = {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresAt: Date.now() + response.data.expires_in * 1000,
        };

        await this.saveTokens(newTokens);
        return newTokens;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ==========================================================================
  // AUTH
  // ==========================================================================

  async login(email: string, password: string): Promise<User> {
    const response = await this.client.post('/auth/login', { email, password });

    const tokens: AuthTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };

    await this.saveTokens(tokens);
    return response.data.user;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<User> {
    const response = await this.client.post('/auth/register', data);

    const tokens: AuthTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };

    await this.saveTokens(tokens);
    return response.data.user;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    }
    await this.clearTokens();
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.put('/auth/me', data);
    return response.data;
  }

  // ==========================================================================
  // PRODUCTS
  // ==========================================================================

  async getProducts(params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<PaginatedResponse<Product>> {
    const response = await this.client.get('/products', { params });
    return response.data;
  }

  async getProduct(id: string): Promise<Product> {
    const response = await this.client.get(`/products/${id}`);
    return response.data;
  }

  async searchProducts(query: string, limit = 20): Promise<Product[]> {
    const response = await this.client.get('/products/search', {
      params: { q: query, limit },
    });
    return response.data.items || response.data;
  }

  async getSimilarProducts(productId: string, limit = 10): Promise<Product[]> {
    const response = await this.client.get(`/products/${productId}/similar`, {
      params: { limit },
    });
    return response.data;
  }

  // ==========================================================================
  // CATEGORIES
  // ==========================================================================

  async getCategories(): Promise<Category[]> {
    const response = await this.client.get('/categories');
    return response.data.items || response.data;
  }

  async getCategoryProducts(
    categoryId: string,
    params?: { page?: number; limit?: number; sort?: string }
  ): Promise<PaginatedResponse<Product>> {
    const response = await this.client.get(`/categories/${categoryId}/products`, { params });
    return response.data;
  }

  // ==========================================================================
  // CART
  // ==========================================================================

  async getCart(): Promise<Cart> {
    const response = await this.client.get('/cart');
    return response.data;
  }

  async addToCart(productId: string, quantity = 1): Promise<Cart> {
    const response = await this.client.post('/cart/items', { product_id: productId, quantity });
    return response.data;
  }

  async updateCartItem(itemId: string, quantity: number): Promise<Cart> {
    const response = await this.client.put(`/cart/items/${itemId}`, { quantity });
    return response.data;
  }

  async removeFromCart(itemId: string): Promise<Cart> {
    const response = await this.client.delete(`/cart/items/${itemId}`);
    return response.data;
  }

  async applyPromoCode(code: string): Promise<Cart> {
    const response = await this.client.post('/cart/promo', { code });
    return response.data;
  }

  async clearCart(): Promise<void> {
    await this.client.delete('/cart');
  }

  // ==========================================================================
  // CHECKOUT
  // ==========================================================================

  async setShippingAddress(address: Address): Promise<void> {
    await this.client.post('/checkout/shipping', address);
  }

  async getShippingMethods(): Promise<Array<{
    id: string;
    name: string;
    price: number;
    estimatedDays: number;
  }>> {
    const response = await this.client.get('/checkout/shipping-methods');
    return response.data;
  }

  async setShippingMethod(methodId: string): Promise<void> {
    await this.client.post('/checkout/shipping-method', { method_id: methodId });
  }

  async createPayment(method: string): Promise<{
    paymentUrl?: string;
    orderId?: string;
  }> {
    const response = await this.client.post('/checkout/payment', { payment_method: method });
    return response.data;
  }

  async completeOrder(): Promise<Order> {
    const response = await this.client.post('/checkout/complete');
    return response.data;
  }

  // ==========================================================================
  // ORDERS
  // ==========================================================================

  async getOrders(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Order>> {
    const response = await this.client.get('/orders', { params });
    return response.data;
  }

  async getOrder(id: string): Promise<Order> {
    const response = await this.client.get(`/orders/${id}`);
    return response.data;
  }

  // ==========================================================================
  // AI ASSISTANT
  // ==========================================================================

  async chat(message: string, sessionId?: string): Promise<{
    message: string;
    products: Product[];
    sessionId: string;
  }> {
    const response = await this.client.post('/ai/chat', {
      message,
      session_id: sessionId,
    });
    return response.data;
  }

  async visualSearch(imageBase64: string): Promise<Product[]> {
    const response = await this.client.post('/ai/visual-search', {
      image: imageBase64,
    });
    return response.data.products;
  }

  // ==========================================================================
  // PUSH NOTIFICATIONS
  // ==========================================================================

  async registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.client.post('/notifications/register', {
      token,
      platform,
    });
  }

  async unregisterPushToken(): Promise<void> {
    await this.client.delete('/notifications/register');
  }
}

// Export singleton instance
export const api = new ApiClient({
  baseURL: __DEV__
    ? 'http://localhost:8080/api/v1'
    : 'https://api.shop.example.com/api/v1',
  timeout: 30000,
});

export default api;
