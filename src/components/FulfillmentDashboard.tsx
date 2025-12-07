import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { moneyFormatter } from '../formatters'
import type { Product } from '../dataAdapter'

type Order = {
  id: string
  orderNumber: string
  status: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  shippingMethod: string
  itemCount: number
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  pickupDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  createdAt: string
  updatedAt: string
}

type FulfillmentDashboardProps = {
  user?: any
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onSignOut?: () => void
  onAccount?: () => void
  onCart?: () => void
  onWishlist?: () => void
  onSearch?: () => void
  onProductSelect?: (product: Product) => void
  onTrackOrder?: () => void
  onContactUs?: () => void
  onAboutUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

const ORDER_STATUSES = [
  'in progress',
  'ready',
  'picked up',
]

const STATUS_COLORS: Record<string, string> = {
  'in progress': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  'ready': 'bg-primary/20 text-primary border-primary/50',
  'picked up': 'bg-green-500/20 text-green-400 border-green-500/50',
}

// Map database statuses to display statuses
const STATUS_MAP: Record<string, string> = {
  'pending': 'in progress',
  'processing': 'in progress',
  'confirmed': 'in progress',
  'paid': 'in progress',
  'ready for pickup': 'ready',
  'picked up': 'picked up',
  'shipped': 'picked up',
  'delivered': 'picked up',
  'cancelled': 'in progress',
  'refunded': 'in progress',
}

export function FulfillmentDashboard({
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onSignOut = () => {},
  onAccount = () => {},
  onCart = () => {},
  onWishlist = () => {},
  onSearch = () => {},
  onProductSelect = () => {},
  onTrackOrder = () => {},
  onContactUs = () => {},
  onAboutUs = () => {},
  onShippingReturns = () => {},
  onPrivacyPolicy = () => {},
  onTermsOfService = () => {},
}: FulfillmentDashboardProps) {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Store admin password in sessionStorage (not localStorage for security)
  useEffect(() => {
    const storedPassword = sessionStorage.getItem('admin_password')
    if (storedPassword) {
      setIsAuthenticated(true)
      loadOrders(storedPassword)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError(null)

    try {
      // Test password by making a request
      const response = await fetch('/api/admin/orders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        setIsAuthenticated(true)
        sessionStorage.setItem('admin_password', password)
        await loadOrders(password)
      } else {
        const data = await response.json()
        setLoginError(data.message || 'Invalid password')
      }
    } catch (err) {
      console.error('[Fulfillment Dashboard] Login error:', err)
      setLoginError('Failed to authenticate. Please try again.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const loadOrders = async (adminPassword: string) => {
    setIsLoadingOrders(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${adminPassword}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.orders) {
          setOrders(data.orders)
        }
      } else {
        if (response.status === 401) {
          // Password expired or invalid
          setIsAuthenticated(false)
          sessionStorage.removeItem('admin_password')
          setError('Session expired. Please log in again.')
        } else {
          setError('Failed to load orders')
        }
      }
    } catch (err) {
      console.error('[Fulfillment Dashboard] Error loading orders:', err)
      setError('Failed to load orders')
    } finally {
      setIsLoadingOrders(false)
    }
  }

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdatingOrderId(orderId)
    setError(null)

    const adminPassword = sessionStorage.getItem('admin_password')
    if (!adminPassword) {
      setError('Session expired. Please log in again.')
      setIsAuthenticated(false)
      return
    }

    try {
      console.log('[Fulfillment Dashboard] Updating order status:', { orderId, newStatus })
      
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${adminPassword}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()
      console.log('[Fulfillment Dashboard] Update response:', { status: response.status, data })

      if (response.ok) {
        // Update the order in local state immediately for better UX
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order.id === orderId 
              ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
              : order
          )
        )
        // Also reload orders to get fresh data
        await loadOrders(adminPassword)
      } else {
        setError(data.message || 'Failed to update order status')
        console.error('[Fulfillment Dashboard] Update failed:', data)
        
        if (response.status === 401) {
          setIsAuthenticated(false)
          sessionStorage.removeItem('admin_password')
        }
      }
    } catch (err) {
      console.error('[Fulfillment Dashboard] Error updating status:', err)
      setError(`Failed to update order status: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('admin_password')
    setPassword('')
    setOrders([])
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  // Login form
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4">
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-8">
            <h1 className="mb-2 text-2xl font-semibold">Fulfillment Dashboard</h1>
            <p className="mb-6 text-sm text-slate-400">
              Enter admin password to access order management
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  placeholder="Enter password"
                  required
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full rounded-full bg-primary px-4 py-3 font-semibold text-white shadow-brand hover:bg-primary/80 disabled:opacity-50"
              >
                {isLoggingIn ? 'Logging in...' : 'Log In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Dashboard
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={() => {}}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
      />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pt-40 pb-8 sm:px-6 sm:pt-48 lg:px-8 lg:pt-56">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Fulfillment Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage unfulfilled orders and update order status
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
          >
            Log Out
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Orders List */}
        {isLoadingOrders ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-slate-400">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-12 text-center">
            <p className="text-lg text-slate-300">No unfulfilled orders</p>
            <p className="mt-2 text-sm text-slate-400">
              All orders have been fulfilled or cancelled.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-lg font-semibold">Order {order.orderNumber}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[STATUS_MAP[order.status.toLowerCase()] || order.status.toLowerCase()] ||
                          'bg-slate-500/20 text-slate-400 border-slate-500/50'
                        }`}
                      >
                        {STATUS_MAP[order.status.toLowerCase()] || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Placed on {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} • {order.shippingMethod === 'pickup' ? 'Store Pickup' : 'Delivery'}
                    </p>
                    <div className="mt-3 text-sm">
                      <p className="text-slate-300">
                        <span className="font-medium">Customer:</span>{' '}
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      <p className="text-slate-400">{order.customer.email}</p>
                      {order.customer.phone && (
                        <p className="text-slate-400">{order.customer.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3 lg:items-end">
                    <p className="text-lg font-semibold">{moneyFormatter.format(order.total)}</p>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-400">Update Status</label>
                      <select
                        value={STATUS_MAP[order.status.toLowerCase()] || 'in progress'}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none disabled:opacity-50"
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {updatingOrderId === order.id && (
                        <p className="text-xs text-slate-400">Updating...</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}

