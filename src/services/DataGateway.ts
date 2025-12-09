/**
 * Data Gateway Service
 * 
 * Centralized service layer for all frontend API interactions.
 * Handles fetching, error handling, caching, and data transformation.
 * 
 * Components should use this service instead of directly calling fetch().
 * 
 * Usage:
 *   import { DataGateway } from '@/services/DataGateway'
 *   const products = await DataGateway.getProducts()
 */

import type { Product } from '../dataAdapter'
import type { CartItem } from '../contexts/CartContext'
import { sanitizeBatch } from '../dataAdapter'
import type { User } from '@neondatabase/neon-auth'

// ============================================================================
// Types
// ============================================================================

export interface ApiError {
  message: string
  status?: number
  code?: string
  details?: unknown
}

export interface ApiResponse<T> {
  data: T
  error?: ApiError
  cached?: boolean
}

export interface GetProductsOptions {
  limit?: number
  offset?: number
  category?: string
  inStock?: boolean
  search?: string
  signal?: AbortSignal
}

export interface Order {
  id: string
  order_number: string
  square_order_id?: string
  square_payment_id?: string
  status: string
  payment_status?: string
  total: number
  subtotal: number
  tax?: number
  shipping?: number
  items: OrderItem[]
  customer?: {
    id?: string
    name: {
      first: string
      last: string
      full: string
    }
    email: string
    phone?: string
  }
  shipping_address?: Address
  shipping_method?: string
  pickup_details?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    fulfillmentType?: string
  }
  pickup_status?: {
    status: 'ready' | 'processing' | 'pending'
    message: string
  }
  payment_method?: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string | number
  product_id: string
  product_name: string
  quantity: number
  price: number
  subtotal: number
  image_url?: string
  category?: string
}

export interface Address {
  street: string
  city: string
  state: string
  zip: string
  country: string
}

export interface User {
  id: string
  email: string
  name?: string
  role?: 'user' | 'authenticated' // Role from auth system (admin/staff removed - no admin functionality)
}

export interface UserProfile {
  id: string
  email: string
  name?: string
  phone?: string
  address?: Address
  created_at: string
}

export interface CheckoutPayload {
  items: Array<{
    sku: string
    quantity: number
  }>
  contact?: {
    email: string
    name?: string
    phone?: string
  }
  shipping?: Address
  delivery_method?: 'delivery' | 'pickup'
}

export interface CheckoutResponse {
  url?: string
  orderId?: string
  orderNumber?: string
  error?: string
}

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_PREFIX = 'datagateway_'
const CACHE_TTL = {
  products: 5 * 60 * 1000, // 5 minutes
  orders: 2 * 60 * 1000, // 2 minutes
  user: 10 * 60 * 1000, // 10 minutes
  profile: 10 * 60 * 1000, // 10 minutes
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get API base URL (handles local dev vs production)
 */
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000'
  }

  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  if (isLocalDev) {
    return import.meta.env.VITE_API_URL || 'http://localhost:3000'
  }

  return window.location.origin
}

/**
 * Get cache key for a resource
 */
function getCacheKey(resource: string, params?: Record<string, unknown>): string {
  const key = params
    ? `${resource}_${JSON.stringify(params)}`
    : resource
  return `${CACHE_PREFIX}${key}`
}

/**
 * Get cached data
 */
function getCached<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) return null

    const entry: CacheEntry<T> = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is expired
    if (now - entry.timestamp > entry.ttl) {
      localStorage.removeItem(key)
      return null
    }

    return entry.data
  } catch (error) {
    console.warn('[DataGateway] Cache read error:', error)
    return null
  }
}

/**
 * Set cached data
 */
function setCached<T>(key: string, data: T, ttl: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch (error) {
    console.warn('[DataGateway] Cache write error:', error)
    // If storage is full, try to clear old entries
    try {
      clearExpiredCache()
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), ttl }))
    } catch (retryError) {
      console.warn('[DataGateway] Cache write failed after cleanup:', retryError)
    }
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache(): void {
  try {
    const keys = Object.keys(localStorage)
    const now = Date.now()

    for (const key of keys) {
      if (!key.startsWith(CACHE_PREFIX)) continue

      try {
        const cached = localStorage.getItem(key)
        if (!cached) continue

        const entry: CacheEntry<unknown> = JSON.parse(cached)
        if (now - entry.timestamp > entry.ttl) {
          localStorage.removeItem(key)
        }
      } catch {
        // Invalid cache entry, remove it
        localStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.warn('[DataGateway] Cache cleanup error:', error)
  }
}

/**
 * Make API request with error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  useCache = false,
  cacheKey?: string,
  cacheTtl?: number,
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}${endpoint}`

  // Check cache first if enabled
  if (useCache && cacheKey) {
    const cached = getCached<T>(cacheKey)
    if (cached !== null) {
      return { data: cached, cached: true }
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const text = await response.text()
      if (!response.ok) {
        throw new Error(text || `HTTP ${response.status}`)
      }
      return { data: text as unknown as T }
    }

    const data = await response.json()

    if (!response.ok) {
      const error: ApiError = {
        message: data.error || data.message || `HTTP ${response.status}`,
        status: response.status,
        code: data.code,
        details: data,
      }
      return { data: null as T, error }
    }

    // Cache successful responses
    if (useCache && cacheKey && cacheTtl) {
      setCached(cacheKey, data, cacheTtl)
    }

    return { data }
  } catch (error) {
    const apiError: ApiError = {
      message: error instanceof Error ? error.message : 'Network error',
      details: error,
    }
    return { data: null as T, error: apiError }
  }
}

// ============================================================================
// Data Gateway Class
// ============================================================================

export class DataGateway {
  // ==========================================================================
  // Products API
  // ==========================================================================

  /**
   * Get products from catalog
   */
  static async getProducts(
    options: GetProductsOptions = {},
  ): Promise<ApiResponse<Product[]>> {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit.toString())
    if (options.offset) params.set('offset', options.offset.toString())
    if (options.category) params.set('category', options.category)
    if (options.inStock !== undefined) {
      params.set('in_stock', options.inStock.toString())
    }
    if (options.search) params.set('search', options.search)

    const endpoint = `/api/catalog/products${params.toString() ? `?${params.toString()}` : ''}`
    const cacheKey = getCacheKey('products', options)

    const response = await apiRequest<unknown>(
      endpoint,
      { 
        signal: options.signal,
        headers: { accept: 'application/json' },
      },
      true,
      cacheKey,
      CACHE_TTL.products,
    )

    if (response.error) {
      return response as ApiResponse<Product[]>
    }

    // Transform API response to match Product type (same as dataAdapter)
    const body = response.data as any
    const products = Array.isArray(body) 
      ? body 
      : (Array.isArray(body?.products) ? body.products : [])

    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'

    const transformedProducts: Product[] = sanitizeBatch(products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price || 0,
      category: p.category || 'Uncategorized',
      stockCount: p.stock_count || 0,
      imageUrl: p.image_url || PLACEHOLDER_IMAGE,
      rating: p.rating || 0,
      reviewCount: p.review_count || 0,
    })))

    return { data: transformedProducts, cached: response.cached }
  }

  /**
   * Get single product by ID with optional Discogs enrichment
   * Uses the dedicated product detail endpoint which includes Discogs data
   */
  static async getProduct(id: string): Promise<ApiResponse<Product>> {
    const cacheKey = getCacheKey('product', { id })
    const cached = getCached<Product>(cacheKey)
    if (cached) {
      return { data: cached, cached: true }
    }

    // Use dedicated product detail endpoint (includes Discogs data if enabled)
    const endpoint = `/api/catalog/${id}`
    const response = await apiRequest<unknown>(
      endpoint,
      { 
        headers: { accept: 'application/json' },
      },
      true,
      cacheKey,
      CACHE_TTL.products,
    )

    if (response.error) {
      return response as ApiResponse<Product>
    }

    // Transform API response to match Product type
    const body = response.data as any
    const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'

    const product: Product = sanitizeBatch([{
      id: body.id,
      name: body.name,
      description: body.description || '',
      price: body.price || 0,
      category: body.category || 'Uncategorized',
      stockCount: body.stock_count || 0,
      imageUrl: body.image_url || PLACEHOLDER_IMAGE,
      rating: body.rating || 0,
      reviewCount: body.review_count || 0,
      // Discogs data (may be null/undefined if feature disabled or fetch failed)
      tracklist: body.tracklist || undefined,
    }])[0]

    setCached(cacheKey, product, CACHE_TTL.products)
    return { data: product, cached: response.cached }
  }

  // ==========================================================================
  // Orders API
  // ==========================================================================

  /**
   * Get user's orders
   */
  static async getOrders(): Promise<ApiResponse<Order[]>> {
    const cacheKey = getCacheKey('orders')
    return apiRequest<{ success: boolean; orders: Order[] }>(
      '/api/user/orders',
      { method: 'GET' },
      true,
      cacheKey,
      CACHE_TTL.orders,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<Order[]>
      }
      // Transform response to extract orders array
      const data = (response.data as { success: boolean; orders: Order[] })?.orders || []
      return { data, cached: response.cached }
    })
  }

  /**
   * Get single order by ID
   */
  static async getOrder(orderId: string): Promise<ApiResponse<Order>> {
    const cacheKey = getCacheKey('order', { id: orderId })
    return apiRequest<Order>(
      `/api/orders/${encodeURIComponent(orderId)}`,
      { method: 'GET' },
      true,
      cacheKey,
      CACHE_TTL.orders,
    )
  }

  /**
   * Lookup order by order number and email
   */
  static async lookupOrder(
    orderNumber: string,
    email: string,
  ): Promise<ApiResponse<Order>> {
    return apiRequest<{ success: boolean; order: Order }>(
      '/api/order/lookup',
      {
        method: 'POST',
        body: JSON.stringify({ orderNumber, email }),
      },
      false, // Don't cache guest lookups
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<Order>
      }
      const data = (response.data as { success: boolean; order: Order })?.order
      return { data: data as Order }
    })
  }

  // ==========================================================================
  // Auth API
  // ==========================================================================

  /**
   * Login user
   */
  static async login(
    email: string,
    password: string,
  ): Promise<ApiResponse<{ user: User; token?: string }>> {
    return apiRequest<{ success: boolean; user: User; token?: string }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false, // Don't cache auth responses
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<{ user: User; token?: string }>
      }
      const data = response.data as { success: boolean; user: User; token?: string }
      return { data: { user: data.user, token: data.token } }
    })
  }

  /**
   * Register new user
   */
  static async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<ApiResponse<{ user: User; token?: string }>> {
    return apiRequest<{ success: boolean; user: User; token?: string }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<{ user: User; token?: string }>
      }
      const data = response.data as { success: boolean; user: User; token?: string }
      return { data: { user: data.user, token: data.token } }
    })
  }

  /**
   * Get current user
   * Handles both Stack Auth format ({ user: User }) and email/password format ({ success: boolean, customer: {...} })
   */
  static async getCurrentUser(): Promise<ApiResponse<User>> {
    const cacheKey = getCacheKey('user')
    return apiRequest<{ user: User } | { success: boolean; customer: any } | User>(
      '/api/auth/me',
      { method: 'GET' },
      true,
      cacheKey,
      CACHE_TTL.user,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<User>
      }
      
      const data = response.data as any
      
      // Handle email/password auth format: { success: boolean, customer: {...} }
      if (data?.success && data.customer) {
        // Transform customer to User format for compatibility
        const customer = data.customer
        const user: User = {
          id: customer.id,
          email: customer.email,
          app_metadata: {},
          aud: 'authenticated',
          confirmation_sent_at: customer.createdAt || new Date().toISOString(),
          confirmed_at: customer.createdAt || new Date().toISOString(),
          created_at: customer.createdAt || new Date().toISOString(),
          phone: customer.phone || '',
          factor_count: 0,
          identities: [],
          invited_at: customer.createdAt || new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          phone_change_sent_at: null,
          role: customer.role || 'authenticated',
          updated_at: customer.updatedAt || new Date().toISOString(),
          user_metadata: {
            displayName: customer.firstName && customer.lastName
              ? `${customer.firstName} ${customer.lastName}`
              : customer.firstName || customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
          },
        }
        return { data: user, cached: response.cached }
      }
      
      // Handle Stack Auth format: { user: User } or direct User
      const user = 'user' in data ? data.user : data
      return { data: user as User, cached: response.cached }
    })
  }

  /**
   * Logout user
   */
  static async logout(): Promise<ApiResponse<void>> {
    // Clear all cached data on logout
    this.clearCache()
    return apiRequest<void>(
      '/api/auth/logout',
      { method: 'POST' },
      false,
    )
  }

  /**
   * Request password reset
   */
  static async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    return apiRequest<{ success: boolean; message: string }>(
      '/api/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<{ message: string }>
      }
      const data = response.data as { success: boolean; message: string }
      return { data: { message: data.message || 'Password reset email sent' } }
    })
  }

  // ==========================================================================
  // User/Profile API
  // ==========================================================================

  /**
   * Get user profile
   * Handles both direct UserProfile format and wrapped { success: boolean, customer: {...} } format
   */
  static async getProfile(): Promise<ApiResponse<UserProfile>> {
    const cacheKey = getCacheKey('profile')
    return apiRequest<UserProfile | { success: boolean; customer: any }>(
      '/api/user/profile',
      { method: 'GET' },
      true,
      cacheKey,
      CACHE_TTL.profile,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<UserProfile>
      }
      
      const data = response.data as any
      
      // Handle wrapped format: { success: boolean, customer: {...} }
      if (data?.success && data.customer) {
        const customer = data.customer
        const profile: UserProfile = {
          id: customer.id,
          email: customer.email,
          name: customer.firstName && customer.lastName
            ? `${customer.firstName} ${customer.lastName}`
            : customer.firstName || customer.email,
          phone: customer.phone,
          address: customer.address,
          created_at: customer.createdAt || customer.created_at || new Date().toISOString(),
        }
        return { data: profile, cached: response.cached }
      }
      
      // Handle direct UserProfile format
      return { data: data as UserProfile, cached: response.cached }
    })
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    updates: Partial<UserProfile>,
  ): Promise<ApiResponse<UserProfile>> {
    const response = await apiRequest<UserProfile>(
      '/api/user/profile',
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      false,
    )

    // Clear profile cache on update
    if (!response.error) {
      const cacheKey = getCacheKey('profile')
      localStorage.removeItem(cacheKey)
    }

    return response
  }

  /**
   * Update user password
   */
  static async updatePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiRequest<{ success: boolean; message: string }>(
      '/api/user/password',
      {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<{ message: string }>
      }
      const data = response.data as { success: boolean; message: string }
      return { data: { message: data.message || 'Password updated successfully' } }
    })
  }

  /**
   * Delete user account
   */
  static async deleteAccount(): Promise<ApiResponse<void>> {
    const response = await apiRequest<void>(
      '/api/user/delete-account',
      { method: 'DELETE' },
      false,
    )

    // Clear all cache on account deletion
    if (!response.error) {
      this.clearCache()
    }

    return response
  }

  // ==========================================================================
  // Cart API
  // ==========================================================================

  /**
   * Get user cart
   */
  static async getCart(): Promise<ApiResponse<CartItem[]>> {
    return apiRequest<{ success: boolean; cart: CartItem[] }>(
      '/api/user/cart',
      { method: 'GET' },
      false, // Don't cache cart (changes frequently)
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<CartItem[]>
      }
      const data = (response.data as { success: boolean; cart: CartItem[] })?.cart || []
      return { data }
    })
  }

  /**
   * Save cart to database
   */
  static async saveCart(items: CartItem[]): Promise<ApiResponse<void>> {
    const cartData = items.map((item) => ({
      sku: item.id,
      quantity: item.quantity,
    }))

    return apiRequest<{ success: boolean }>(
      '/api/user/cart',
      {
        method: 'POST',
        body: JSON.stringify({ items: cartData }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<void>
      }
      return { data: undefined as void }
    })
  }

  // ==========================================================================
  // Wishlist API
  // ==========================================================================

  /**
   * Get user wishlist
   */
  static async getWishlist(): Promise<ApiResponse<Product[]>> {
    return apiRequest<{ success: boolean; wishlist: Product[] }>(
      '/api/user/wishlist',
      { method: 'GET' },
      false, // Don't cache wishlist (changes frequently)
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<Product[]>
      }
      const data = (response.data as { success: boolean; wishlist: Product[] })?.wishlist || []
      return { data }
    })
  }

  /**
   * Add product to wishlist
   */
  static async addToWishlist(productId: string): Promise<ApiResponse<void>> {
    return apiRequest<{ success: boolean }>(
      '/api/user/wishlist',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'add', productId }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<void>
      }
      return { data: undefined as void }
    })
  }

  /**
   * Remove product from wishlist
   */
  static async removeFromWishlist(productId: string): Promise<ApiResponse<void>> {
    return apiRequest<{ success: boolean }>(
      '/api/user/wishlist',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'remove', productId }),
      },
      false,
    ).then((response) => {
      if (response.error) {
        return response as ApiResponse<void>
      }
      return { data: undefined as void }
    })
  }

  // ==========================================================================
  // Checkout API
  // ==========================================================================

  /**
   * Create checkout session
   */
  static async createCheckout(
    payload: CheckoutPayload,
  ): Promise<ApiResponse<CheckoutResponse>> {
    return apiRequest<CheckoutResponse>(
      '/api/checkout/create',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false,
    )
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  /**
   * Clear all cached data
   */
  static clearCache(): void {
    try {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('[DataGateway] Error clearing cache:', error)
    }
  }

  /**
   * Clear cache for specific resource
   */
  static clearCacheFor(resource: string): void {
    try {
      const keys = Object.keys(localStorage)
      const prefix = `${CACHE_PREFIX}${resource}`
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key)
        }
      }
    } catch (error) {
      console.warn('[DataGateway] Error clearing cache for resource:', error)
    }
  }

  /**
   * Invalidate cache (mark as expired)
   */
  static invalidateCache(resource?: string): void {
    if (resource) {
      this.clearCacheFor(resource)
    } else {
      this.clearCache()
    }
  }
}

// Export singleton instance for convenience
export default DataGateway

