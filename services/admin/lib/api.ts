import axios, { AxiosError, AxiosInstance } from 'axios'
import toast from 'react-hot-toast'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1'

class ApiClient {
  private client: AxiosInstance
  private token: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: string; message?: string }>) => {
        const message = error.response?.data?.error ||
                       error.response?.data?.message ||
                       'An error occurred'

        if (error.response?.status === 401) {
          this.token = null
          localStorage.removeItem('admin_token')
          window.location.href = '/login'
        } else {
          toast.error(message)
        }

        return Promise.reject(error)
      }
    )
  }

  setToken(token: string) {
    this.token = token
    localStorage.setItem('admin_token', token)
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('admin_token')
  }

  loadToken() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('admin_token')
    }
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password })
    this.setToken(data.access_token)
    return data
  }

  async logout() {
    await this.client.post('/auth/logout')
    this.clearToken()
  }

  async getProfile() {
    const { data } = await this.client.get('/auth/me')
    return data
  }

  // Dashboard
  async getDashboardStats() {
    const { data } = await this.client.get('/admin/dashboard/stats')
    return data
  }

  async getRecentOrders(limit = 10) {
    const { data } = await this.client.get(`/admin/orders?limit=${limit}`)
    return data
  }

  async getSalesChart(period: 'day' | 'week' | 'month' = 'week') {
    const { data } = await this.client.get(`/admin/dashboard/sales?period=${period}`)
    return data
  }

  // Products
  async getProducts(params?: { page?: number; limit?: number; search?: string; category?: string }) {
    const { data } = await this.client.get('/admin/products', { params })
    return data
  }

  async getProduct(id: string) {
    const { data } = await this.client.get(`/admin/products/${id}`)
    return data
  }

  async createProduct(product: ProductInput) {
    const { data } = await this.client.post('/admin/products', product)
    return data
  }

  async updateProduct(id: string, product: Partial<ProductInput>) {
    const { data } = await this.client.put(`/admin/products/${id}`, product)
    return data
  }

  async deleteProduct(id: string) {
    await this.client.delete(`/admin/products/${id}`)
  }

  async uploadProductImage(id: string, file: File) {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await this.client.post(`/admin/products/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  }

  // Categories
  async getCategories(params?: { page?: number; limit?: number }) {
    const { data } = await this.client.get('/admin/categories', { params })
    return data
  }

  async getCategory(id: string) {
    const { data } = await this.client.get(`/admin/categories/${id}`)
    return data
  }

  async createCategory(category: CategoryInput) {
    const { data } = await this.client.post('/admin/categories', category)
    return data
  }

  async updateCategory(id: string, category: Partial<CategoryInput>) {
    const { data } = await this.client.put(`/admin/categories/${id}`, category)
    return data
  }

  async deleteCategory(id: string) {
    await this.client.delete(`/admin/categories/${id}`)
  }

  // Orders
  async getOrders(params?: { page?: number; limit?: number; status?: string }) {
    const { data } = await this.client.get('/admin/orders', { params })
    return data
  }

  async getOrder(id: string) {
    const { data } = await this.client.get(`/admin/orders/${id}`)
    return data
  }

  async updateOrderStatus(id: string, status: string) {
    const { data } = await this.client.patch(`/admin/orders/${id}/status`, { status })
    return data
  }

  // Customers
  async getCustomers(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await this.client.get('/admin/customers', { params })
    return data
  }

  async getCustomer(id: string) {
    const { data } = await this.client.get(`/admin/customers/${id}`)
    return data
  }

  async updateCustomer(id: string, customer: Partial<CustomerInput>) {
    const { data } = await this.client.put(`/admin/customers/${id}`, customer)
    return data
  }

  // Settings
  async getSettings() {
    const { data } = await this.client.get('/admin/settings')
    return data
  }

  async updateSettings(settings: Record<string, unknown>) {
    const { data } = await this.client.put('/admin/settings', settings)
    return data
  }
}

// Types
export interface ProductInput {
  name: string
  slug: string
  description: string
  price: number
  compare_price?: number
  sku: string
  quantity: number
  category_id: string
  is_active: boolean
  attributes?: Record<string, string>
}

export interface CategoryInput {
  name: string
  slug: string
  description?: string
  parent_id?: string
  image_url?: string
  is_active: boolean
}

export interface CustomerInput {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  is_active?: boolean
}

export interface DashboardStats {
  total_orders: number
  total_revenue: number
  total_customers: number
  total_products: number
  orders_today: number
  revenue_today: number
  pending_orders: number
  low_stock_products: number
}

export interface SalesData {
  labels: string[]
  data: number[]
}

export const api = new ApiClient()
export default api
