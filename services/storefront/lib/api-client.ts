/**
 * API Client - централізований клієнт для роботи з бекендом
 * Uses HTTP-only cookies for secure token storage (XSS protection)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

interface RequestConfig extends RequestInit {
    params?: Record<string, string | number | boolean>;
}

interface ApiError {
    message: string;
    code: string;
    status: number;
    details?: Record<string, unknown>;
}

export class ApiClientError extends Error {
    status: number;
    code: string;
    details?: Record<string, unknown>;

    constructor(error: ApiError) {
        super(error.message);
        this.name = 'ApiClientError';
        this.status = error.status;
        this.code = error.code;
        this.details = error.details;
    }
}

/**
 * Token management using HTTP-only cookies (secure)
 * Tokens are managed server-side via /api/auth/* routes
 */

/**
 * Set tokens via secure API route (stores in HTTP-only cookies)
 */
export async function setTokens(access: string, refresh: string): Promise<void> {
    if (typeof window !== 'undefined') {
        await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: access, refreshToken: refresh }),
            credentials: 'include',
        });
    }
}

/**
 * Get tokens status (not the actual tokens for security)
 */
export function getTokens(): { accessToken: string | null; refreshToken: string | null } {
    // Tokens are in HTTP-only cookies, not accessible from JS
    // This function is kept for API compatibility but returns null
    return { accessToken: null, refreshToken: null };
}

/**
 * Clear tokens via secure API route
 */
export async function clearTokens(): Promise<void> {
    if (typeof window !== 'undefined') {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
    }
}

/**
 * Request interceptor - adds credentials for cookie-based auth
 */
async function requestInterceptor(config: RequestConfig): Promise<RequestConfig> {
    // Cookies are sent automatically with credentials: 'include'
    config.credentials = 'include';
    return config;
}

/**
 * Response interceptor - handles 401 and token refresh
 */
async function responseInterceptor(response: Response, originalRequest?: { url: string; config: RequestConfig }): Promise<Response> {
    if (response.status === 401 && originalRequest) {
        // Try to refresh token via server-side route
        try {
            const refreshResponse = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
            });

            if (refreshResponse.ok) {
                // Retry original request with new tokens (cookies updated server-side)
                const retryResponse = await fetch(originalRequest.url, {
                    ...originalRequest.config,
                    credentials: 'include',
                });
                return retryResponse;
            } else {
                // Refresh failed, clear session
                await clearTokens();
            }
        } catch {
            await clearTokens();
        }
    }

    return response;
}

// Main request function
async function request<T>(
    endpoint: string,
    config: RequestConfig = {}
): Promise<T> {
    const { params, ...restConfig } = config;

    // Build URL with query params
    let url = `${API_BASE_URL}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value));
        });
        url += `?${searchParams.toString()}`;
    }

    // Apply request interceptor
    const interceptedConfig = await requestInterceptor({
        ...restConfig,
        headers: {
            'Content-Type': 'application/json',
            ...restConfig.headers,
        },
    });

    try {
        let response = await fetch(url, interceptedConfig);
        response = await responseInterceptor(response, { url, config: interceptedConfig });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiClientError({
                message: errorData.message || 'Request failed',
                code: errorData.code || 'UNKNOWN_ERROR',
                status: response.status,
                details: errorData.details,
            });
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
            return {} as T;
        }

        return JSON.parse(text);
    } catch (error) {
        if (error instanceof ApiClientError) {
            throw error;
        }
        throw new ApiClientError({
            message: error instanceof Error ? error.message : 'Network error',
            code: 'NETWORK_ERROR',
            status: 0,
        });
    }
}

// HTTP method helpers
export const apiClient = {
    get: <T>(endpoint: string, params?: Record<string, string | number | boolean>) =>
        request<T>(endpoint, { method: 'GET', params }),

    post: <T>(endpoint: string, data?: unknown) =>
        request<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }),

    put: <T>(endpoint: string, data?: unknown) =>
        request<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        }),

    patch: <T>(endpoint: string, data?: unknown) =>
        request<T>(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        }),

    delete: <T>(endpoint: string) =>
        request<T>(endpoint, { method: 'DELETE' }),
};

// API Endpoints
export const api = {
    // Auth
    auth: {
        login: (email: string, password: string) =>
            apiClient.post<{ accessToken: string; refreshToken: string; user: unknown }>('/auth/login', { email, password }),
        register: (data: { email: string; password: string; name: string; phone?: string }) =>
            apiClient.post<{ accessToken: string; refreshToken: string; user: unknown }>('/auth/register', data),
        logout: () => apiClient.post('/auth/logout'),
        me: () => apiClient.get<{ user: unknown }>('/auth/me'),
        forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
        resetPassword: (token: string, password: string) =>
            apiClient.post('/auth/reset-password', { token, password }),
    },

    // Products
    products: {
        list: (params?: { page?: number; limit?: number; category?: string; search?: string; sort?: string }) =>
            apiClient.get<{ products: unknown[]; total: number; page: number; limit: number }>('/products', params),
        get: (id: string) => apiClient.get<{ product: unknown }>(`/products/${id}`),
        getBySlug: (slug: string) => apiClient.get<{ product: unknown }>(`/products/slug/${slug}`),
        search: (query: string) => apiClient.get<{ products: unknown[] }>('/products/search', { q: query }),
        getRelated: (id: string) => apiClient.get<{ products: unknown[] }>(`/products/${id}/related`),
        getReviews: (id: string) => apiClient.get<{ reviews: unknown[] }>(`/products/${id}/reviews`),
        addReview: (id: string, data: { rating: number; text: string }) =>
            apiClient.post(`/products/${id}/reviews`, data),
    },

    // Categories
    categories: {
        list: () => apiClient.get<{ categories: unknown[] }>('/categories'),
        get: (id: string) => apiClient.get<{ category: unknown }>(`/categories/${id}`),
        getBySlug: (slug: string) => apiClient.get<{ category: unknown }>(`/categories/slug/${slug}`),
    },

    // Cart
    cart: {
        get: () => apiClient.get<{ cart: unknown }>('/cart'),
        add: (productId: string, quantity: number) =>
            apiClient.post('/cart/items', { productId, quantity }),
        update: (itemId: string, quantity: number) =>
            apiClient.patch(`/cart/items/${itemId}`, { quantity }),
        remove: (itemId: string) => apiClient.delete(`/cart/items/${itemId}`),
        clear: () => apiClient.delete('/cart'),
        applyPromo: (code: string) => apiClient.post('/cart/promo', { code }),
        removePromo: () => apiClient.delete('/cart/promo'),
    },

    // Orders
    orders: {
        list: (params?: { page?: number; limit?: number; status?: string }) =>
            apiClient.get<{ orders: unknown[]; total: number }>('/orders', params),
        get: (id: string) => apiClient.get<{ order: unknown }>(`/orders/${id}`),
        create: (data: {
            items: { productId: string; quantity: number }[];
            delivery: unknown;
            payment: unknown;
            promoCode?: string;
        }) => apiClient.post<{ order: unknown }>('/orders', data),
        cancel: (id: string) => apiClient.post(`/orders/${id}/cancel`),
        track: (id: string) => apiClient.get<{ tracking: unknown }>(`/orders/${id}/tracking`),
    },

    // User
    user: {
        getProfile: () => apiClient.get<{ user: unknown }>('/user/profile'),
        updateProfile: (data: { name?: string; phone?: string; email?: string }) =>
            apiClient.patch('/user/profile', data),
        changePassword: (currentPassword: string, newPassword: string) =>
            apiClient.post('/user/change-password', { currentPassword, newPassword }),
        getAddresses: () => apiClient.get<{ addresses: unknown[] }>('/user/addresses'),
        addAddress: (data: unknown) => apiClient.post('/user/addresses', data),
        updateAddress: (id: string, data: unknown) => apiClient.patch(`/user/addresses/${id}`, data),
        deleteAddress: (id: string) => apiClient.delete(`/user/addresses/${id}`),
        getWishlist: () => apiClient.get<{ items: unknown[] }>('/user/wishlist'),
        addToWishlist: (productId: string) => apiClient.post('/user/wishlist', { productId }),
        removeFromWishlist: (productId: string) => apiClient.delete(`/user/wishlist/${productId}`),
    },

    // Loyalty
    loyalty: {
        getAccount: () => apiClient.get<{ account: unknown }>('/loyalty/account'),
        getTransactions: (params?: { page?: number; limit?: number }) =>
            apiClient.get<{ transactions: unknown[]; total: number }>('/loyalty/transactions', params),
        redeem: (points: number) => apiClient.post('/loyalty/redeem', { points }),
    },

    // Gift Cards
    giftCards: {
        purchase: (data: { amount: number; designId: string; recipientEmail: string; recipientName: string; message?: string }) =>
            apiClient.post<{ giftCard: unknown }>('/gift-cards/purchase', data),
        checkBalance: (code: string) => apiClient.get<{ balance: number }>(`/gift-cards/${code}/balance`),
        redeem: (code: string, amount: number) => apiClient.post(`/gift-cards/${code}/redeem`, { amount }),
    },

    // Promo Codes
    promoCodes: {
        validate: (code: string) => apiClient.get<{ valid: boolean; discount: unknown }>(`/promo-codes/${code}/validate`),
        apply: (code: string, cartTotal: number) =>
            apiClient.post<{ discount: number; message: string }>('/promo-codes/apply', { code, cartTotal }),
    },

    // Delivery
    delivery: {
        getCities: (query: string) => apiClient.get<{ cities: unknown[] }>('/delivery/cities', { q: query }),
        getWarehouses: (cityRef: string) =>
            apiClient.get<{ warehouses: unknown[] }>('/delivery/warehouses', { cityRef }),
        calculatePrice: (data: { cityRef: string; weight: number; volume: number }) =>
            apiClient.post<{ price: number; estimatedDays: number }>('/delivery/calculate', data),
    },

    // Payment
    payment: {
        createPayment: (orderId: string, method: string) =>
            apiClient.post<{ paymentUrl: string; paymentId: string }>('/payment/create', { orderId, method }),
        getStatus: (paymentId: string) =>
            apiClient.get<{ status: string; details: unknown }>(`/payment/${paymentId}/status`),
    },

    // Admin
    admin: {
        // Dashboard
        getDashboardStats: () => apiClient.get<{ stats: unknown }>('/admin/dashboard/stats'),

        // Products
        products: {
            list: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
                apiClient.get<{ products: unknown[]; total: number }>('/admin/products', params),
            create: (data: unknown) => apiClient.post<{ product: unknown }>('/admin/products', data),
            update: (id: string, data: unknown) => apiClient.patch<{ product: unknown }>(`/admin/products/${id}`, data),
            delete: (id: string) => apiClient.delete(`/admin/products/${id}`),
            uploadImage: (id: string, file: File) => {
                const formData = new FormData();
                formData.append('image', file);
                return fetch(`${API_BASE_URL}/admin/products/${id}/images`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: formData,
                }).then(res => res.json());
            },
        },

        // Orders
        orders: {
            list: (params?: { page?: number; limit?: number; status?: string; dateFrom?: string; dateTo?: string }) =>
                apiClient.get<{ orders: unknown[]; total: number }>('/admin/orders', params),
            get: (id: string) => apiClient.get<{ order: unknown }>(`/admin/orders/${id}`),
            updateStatus: (id: string, status: string) =>
                apiClient.patch(`/admin/orders/${id}/status`, { status }),
            addNote: (id: string, note: string) =>
                apiClient.post(`/admin/orders/${id}/notes`, { note }),
        },

        // Customers
        customers: {
            list: (params?: { page?: number; limit?: number; search?: string }) =>
                apiClient.get<{ customers: unknown[]; total: number }>('/admin/customers', params),
            get: (id: string) => apiClient.get<{ customer: unknown }>(`/admin/customers/${id}`),
            getOrders: (id: string) => apiClient.get<{ orders: unknown[] }>(`/admin/customers/${id}/orders`),
        },

        // Categories
        categories: {
            list: () => apiClient.get<{ categories: unknown[] }>('/admin/categories'),
            create: (data: unknown) => apiClient.post<{ category: unknown }>('/admin/categories', data),
            update: (id: string, data: unknown) => apiClient.patch<{ category: unknown }>(`/admin/categories/${id}`, data),
            delete: (id: string) => apiClient.delete(`/admin/categories/${id}`),
        },

        // Promo Codes
        promoCodes: {
            list: () => apiClient.get<{ promoCodes: unknown[] }>('/admin/promo-codes'),
            create: (data: unknown) => apiClient.post<{ promoCode: unknown }>('/admin/promo-codes', data),
            update: (id: string, data: unknown) => apiClient.patch<{ promoCode: unknown }>(`/admin/promo-codes/${id}`, data),
            delete: (id: string) => apiClient.delete(`/admin/promo-codes/${id}`),
            toggle: (id: string) => apiClient.post(`/admin/promo-codes/${id}/toggle`),
        },

        // Email Campaigns
        emailCampaigns: {
            list: () => apiClient.get<{ campaigns: unknown[] }>('/admin/email-campaigns'),
            create: (data: unknown) => apiClient.post<{ campaign: unknown }>('/admin/email-campaigns', data),
            update: (id: string, data: unknown) => apiClient.patch<{ campaign: unknown }>(`/admin/email-campaigns/${id}`, data),
            delete: (id: string) => apiClient.delete(`/admin/email-campaigns/${id}`),
            send: (id: string) => apiClient.post(`/admin/email-campaigns/${id}/send`),
            schedule: (id: string, scheduledAt: string) =>
                apiClient.post(`/admin/email-campaigns/${id}/schedule`, { scheduledAt }),
        },

        // Warehouse
        warehouse: {
            getStock: (params?: { page?: number; limit?: number; warehouseId?: string; lowStock?: boolean }) =>
                apiClient.get<{ items: unknown[]; total: number }>('/admin/warehouse/stock', params),
            updateStock: (productId: string, warehouseId: string, quantity: number) =>
                apiClient.patch('/admin/warehouse/stock', { productId, warehouseId, quantity }),
            transfer: (data: { productId: string; fromWarehouse: string; toWarehouse: string; quantity: number }) =>
                apiClient.post('/admin/warehouse/transfer', data),
            getInventories: () => apiClient.get<{ inventories: unknown[] }>('/admin/warehouse/inventories'),
            createInventory: (data: unknown) => apiClient.post<{ inventory: unknown }>('/admin/warehouse/inventories', data),
        },

        // Suppliers
        suppliers: {
            list: () => apiClient.get<{ suppliers: unknown[] }>('/admin/suppliers'),
            create: (data: unknown) => apiClient.post<{ supplier: unknown }>('/admin/suppliers', data),
            update: (id: string, data: unknown) => apiClient.patch<{ supplier: unknown }>(`/admin/suppliers/${id}`, data),
            delete: (id: string) => apiClient.delete(`/admin/suppliers/${id}`),
        },

        // Reports
        reports: {
            sales: (params: { dateFrom: string; dateTo: string; groupBy?: string }) =>
                apiClient.get<{ report: unknown }>('/admin/reports/sales', params),
            products: (params: { dateFrom: string; dateTo: string }) =>
                apiClient.get<{ report: unknown }>('/admin/reports/products', params),
            customers: (params: { dateFrom: string; dateTo: string }) =>
                apiClient.get<{ report: unknown }>('/admin/reports/customers', params),
        },

        // Settings
        settings: {
            get: () => apiClient.get<{ settings: unknown }>('/admin/settings'),
            update: (data: unknown) => apiClient.patch('/admin/settings', data),
        },
    },
};

export default api;
