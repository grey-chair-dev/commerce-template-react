import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { moneyFormatter } from '../formatters'
import { siteConfig } from '../config'
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
  pickupDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  itemCount: number
  createdAt: string
  updatedAt: string
}

type OrderDetail = {
  id: string
  orderNumber: string
  status: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  shippingMethod: string
  pickupDetails?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  items: Array<{
    id: number
    productId: string
    productName: string
    quantity: number
    price: number
    subtotal: number
    imageUrl?: string
    category?: string
  }>
  createdAt: string
  updatedAt: string
}

type OrdersPageProps = {
  user?: { id: string; email: string; firstName?: string; lastName?: string } | null
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  productsLoading?: boolean
  productsError?: Error | null
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
  onBack?: () => void
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  confirmed: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  paid: 'bg-green-500/20 text-green-400 border-green-500/50',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/50',
  completed: 'bg-green-500/20 text-green-400 border-green-500/50',
  'ready for pickup': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
  'picked up': 'bg-slate-500/20 text-slate-400 border-slate-500/50',
  processing: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  paid: 'Paid',
  cancelled: 'Cancelled',
  completed: 'Completed',
  'ready for pickup': 'Ready for Pickup',
  'picked up': 'Picked Up',
  processing: 'Processing',
}

export function OrdersPage({
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  productsLoading = false,
  productsError = null,
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
  onBack,
}: OrdersPageProps) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load orders
  useEffect(() => {
    if (!user?.id) {
      navigate('/login')
      return
    }

    const fetchOrders = async () => {
      try {
        setIsLoadingOrders(true)
        setError(null)
        const response = await fetch('/api/user/orders', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.orders) {
            setOrders(data.orders)
          }
        } else {
          setError('Failed to load orders')
        }
      } catch (err) {
        console.error('[Orders] Error loading orders:', err)
        setError('Failed to load orders')
      } finally {
        setIsLoadingOrders(false)
      }
    }

    fetchOrders()
  }, [user, navigate])

  const handleViewOrderDetail = async (orderId: string) => {
    try {
      setIsLoadingOrderDetail(true)
      const response = await fetch(`/api/user/order-detail?orderId=${orderId}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.order) {
          setSelectedOrder(data.order)
        }
      } else {
        setError('Failed to load order details')
      }
    } catch (err) {
      console.error('[Orders] Error loading order detail:', err)
      setError('Failed to load order details')
    } finally {
      setIsLoadingOrderDetail(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  if (isLoadingOrders) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <Header
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          onSignIn={() => navigate('/login')}
          onSignOut={onSignOut}
          onAccount={onAccount}
          onCart={onCart}
          onWishlist={onWishlist}
          onSearch={onSearch}
          onProductSelect={onProductSelect}
        />
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 pt-40 pb-8 sm:px-6 sm:pt-48 lg:px-8 lg:pt-56">
          <p className="text-slate-400">Loading orders...</p>
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={() => navigate('/login')}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
      />
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pt-40 pb-8 sm:px-6 sm:pt-48 lg:px-8 lg:pt-56">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Order History</h1>
            <p className="mt-2 text-sm text-slate-400">
              View and track all your past pickup orders
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack || (() => navigate('/profile'))}
          >
            Back
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
            <p className="text-lg text-slate-300">No orders found</p>
            <p className="mt-2 text-sm text-slate-400">
              Your order history will appear here once you place an order.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-white/20"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="text-lg font-semibold">Order {order.orderNumber}</h3>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          statusColors[order.status.toLowerCase()] ||
                          'bg-slate-500/20 text-slate-400 border-slate-500/50'
                        }`}
                      >
                        {statusLabels[order.status.toLowerCase()] || order.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Placed on {formatDate(order.createdAt)}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} • {order.shippingMethod === 'pickup' ? 'Store Pickup' : 'Delivery'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 sm:items-end">
                    <p className="text-lg font-semibold">{moneyFormatter.format(order.total)}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewOrderDetail(order.id)}
                        disabled={isLoadingOrderDetail}
                        className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-50"
                      >
                        {isLoadingOrderDetail ? 'Loading...' : 'View Details'}
                      </button>
                      {['paid', 'completed', 'ready for pickup', 'picked up'].includes(order.status.toLowerCase()) && (
                        <button
                          onClick={() => navigate('/returns')}
                          className="rounded-full border border-primary/50 bg-primary/20 px-4 py-2 text-sm text-primary hover:bg-primary/30"
                        >
                          Return
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Order Detail Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-surface p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Order {selectedOrder.orderNumber}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Placed on {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
                >
                  Close
                </button>
              </div>

              {/* Order Status */}
              <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Order Status</p>
                    <p className="mt-1 text-lg font-semibold">
                      {statusLabels[selectedOrder.status.toLowerCase()] || selectedOrder.status}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                      statusColors[selectedOrder.status.toLowerCase()] ||
                      'bg-slate-500/20 text-slate-400 border-slate-500/50'
                    }`}
                  >
                    {statusLabels[selectedOrder.status.toLowerCase()] || selectedOrder.status}
                  </span>
                </div>
              </div>

              {/* Items Purchased */}
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold">Items Purchased</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{item.productName}</p>
                        {item.category && (
                          <p className="text-xs text-slate-400">{item.category}</p>
                        )}
                        <p className="mt-1 text-sm text-slate-300">
                          Quantity: {item.quantity} × {moneyFormatter.format(item.price)} = {moneyFormatter.format(item.subtotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pickup Details */}
              {selectedOrder.shippingMethod === 'pickup' && (
                <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Pickup Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Pickup Location</p>
                      <p className="mt-1 text-sm text-white">{siteConfig.contact.location}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Store Hours</p>
                      <p className="mt-1 text-sm text-white">{siteConfig.contact.hours}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Contact</p>
                      <p className="mt-1 text-sm text-white">
                        <a href={`tel:${siteConfig.contact.phone}`} className="text-primary hover:underline">
                          {siteConfig.contact.phone}
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Information Used */}
              {selectedOrder.pickupDetails && (
                <div className="mb-6 rounded-lg border border-white/10 bg-white/5 p-4">
                  <h3 className="mb-4 text-lg font-semibold">Customer Information Used</h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-slate-400">Name:</span>{' '}
                      <span className="text-white">
                        {selectedOrder.pickupDetails.firstName} {selectedOrder.pickupDetails.lastName}
                      </span>
                    </p>
                    {selectedOrder.pickupDetails.email && (
                      <p>
                        <span className="text-slate-400">Email:</span>{' '}
                        <span className="text-white">{selectedOrder.pickupDetails.email}</span>
                      </p>
                    )}
                    {selectedOrder.pickupDetails.phone && (
                      <p>
                        <span className="text-slate-400">Phone:</span>{' '}
                        <span className="text-white">{selectedOrder.pickupDetails.phone}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <h3 className="mb-4 text-lg font-semibold">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subtotal:</span>
                    <span className="text-white">{moneyFormatter.format(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Shipping:</span>
                      <span className="text-white">{moneyFormatter.format(selectedOrder.shipping)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tax:</span>
                    <span className="text-white">{moneyFormatter.format(selectedOrder.tax)}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold">
                    <span>Total:</span>
                    <span>{moneyFormatter.format(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>
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
