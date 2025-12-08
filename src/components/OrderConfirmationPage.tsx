import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CartItem } from './CheckoutReviewPage'
import { moneyFormatter } from '../formatters'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ContactForm = {
  email: string
  firstName: string
  lastName: string
  phone: string
  pickupLocation?: string
}

type OrderData = {
  id: string
  order_number: string
  square_order_id?: string
  customer: {
    name: {
      first: string
      last: string
      full: string
    }
    email: string
    phone: string
  }
  status: string
  subtotal: number
  tax: number
  total: number
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
  items: Array<{
    id: number
    product_id: string
    product_name: string
    quantity: number
    price: number
    subtotal: number
    image_url: string
    category: string
  }>
  created_at: string
}

type OrderConfirmationPageProps = {
  orderNumber?: string
  cartItems?: CartItem[]
  contactForm?: ContactForm
  cartSubtotal?: number
  estimatedTax?: number
  user?: any
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onViewOrderStatus: () => void
  onGoToDashboard: () => void
  onContinueShopping: () => void
  onSignIn?: () => void
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

export function OrderConfirmationPage({
  orderNumber: propOrderNumber,
  cartItems: propCartItems,
  contactForm: propContactForm,
  cartSubtotal: propCartSubtotal,
  estimatedTax: propEstimatedTax,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onViewOrderStatus,
  onGoToDashboard,
  onContinueShopping,
  onSignIn,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onSearch,
  onProductSelect,
  onTrackOrder,
  onContactUs,
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: OrderConfirmationPageProps) {
  const [searchParams] = useSearchParams()
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get orderId from URL parameter
  const orderId = searchParams.get('id') || searchParams.get('orderId')

  // Fetch order data from secure endpoint
  useEffect(() => {
    if (!orderId) {
      // If no orderId in URL and no props provided, show error
      if (!propOrderNumber) {
        setError('Order ID is required')
        setLoading(false)
        return
      }
      // Use props if provided (backward compatibility)
      setLoading(false)
      return
    }

    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        setError(null)

        // Determine API base URL
        // Fix for Error -107: Always use HTTP for localhost to avoid SSL errors
        // This is critical - the API request to fetch order details must use HTTP
        const isLocalDev = typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        
        // ALWAYS use HTTP for localhost API calls (even if page is on HTTPS due to HSTS)
        // This prevents Error -107 when fetching order details from the database
        let apiBaseUrl
        if (isLocalDev) {
          // For localhost, always use HTTP (ignore VITE_API_URL if it's HTTPS)
          const envUrl = import.meta.env.VITE_API_URL
          if (envUrl && envUrl.startsWith('http://')) {
            apiBaseUrl = envUrl
          } else {
            // Force HTTP for localhost
            apiBaseUrl = 'http://localhost:3000'
          }
          console.log('[Order Confirmation] Using HTTP for localhost API:', apiBaseUrl)
        } else {
          // Production: use window.location.origin (will be HTTPS)
          apiBaseUrl = typeof window !== 'undefined' 
            ? window.location.origin 
            : 'http://localhost:3000'
        }

        // Fetch order details from database via API
        // This is the API request that was causing Error -107
        const apiUrl = `${apiBaseUrl}/api/order/details?orderId=${encodeURIComponent(orderId)}`
        console.log('[Order Confirmation] Fetching order details from API:', apiUrl)
        
        let response
        try {
          response = await fetch(apiUrl, {
            method: 'GET',
            credentials: 'include', // Include cookies for authentication
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (fetchError) {
          // Handle SSL/HTTPS errors (Error -107)
          // This happens when browser forces HTTPS but server only serves HTTP
          const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
          console.error('[Order Confirmation] API request failed:', errorMsg)
          
          if (errorMsg.includes('SSL') || 
              errorMsg.includes('TLS') || 
              errorMsg.includes('certificate') ||
              errorMsg.includes('ERR_SSL') ||
              errorMsg.includes('ERR_CERT') ||
              errorMsg.includes('Failed to fetch') ||
              errorMsg.includes('net::ERR')) {
            console.warn('[Order Confirmation] SSL/HTTPS error detected (Error -107), retrying with explicit HTTP')
            // Retry with explicit HTTP (force protocol)
            const httpUrl = apiUrl.replace('https://', 'http://')
            try {
              response = await fetch(httpUrl, {
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
              })
              console.log('[Order Confirmation] HTTP retry successful')
            } catch (retryError) {
              const retryMsg = retryError instanceof Error ? retryError.message : String(retryError)
              console.error('[Order Confirmation] HTTP retry also failed:', retryMsg)
              throw new Error(`Failed to connect to API server. Please ensure the server is running on http://localhost:3000. Error: ${retryMsg}`)
            }
          } else {
            throw fetchError
          }
        }
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Order not found. Please check your order ID and try again.')
          } else {
            setError('Failed to load order details. Please try again later.')
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        
        // Check if order status indicates payment failure
        if (data.status === 'cancelled' || data.status === 'failed') {
          setError('Payment was declined. Your order was not processed. Please try again with a different payment method.')
          setLoading(false)
          return
        }
        
        setOrderData(data)
      } catch (err) {
        console.error('[Order Confirmation] Error fetching order:', err)
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        
        // Provide helpful error message for SSL/HTTPS issues (Error -107)
        if (errorMessage.includes('SSL') || 
            errorMessage.includes('TLS') || 
            errorMessage.includes('certificate') ||
            errorMessage.includes('ERR_SSL') ||
            errorMessage.includes('Failed to fetch')) {
          setError('Connection error (Error -107). The browser may be forcing HTTPS. Please try accessing http://localhost:3000 directly, or clear your browser\'s HSTS settings for localhost. See BROWSER_HSTS_FIX.md for details.')
        } else {
          setError(`Failed to load order details: ${errorMessage}`)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId])

  // Use fetched data or fall back to props
  const orderNumber = orderData?.order_number || propOrderNumber || ''
  const cartItems = orderData?.items.map(item => ({
    id: item.product_id,
    name: item.product_name,
    price: item.price,
    quantity: item.quantity,
    imageUrl: item.image_url,
    category: item.category,
    stockCount: 0,
  })) || propCartItems || []
  const cartSubtotal = orderData?.subtotal || propCartSubtotal || 0
  const estimatedTax = orderData?.tax || propEstimatedTax || 0
  const total = cartSubtotal + estimatedTax

  // Build contact form from order data or use props
  const contactForm: ContactForm = orderData ? {
    email: orderData.customer.email || orderData.pickup_details?.email || '',
    firstName: orderData.customer.name.first || orderData.pickup_details?.firstName || '',
    lastName: orderData.customer.name.last || orderData.pickup_details?.lastName || '',
    phone: orderData.customer.phone || orderData.pickup_details?.phone || '',
  } : (propContactForm || {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  })

  const handlePrintReceipt = () => {
    window.print()
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <Header
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          onSignIn={onSignIn || (() => {})}
          onSignOut={onSignOut || (() => {})}
          onAccount={onAccount || (() => {})}
          onCart={onCart || (() => {})}
          onWishlist={onWishlist || (() => {})}
          onSearch={onSearch || (() => {})}
          onProductSelect={onProductSelect || (() => {})}
        />
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-8 pt-40 sm:pt-48 md:pt-56">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-lg font-semibold">Loading order details...</p>
          </div>
        </div>
        <Footer
          orderTrackingEnabled={orderTrackingEnabled}
          onTrackOrder={onTrackOrder || (() => {})}
          onContactUs={onContactUs || (() => {})}
          onAboutUs={onAboutUs}
          onShippingReturns={onShippingReturns}
          onPrivacyPolicy={onPrivacyPolicy}
          onTermsOfService={onTermsOfService}
        />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
        <Header
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          onSignIn={onSignIn || (() => {})}
          onSignOut={onSignOut || (() => {})}
          onAccount={onAccount || (() => {})}
          onCart={onCart || (() => {})}
          onWishlist={onWishlist || (() => {})}
          onSearch={onSearch || (() => {})}
          onProductSelect={onProductSelect || (() => {})}
        />
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 py-8 pt-40 sm:pt-48 md:pt-56">
          <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
              <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-red-400">Error Loading Order</h1>
            <p className="mb-6 text-slate-300">{error}</p>
            <button
              onClick={onContinueShopping}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-brand hover:bg-primary/90"
            >
              Return to Home
            </button>
          </div>
        </div>
        <Footer
          orderTrackingEnabled={orderTrackingEnabled}
          onTrackOrder={onTrackOrder || (() => {})}
          onContactUs={onContactUs || (() => {})}
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
      {/* Header */}
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={onSignIn || (() => {})}
        onSignOut={onSignOut || (() => {})}
        onAccount={onAccount || (() => {})}
        onCart={onCart || (() => {})}
        onWishlist={onWishlist || (() => {})}
        onSearch={onSearch || (() => {})}
        onProductSelect={onProductSelect || (() => {})}
      />
      
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8 sm:px-6 lg:px-8 pt-40 sm:pt-48 md:pt-56">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <svg
              className="h-8 w-8 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold">Thank You, Your Order is Confirmed!</h1>
          <p className="mt-2 text-sm text-slate-400">
            Thank you for your purchase. We've received your order and will send you a confirmation
            email shortly.
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-sm font-semibold text-primary">Order #{orderNumber}</p>
            {orderData?.square_order_id && (
              <p className="text-xs text-slate-400">Square Order ID: {orderData.square_order_id}</p>
            )}
            {orderData?.id && (
              <p className="text-xs text-slate-400">Internal Order ID: {orderData.id.substring(0, 8)}...</p>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-8 lg:flex-row">
          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Order summary */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
              <div className="space-y-4">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          Qty: {item.quantity} × {moneyFormatter.format(item.price)}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold">
                      {moneyFormatter.format(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span>{moneyFormatter.format(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Tax</span>
                  <span>{moneyFormatter.format(estimatedTax)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
                  <span>Total</span>
                  <span>{moneyFormatter.format(total)}</span>
                </div>
              </div>
            </div>

            {/* Pickup Information */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">
                Pickup Information
              </h2>
              <div className="space-y-1 text-sm text-slate-300">
                {/* Customer Name */}
                {(contactForm.firstName || contactForm.lastName) && (
                  <p className="font-medium text-white">
                    {contactForm.firstName || ''} {contactForm.lastName || ''}
                  </p>
                )}
                
                {/* Pickup Instructions */}
                <div className="mt-4 space-y-2">
                  <p className="font-medium text-white">Store Location</p>
                  <p className="text-base">118 Grove St, San Francisco, CA 94102</p>
                  <p className="text-sm text-slate-400 mt-1">Hours: Open daily · 8a - 8p</p>
                </div>
                
                {/* Pickup Status */}
                {orderData?.pickup_status && (
                  <div className={`mt-4 rounded-lg border p-3 ${
                    orderData.pickup_status.status === 'ready' 
                      ? 'border-green-500/30 bg-green-500/10' 
                      : 'border-primary/30 bg-primary/10'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      orderData.pickup_status.status === 'ready' ? 'text-green-400' : 'text-primary'
                    }`}>
                      {orderData.pickup_status.message}
                    </p>
                  </div>
                )}
                
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                  <p className="text-sm font-medium text-primary mb-2">What to Bring</p>
                  <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                    <li>Your Order ID: <span className="font-medium text-white">{orderNumber}</span></li>
                    <li>Valid Photo ID for verification</li>
                  </ul>
                </div>
                
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-medium text-white mb-1">Pickup Notifications</p>
                  <p className="text-xs text-slate-300">
                    We'll notify you at <span className="font-medium">{contactForm.email || 'your email'}</span> when your order is ready for pickup.
                  </p>
                  {contactForm.phone && (
                    <p className="text-xs text-slate-300 mt-1">
                      We may also contact you at <span className="font-medium">{contactForm.phone}</span> if needed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                onClick={onViewOrderStatus}
              >
                View Order Status
              </button>
              <button
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={onGoToDashboard}
              >
                Go to Dashboard
              </button>
              <button
                className="flex-1 rounded-full border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 hover:border-white/40"
                onClick={handlePrintReceipt}
              >
                Print Receipt
              </button>
            </div>

            <button
              className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary hover:border-primary"
              onClick={onContinueShopping}
            >
              Continue Shopping
            </button>
          </div>

          {/* Sidebar with next steps */}
          <div className="lg:w-80">
            <div className="sticky top-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">What's Next?</h2>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-white">Confirmation Email</p>
                    <p className="text-xs text-slate-400">
                      Check your inbox at {contactForm.email} for order details and tracking
                      information.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-white">Order Processing</p>
                    <p className="text-xs text-slate-400">
                      Your order will be processed within 1-2 business days.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-white">Pickup Notification</p>
                    <p className="text-xs text-slate-400">
                      You'll receive an email notification when your order is ready for pickup at the store.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder || (() => {})}
        onContactUs={onContactUs || (() => {})}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}

