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
  createdAt: string
  updatedAt: string
}

type OrderItem = {
  id: number
  productId: string
  productName: string
  quantity: number
  price: number
  subtotal: number
  imageUrl?: string
  category?: string
}

type ReturnRequest = {
  orderId: string
  orderNumber: string
  items: Array<{
    itemId: number
    productName: string
    quantity: number
    reason: string
  }>
  reason: string
  notes?: string
}

type ReturnsPageProps = {
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

const returnReasons = [
  'Defective or damaged item',
  'Wrong item received',
  'Item not as described',
  "Changed my mind / Don't need it",
  'Size doesn\'t fit',
  'Other',
]

export function ReturnsPage({
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
}: ReturnsPageProps) {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Map<number, { quantity: number; reason: string }>>(new Map())
  const [returnReason, setReturnReason] = useState('')
  const [returnNotes, setReturnNotes] = useState('')
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [isLoadingItems, setIsLoadingItems] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
            // Filter orders that are eligible for return (paid, completed, or ready for pickup)
            const eligibleOrders = data.orders.filter((order: Order) => {
              const status = order.status.toLowerCase()
              return ['paid', 'completed', 'ready for pickup', 'picked up'].includes(status)
            })
            setOrders(eligibleOrders)
          }
        } else {
          setError('Failed to load orders')
        }
      } catch (err) {
        console.error('[Returns] Error loading orders:', err)
        setError('Failed to load orders')
      } finally {
        setIsLoadingOrders(false)
      }
    }

    fetchOrders()
  }, [user, navigate])

  const handleSelectOrder = async (order: Order) => {
    try {
      setIsLoadingItems(true)
      setError(null)
      setSelectedOrder(order)
      setSelectedItems(new Map())

      const response = await fetch(`/api/user/order-detail?orderId=${order.id}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.order) {
          setOrderItems(data.order.items)
        }
      } else {
        setError('Failed to load order items')
      }
    } catch (err) {
      console.error('[Returns] Error loading order items:', err)
      setError('Failed to load order items')
    } finally {
      setIsLoadingItems(false)
    }
  }

  const handleToggleItem = (itemId: number, maxQuantity: number) => {
    const newSelected = new Map(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
    } else {
      newSelected.set(itemId, { quantity: 1, reason: '' })
    }
    setSelectedItems(newSelected)
  }

  const handleUpdateQuantity = (itemId: number, quantity: number, maxQuantity: number) => {
    if (quantity < 1 || quantity > maxQuantity) return
    const newSelected = new Map(selectedItems)
    const current = newSelected.get(itemId)
    if (current) {
      newSelected.set(itemId, { ...current, quantity })
    }
    setSelectedItems(newSelected)
  }

  const handleUpdateReason = (itemId: number, reason: string) => {
    const newSelected = new Map(selectedItems)
    const current = newSelected.get(itemId)
    if (current) {
      newSelected.set(itemId, { ...current, reason })
    }
    setSelectedItems(newSelected)
  }

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!selectedOrder) {
      setError('Please select an order')
      return
    }

    if (selectedItems.size === 0) {
      setError('Please select at least one item to return')
      return
    }

    // Validate all selected items have reasons
    for (const [itemId, data] of selectedItems.entries()) {
      if (!data.reason || data.reason.trim() === '') {
        setError('Please provide a reason for each item you want to return')
        return
      }
    }

    if (!returnReason || returnReason.trim() === '') {
      setError('Please provide a general reason for the return')
      return
    }

    setIsSubmitting(true)

    try {
      // Build return request
      const returnRequest: ReturnRequest = {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.orderNumber,
        items: Array.from(selectedItems.entries()).map(([itemId, data]) => {
          const item = orderItems.find(i => i.id === itemId)
          return {
            itemId,
            productName: item?.productName || 'Unknown Product',
            quantity: data.quantity,
            reason: data.reason,
          }
        }),
        reason: returnReason,
        notes: returnNotes.trim() || undefined,
      }

      // TODO: Create API endpoint for returns
      // For now, we'll just show a success message
      // In production, this would call /api/user/returns
      console.log('[Returns] Return request:', returnRequest)

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      setSuccess('Return request submitted successfully! We will review your request and contact you within 1-2 business days.')
      setSelectedOrder(null)
      setSelectedItems(new Map())
      setReturnReason('')
      setReturnNotes('')

      // Reload orders
      const response = await fetch('/api/user/orders', {
        method: 'GET',
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.orders) {
          const eligibleOrders = data.orders.filter((order: Order) => {
            const status = order.status.toLowerCase()
            return ['paid', 'completed', 'ready for pickup', 'picked up'].includes(status)
          })
          setOrders(eligibleOrders)
        }
      }
    } catch (err) {
      console.error('[Returns] Error submitting return:', err)
      setError('Failed to submit return request. Please try again or contact support.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const isOrderEligible = (order: Order) => {
    const status = order.status.toLowerCase()
    const orderDate = new Date(order.createdAt)
    const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
    return ['paid', 'completed', 'ready for pickup', 'picked up'].includes(status) && daysSinceOrder <= 30
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
            <h1 className="text-3xl font-semibold">Request a Return</h1>
            <p className="mt-2 text-sm text-slate-400">
              Select an order and items you'd like to return
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack || (() => navigate('/orders'))}
          >
            Back
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-400">
            {success}
          </div>
        )}

        {!selectedOrder ? (
          /* Order Selection */
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Select an Order</h2>
              <p className="mb-6 text-sm text-slate-400">
                Returns must be requested within 30 days of purchase. Select an order to begin.
              </p>

              {orders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/20 bg-white/5 p-12 text-center">
                  <p className="text-lg text-slate-300">No eligible orders found</p>
                  <p className="mt-2 text-sm text-slate-400">
                    You can only return items from orders that are paid, completed, or ready for pickup, and within 30 days of purchase.
                  </p>
                  <button
                    onClick={() => navigate('/orders')}
                    className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80"
                  >
                    View All Orders
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const eligible = isOrderEligible(order)
                    return (
                      <button
                        key={order.id}
                        onClick={() => eligible && handleSelectOrder(order)}
                        disabled={!eligible}
                        className={`w-full rounded-lg border p-4 text-left transition ${
                          eligible
                            ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            : 'border-white/5 bg-white/5 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">Order {order.orderNumber}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              Placed on {formatDate(order.createdAt)} • {moneyFormatter.format(order.total)}
                            </p>
                          </div>
                          {!eligible && (
                            <span className="text-xs text-slate-500">
                              Not eligible for return
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Return Form */
          <form onSubmit={handleSubmitReturn} className="space-y-6">
            {/* Selected Order Info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Order {selectedOrder.orderNumber}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Placed on {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrder(null)
                    setOrderItems([])
                    setSelectedItems(new Map())
                    setReturnReason('')
                    setReturnNotes('')
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
                >
                  Change Order
                </button>
              </div>
            </div>

            {/* Select Items */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Select Items to Return</h2>
              {isLoadingItems ? (
                <p className="text-slate-400">Loading items...</p>
              ) : (
                <div className="space-y-4">
                  {orderItems.map((item) => {
                    const isSelected = selectedItems.has(item.id)
                    const selectedData = selectedItems.get(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`rounded-lg border p-4 ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-white/10 bg-white/5'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleItem(item.id, item.quantity)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary"
                          />
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

                            {isSelected && (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Return Quantity
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.id, (selectedData?.quantity || 1) - 1, item.quantity)}
                                      disabled={(selectedData?.quantity || 1) <= 1}
                                      className="rounded border border-white/20 bg-white/5 px-3 py-1 text-sm disabled:opacity-50"
                                    >
                                      -
                                    </button>
                                    <span className="w-12 text-center text-sm">
                                      {selectedData?.quantity || 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.id, (selectedData?.quantity || 1) + 1, item.quantity)}
                                      disabled={(selectedData?.quantity || 1) >= item.quantity}
                                      className="rounded border border-white/20 bg-white/5 px-3 py-1 text-sm disabled:opacity-50"
                                    >
                                      +
                                    </button>
                                    <span className="ml-2 text-xs text-slate-400">
                                      of {item.quantity}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Reason for Return *
                                  </label>
                                  <select
                                    value={selectedData?.reason || ''}
                                    onChange={(e) => handleUpdateReason(item.id, e.target.value)}
                                    className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white focus:border-primary focus:outline-none"
                                    required
                                  >
                                    <option value="">Select a reason</option>
                                    {returnReasons.map((reason) => (
                                      <option key={reason} value={reason}>
                                        {reason}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* General Return Reason */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-xl font-semibold">Return Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    General Reason for Return *
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white focus:border-primary focus:outline-none"
                    required
                  >
                    <option value="">Select a reason</option>
                    {returnReasons.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    placeholder="Please provide any additional details about your return..."
                  />
                </div>
              </div>
            </div>

            {/* Return Policy Reminder */}
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-300">
                <strong>Return Policy:</strong> Returns must be requested within 30 days of purchase. 
                Items must be in original condition with all packaging. Refunds will be processed to the original payment method within 3-5 business days after we receive and inspect the returned items.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null)
                  setOrderItems([])
                  setSelectedItems(new Map())
                  setReturnReason('')
                  setReturnNotes('')
                }}
                className="flex-1 rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedItems.size === 0}
                className="flex-1 rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Return Request'}
              </button>
            </div>
          </form>
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

