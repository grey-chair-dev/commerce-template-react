import { useState, useMemo } from 'react'
import type { CartItem } from './CheckoutReviewPage'
import { moneyFormatter } from '../formatters'
import { sanitizeText } from '../utils/sanitize'

type Order = {
  orderNumber: string
  cartItems: CartItem[]
  shippingForm: any
  cartSubtotal: number
  estimatedShipping: number
  estimatedTax: number
  date: string
  status: 'confirmed' | 'packed' | 'shipped' | 'delivered'
}

type UserDashboardProps = {
  user: any
  onBack: () => void
  onViewOrder: (order: Order) => void
  onReOrder?: (order: Order) => void
}

type DashboardSection = 'overview' | 'orders' | 'addresses' | 'payment'

export function UserDashboard({
  user,
  onBack,
  onViewOrder,
  onReOrder,
}: UserDashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('overview')
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all')
  const [orderDateFilter, setOrderDateFilter] = useState<string>('all')

  // Load orders from localStorage
  const orders = useMemo(() => {
    try {
      const stored = localStorage.getItem('lct_orders')
      if (!stored) return []
      const ordersObj = JSON.parse(stored)
      return Object.values(ordersObj)
        .map((order: any) => ({
          ...order,
          date: new Date().toISOString(), // In production, this would come from the order
          status: 'confirmed' as const,
        }))
        .sort((a: any, b: any) => (b.date > a.date ? 1 : -1))
    } catch {
      return []
    }
  }, [])

  const latestOrder = orders[0] as Order | undefined
  const totalSpent = useMemo(() => {
    return orders.reduce((sum: number, order: any) => {
      return sum + order.cartSubtotal + order.estimatedShipping + order.estimatedTax
    }, 0)
  }, [orders])

  const totalOrders = orders.length

  const sections: { key: DashboardSection; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'orders', label: 'Order History', icon: '📦' },
    { key: 'addresses', label: 'Addresses', icon: '📍' },
    { key: 'payment', label: 'Payment Methods', icon: '💳' },
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">My Account</h1>
            <p className="mt-2 text-sm text-slate-400">
              Welcome back, {user?.user_metadata?.displayName || user?.email || 'User'}
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={onBack}
          >
            Back
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <div className="sticky top-8 space-y-2 rounded-3xl border border-white/10 bg-white/5 p-4">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => setActiveSection(section.key)}
                  className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    activeSection === section.key
                      ? 'bg-primary text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeSection === 'overview' && (
              <div className="space-y-6">
                {/* Activity Snapshot */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Total Orders
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">{totalOrders}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Total Spent
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {moneyFormatter.format(totalSpent)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Member Since
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {new Date().toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Latest Order */}
                {latestOrder ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Latest Order</h2>
                      <button
                        className="text-sm text-primary hover:text-primary/80"
                        onClick={() => {
                          setActiveSection('orders')
                          onViewOrder(latestOrder)
                        }}
                      >
                        View all
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">Order #{latestOrder.orderNumber}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(latestOrder.date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                          {latestOrder.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-3">
                        <span className="text-sm text-slate-300">
                          {latestOrder.cartItems.length} item
                          {latestOrder.cartItems.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-base font-semibold text-white">
                          {moneyFormatter.format(
                            latestOrder.cartSubtotal +
                              latestOrder.estimatedShipping +
                              latestOrder.estimatedTax,
                          )}
                        </span>
                      </div>
                      <button
                        className="w-full rounded-full border border-primary/60 px-4 py-2 text-sm font-semibold text-primary hover:border-primary"
                        onClick={() => onViewOrder(latestOrder)}
                      >
                        View Order Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                    <p className="text-slate-400">No orders yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Start shopping to see your order history here
                    </p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-left text-sm hover:border-white/40"
                      onClick={() => setActiveSection('orders')}
                    >
                      <p className="font-semibold text-white">View Order History</p>
                      <p className="mt-1 text-xs text-slate-400">See all your past orders</p>
                    </button>
                    <button
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-left text-sm hover:border-white/40"
                      onClick={() => setActiveSection('addresses')}
                    >
                      <p className="font-semibold text-white">Manage Addresses</p>
                      <p className="mt-1 text-xs text-slate-400">Add or edit shipping addresses</p>
                    </button>
                    <button
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-left text-sm hover:border-white/40"
                      onClick={() => setActiveSection('payment')}
                    >
                      <p className="font-semibold text-white">Payment Methods</p>
                      <p className="mt-1 text-xs text-slate-400">Manage saved cards</p>
                    </button>
                    <button
                      className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-left text-sm hover:border-white/40"
                      onClick={onBack}
                    >
                      <p className="font-semibold text-white">Continue Shopping</p>
                      <p className="mt-1 text-xs text-slate-400">Browse the catalog</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'orders' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold">Order History</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    View and track all your past orders
                  </p>
                </div>

                {/* Search and Filters */}
                {orders.length > 0 && (
                  <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder="Search by order number or product name..."
                        className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 pr-10 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                      <svg
                        className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setOrderStatusFilter('all')}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          orderStatusFilter === 'all'
                            ? 'bg-primary text-white'
                            : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                        }`}
                      >
                        All Status
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('confirmed')}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          orderStatusFilter === 'confirmed'
                            ? 'bg-primary text-white'
                            : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                        }`}
                      >
                        Confirmed
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('packed')}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          orderStatusFilter === 'packed'
                            ? 'bg-primary text-white'
                            : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                        }`}
                      >
                        Packed
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('shipped')}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          orderStatusFilter === 'shipped'
                            ? 'bg-primary text-white'
                            : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                        }`}
                      >
                        Shipped
                      </button>
                      <button
                        onClick={() => setOrderStatusFilter('delivered')}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          orderStatusFilter === 'delivered'
                            ? 'bg-primary text-white'
                            : 'border border-white/20 bg-white/5 text-slate-300 hover:border-white/40'
                        }`}
                      >
                        Delivered
                      </button>
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300">Date:</label>
                      <select
                        value={orderDateFilter}
                        onChange={(e) => setOrderDateFilter(e.target.value)}
                        className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      >
                        <option value="all">All Time</option>
                        <option value="week">Last Week</option>
                        <option value="month">Last Month</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="year">Last Year</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Filtered Orders */}
                {(() => {
                  const filteredOrders = useMemo(() => {
                    let filtered = orders

                    // Filter by status
                    if (orderStatusFilter !== 'all') {
                      filtered = filtered.filter((order: any) => order.status === orderStatusFilter)
                    }

                    // Filter by date
                    if (orderDateFilter !== 'all') {
                      const now = new Date()
                      const cutoffDate = new Date()
                      switch (orderDateFilter) {
                        case 'week':
                          cutoffDate.setDate(now.getDate() - 7)
                          break
                        case 'month':
                          cutoffDate.setMonth(now.getMonth() - 1)
                          break
                        case '3months':
                          cutoffDate.setMonth(now.getMonth() - 3)
                          break
                        case 'year':
                          cutoffDate.setFullYear(now.getFullYear() - 1)
                          break
                      }
                      filtered = filtered.filter((order: any) => {
                        const orderDate = new Date(order.date || Date.now())
                        return orderDate >= cutoffDate
                      })
                    }

                    // Filter by search query
                    if (orderSearchQuery.trim()) {
                      const query = sanitizeText(orderSearchQuery).toLowerCase()
                      filtered = filtered.filter((order: any) => {
                        // Search by order number
                        if (order.orderNumber.toLowerCase().includes(query)) {
                          return true
                        }
                        // Search by product names
                        return order.cartItems.some((item: CartItem) =>
                          item.name.toLowerCase().includes(query),
                        )
                      })
                    }

                    return filtered
                  }, [orders, orderStatusFilter, orderDateFilter, orderSearchQuery])

                  return filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                      {filteredOrders.map((order: any) => (
                        <div
                          key={order.orderNumber}
                          className="rounded-2xl border border-white/10 bg-white/5 p-6"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <p className="font-semibold text-white">
                                  Order #{order.orderNumber}
                                </p>
                                <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                                  {order.status}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-400">
                                {new Date(order.date || Date.now()).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="mt-2 text-sm text-slate-300">
                                {order.cartItems.length} item
                                {order.cartItems.length !== 1 ? 's' : ''} ·{' '}
                                {moneyFormatter.format(
                                  order.cartSubtotal +
                                    order.estimatedShipping +
                                    order.estimatedTax,
                                )}
                              </p>
                              {/* Product preview */}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {order.cartItems.slice(0, 3).map((item: CartItem) => (
                                  <span
                                    key={item.id}
                                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                                  >
                                    {item.name} × {item.quantity}
                                  </span>
                                ))}
                                {order.cartItems.length > 3 && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                                    +{order.cartItems.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              {onReOrder && (
                                <button
                                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/80"
                                  onClick={() => onReOrder(order)}
                                >
                                  Buy Again
                                </button>
                              )}
                              <button
                                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
                                onClick={() => onViewOrder(order)}
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                      <p className="text-slate-400">
                        {orders.length === 0
                          ? 'No orders found'
                          : 'No orders match your filters'}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {orders.length === 0
                          ? 'Your order history will appear here once you place an order'
                          : 'Try adjusting your search or filter criteria'}
                      </p>
                    </div>
                  )
                })()}
              </div>
            )}

            {activeSection === 'addresses' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold">Saved Addresses</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Manage your shipping addresses for faster checkout
                  </p>
                </div>

                {orders.length > 0 ? (
                  <div className="space-y-4">
                    {Array.from(
                      new Map(
                        orders.map((order: any) => [
                          `${order.shippingForm.address}-${order.shippingForm.zipCode}`,
                          order.shippingForm,
                        ]),
                      ).values(),
                    ).map((address: any, index) => (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/10 bg-white/5 p-6"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 text-sm">
                            <p className="font-semibold text-white">
                              {address.firstName} {address.lastName}
                            </p>
                            <p className="text-slate-300">{address.address}</p>
                            <p className="text-slate-300">
                              {address.city}, {address.state} {address.zipCode}
                            </p>
                            {address.phone && <p className="text-slate-400">{address.phone}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/40">
                              Edit
                            </button>
                            <button className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:border-white/40">
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                    <p className="text-slate-400">No saved addresses</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Addresses will be saved automatically after your first order
                    </p>
                  </div>
                )}

                <button className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary hover:border-primary">
                  Add New Address
                </button>
              </div>
            )}

            {activeSection === 'payment' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold">Payment Methods</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Manage your saved payment methods for faster checkout
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
                  <p className="text-slate-400">No saved payment methods</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Payment methods will be saved securely after your first order
                  </p>
                </div>

                <button className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary hover:border-primary">
                  Add Payment Method
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

