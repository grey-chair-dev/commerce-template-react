import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { featureFlags, siteConfig } from './config'
import {
  subscribeToProducts,
  fetchProductsFromCatalog,
  type Product,
  checkAdapterHealth,
  type ConnectionMode,
} from './dataAdapter'
import { initClientMonitors, reportClientError, trackMetric } from './monitoring'
import { useStackAuth, useUser } from './auth/StackAuthProvider'
import { SearchOverlay } from './components/SearchOverlay'
import { ProductDetailView } from './components/ProductDetailView'
import { ProductDetailPage } from './components/ProductDetailPage'
import { CheckoutAccountPage } from './components/CheckoutAccountPage'
import { CheckoutContactPage } from './components/CheckoutContactPage'
import { CheckoutReviewPage } from './components/CheckoutReviewPage'
import { CheckoutPage } from './components/CheckoutPage'
import { OrderConfirmationPage } from './components/OrderConfirmationPage'
import { OrderStatusPage } from './components/OrderStatusPage'
import { OrderLookupPage } from './components/OrderLookupPage'
import { UserDashboard } from './components/UserDashboard'
import { LoginPage } from './components/LoginPage'
import { SignUpPage } from './components/SignUpPage'
import { ForgotPasswordPage } from './components/ForgotPasswordPage'
import { ResetPasswordPage } from './components/ResetPasswordPage'
import { ProfilePage } from './components/ProfilePage'
import { OrdersPage } from './components/OrdersPage'
import { ReturnsPage } from './components/ReturnsPage'
import { ContactUsPage } from './components/ContactUsPage'
import { FAQPage } from './components/FAQPage'
import { ShippingReturnsPage } from './components/ShippingReturnsPage'
import { PrivacyTermsPage } from './components/PrivacyTermsPage'
import { NotFoundPage } from './components/NotFoundPage'
import { MaintenancePage } from './components/MaintenancePage'
import { ComingSoonPage } from './components/ComingSoonPage'
import { AboutUsPage } from './components/AboutUsPage'
import { CatalogPage } from './components/CatalogPage'
import { ClearancePage } from './components/ClearancePage'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { moneyFormatter } from './formatters'

export type CartItem = Product & { quantity: number }

// LocalStorage key for cart persistence
const CART_STORAGE_KEY = 'lct_cart'

const wishlistFeatureEnabled =
  (import.meta.env.VITE_ENABLE_WISHLIST ?? 'true').toString().toLowerCase() !== 'false'

const orderTrackingEnabled =
  (import.meta.env.VITE_ENABLE_ORDER_TRACKING ?? 'true').toString().toLowerCase() !== 'false'

const SectionShell = ({
  title,
  description,
  children,
}: {
  title: string | ReactNode
  description?: string
  children: ReactNode
}) => (
  <section className="rounded-3xl border border-white/10 bg-white/5 p-6 lg:p-8 shadow-brand">
    <div className="mb-6 flex flex-col gap-2">
      <h2 className="text-2xl font-semibold text-text">{title}</h2>
      {description ? <p className="text-sm text-slate-300">{description}</p> : null}
    </div>
    {children}
  </section>
)

const ContactCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-xs uppercase tracking-[0.4em] text-secondary">{label}</p>
    <p className="mt-2 text-base font-semibold text-white">{value}</p>
  </div>
)

const CookieBanner = ({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void
  onDismiss: () => void
}) => (
  <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/20 bg-surface/90 p-4 text-sm text-slate-200 shadow-brand backdrop-blur">
    <p className="font-semibold text-white">Spinning the Cookies</p>
    <p className="text-slate-300">
      We're spinning some essential cookies (like your cart and login) plus optional analytics to keep the groove going. 
      Accept to help us fine-tune the playlist and make your experience smoother. No personal data, just the beats.
    </p>
    <div className="flex flex-wrap gap-3">
      <button
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/90 transition-colors"
        onClick={onAccept}
      >
        Drop the Needle
      </button>
      <button
        className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold text-white/80 hover:border-white/50 transition-colors"
        onClick={onDismiss}
      >
        Skip This Track
      </button>
    </div>
  </div>
)

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, isLoading } = useUser()
  const { signInWithOAuth, signOut: stackSignOut } = useStackAuth()
  
  // Wrap signOut to also clear cart
  const signOut = useCallback(async () => {
    // Clear cart state
    setCartItems([])
    console.log('[App] Cleared cart on sign out')
    
    // Clear cart from localStorage
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
      console.log('[App] Cleared cart from localStorage on sign out')
    } catch (error) {
      console.error('[App] Failed to clear cart from localStorage:', error)
    }
    
    // Call the actual sign out
    await stackSignOut()
  }, [stackSignOut])
  const [products, setProducts] = useState<Product[]>([])
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('offline')
  const [adapterHealth, setAdapterHealth] = useState<'unknown' | 'healthy' | 'degraded'>(
    'unknown',
  )
  const [lastLatencyMs, setLastLatencyMs] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const [showCookieBanner, setShowCookieBanner] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [pdpProduct, setPdpProduct] = useState<Product | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [wishlist, setWishlist] = useState<Product[]>([])
  const [isCartSyncing, setIsCartSyncing] = useState(false)
  const lastSyncedUserIdRef = useRef<string | null>(null)
  const hasAttemptedLoadFromStorageRef = useRef<boolean>(false)
  const [isCartOpen, setCartOpen] = useState(false)
  const [isWishlistOpen, setWishlistOpen] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'account' | 'contact' | 'review' | null>(null)
  const [contactForm, setContactForm] = useState<any>(null)
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: string
    cartItems: CartItem[]
    contactForm: any
    cartSubtotal: number
    estimatedTax: number
  } | null>(null)
  const [paymentError, setPaymentError] = useState<{
    code: string
    message: string
  } | null>(null)
  const [orderStatusView, setOrderStatusView] = useState<{
    orderNumber: string
    cartItems: CartItem[]
    contactForm: any
    cartSubtotal: number
    estimatedTax: number
  } | null>(null)
  const [isDashboardOpen, setDashboardOpen] = useState(false)
  const [authPage, setAuthPage] = useState<'login' | 'signup' | 'forgot-password' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const newArrivalsScrollRef = useRef<HTMLDivElement>(null)

  // P.2: Load cart from localStorage on app initialization (after products are loaded)
  // For guest users only - logged-in users load from database in P.3
  useEffect(() => {
    console.log('[Cart] P.2 useEffect triggered:', { isLoading, productsCount: products.length, hasUser: !!(user && user.id), cartItemsCount: cartItems.length })
    
    // Wait for auth to finish loading and products to be available
    if (isLoading || products.length === 0) {
      console.log('[Cart] P.2 - Waiting for products or auth to load')
      return
    }

    // Skip if user is logged in (will load from database instead)
    if (user && user.id) {
      console.log('[Cart] P.2 - User is logged in, skipping localStorage load')
      return
    }

    // Only load if cart is empty (to avoid overwriting)
    if (cartItems.length > 0) {
      console.log('[Cart] P.2 - Cart already has items, skipping localStorage load')
      return
    }

    // Mark that we've attempted to load from storage
    hasAttemptedLoadFromStorageRef.current = true

    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY)
      console.log('[Cart] P.2 - Checking localStorage:', savedCart ? 'found data' : 'empty')
      
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart)
        console.log('[Cart] P.2 - Parsed cart from localStorage:', parsedCart)
        
        if (Array.isArray(parsedCart) && parsedCart.length > 0) {
          // Match localStorage cart items with current products
          const matchedCart: CartItem[] = []
          for (const item of parsedCart) {
            const product = products.find(p => p.id === item.sku)
            if (product && item.quantity > 0) {
              matchedCart.push({
                ...product,
                quantity: item.quantity,
              })
            } else {
              console.log('[Cart] P.2 - Product not found or invalid quantity:', { sku: item.sku, quantity: item.quantity, productFound: !!product })
            }
          }
          
          if (matchedCart.length > 0) {
            console.log('[Cart] ✅ Loaded cart from localStorage:', matchedCart.length, 'items', matchedCart.map(i => ({ id: i.id, name: i.name, qty: i.quantity })))
            setCartItems(matchedCart)
          } else {
            console.log('[Cart] P.2 - No valid items found, clearing localStorage')
            // Clear invalid cart data
            localStorage.removeItem(CART_STORAGE_KEY)
          }
        } else {
          console.log('[Cart] P.2 - Invalid cart format in localStorage')
        }
      } else {
        console.log('[Cart] P.2 - No cart found in localStorage')
      }
    } catch (error) {
      console.error('[Cart] ❌ Failed to load cart from localStorage:', error)
    }
  }, [products, user, isLoading, cartItems.length]) // Run when products are loaded, user changes, or loading state changes

  // P.1: Save cart to localStorage on every change (for guest users only)
  useEffect(() => {
    // Only save to localStorage for guest users (not logged in)
    // Logged-in users use the database instead
    if (user && user.id) {
      console.log('[Cart] User is logged in, skipping localStorage save')
      return
    }

      // Don't clear localStorage if we haven't tried loading from it yet
      // This prevents clearing the cart on initial page load before P.2 can load it
      if (cartItems.length === 0 && !hasAttemptedLoadFromStorageRef.current) {
        console.log('[Cart] Cart is empty but haven\'t loaded from storage yet, skipping clear')
        return
      }

    console.log('[Cart] Guest user - saving to localStorage:', cartItems.length, 'items')

    try {
      if (cartItems.length > 0) {
        // Serialize cart items (only sku and quantity for storage)
        const cartData = cartItems.map(item => ({
          sku: item.id,
          quantity: item.quantity,
        }))
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
        console.log('[Cart] ✅ Saved guest cart to localStorage:', cartItems.length, 'items', cartData)
      } else {
        // Clear localStorage if cart is empty (only after we've attempted to load)
        localStorage.removeItem(CART_STORAGE_KEY)
        console.log('[Cart] ✅ Cleared guest cart from localStorage')
      }
    } catch (error) {
      console.error('[Cart] ❌ Failed to save guest cart to localStorage:', error)
    }
  }, [cartItems, user])

  // P.3: Sync cart with database when user logs in
  useEffect(() => {
    const syncCartOnLogin = async () => {
      // Only sync if user is logged in, we're not already syncing, and we haven't synced for this user yet
      if (!user || !user.id || isCartSyncing || lastSyncedUserIdRef.current === user.id) {
        return
      }

      try {
        setIsCartSyncing(true)
        lastSyncedUserIdRef.current = user.id
        console.log('[Cart] User logged in, clearing guest cart and loading from database...')

        // Clear guest cart from localStorage and state when user logs in
        localStorage.removeItem(CART_STORAGE_KEY)
        setCartItems([])
        console.log('[Cart] Cleared guest cart on login')

        // Load cart from database only
        console.log('[Cart] Loading cart from database...')
        const response = await fetch('/api/user/cart', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.cart && data.cart.length > 0) {
            console.log('[Cart] Loaded cart from database:', data.cart.length, 'items')
            setCartItems(data.cart)
            
            // Save to localStorage for offline access
            const cartData = data.cart.map((item: CartItem) => ({
              sku: item.id,
              quantity: item.quantity,
            }))
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
          } else {
            console.log('[Cart] No cart found in database - starting with empty cart')
            setCartItems([])
          }
        } else {
          console.error('[Cart] Failed to load cart from database:', response.status)
        }
      } catch (error) {
        console.error('[Cart] Error syncing cart on login:', error)
        // Reset ref on error so we can retry
        if (lastSyncedUserIdRef.current === user.id) {
          lastSyncedUserIdRef.current = null
        }
      } finally {
        setIsCartSyncing(false)
      }
    }

    syncCartOnLogin()
    
    // Reset ref when user logs out
    if (!user || !user.id) {
      lastSyncedUserIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Only depend on user.id, not isCartSyncing (which would cause infinite loop)

  // P.4: Save cart to database when logged in user makes changes
  const saveCartToDatabase = async (items: CartItem[]) => {
    if (!user || !user.id) {
      return // Only save if user is logged in
    }

    // Don't save during initial sync to avoid race conditions
    if (isCartSyncing) {
      return
    }

    try {
      // Serialize cart items (only sku and quantity)
      const cartData = items.map(item => ({
        sku: item.id,
        quantity: item.quantity,
      }))

      console.log('[Cart] Saving cart to database:', cartData.length, 'items')

      // Save to database asynchronously (don't block UI)
      const response = await fetch('/api/user/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          items: cartData,
        }),
      })

      if (response.ok) {
        console.log('[Cart] Successfully saved cart to database')
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('[Cart] Failed to save cart to database:', response.status, errorData)
      }
    } catch (error) {
      console.error('[Cart] Error saving cart to database:', error)
    }
  }

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }, [location.pathname])

  // Sync auth page state with route
  useEffect(() => {
    if (location.pathname === '/login') {
      setAuthPage('login')
    } else if (location.pathname === '/signup') {
      setAuthPage('signup')
    } else if (location.pathname === '/forgot-password') {
      setAuthPage('forgot-password')
    } else {
      setAuthPage(null)
    }
  }, [location.pathname])

  // Redirect authenticated users away from login/signup pages
  // If they were in checkout, return them to checkout with their info pre-filled
  useEffect(() => {
    if (!isLoading && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      // Check if we should return to checkout
      const returnToCheckout = sessionStorage.getItem('return_to_checkout') === 'true'
      const returnToCheckoutStep = sessionStorage.getItem('return_to_checkout_step') || 'review'
      
      if (returnToCheckout) {
        console.log('[App] User authenticated, returning to checkout with pre-filled info')
        sessionStorage.removeItem('return_to_checkout')
        sessionStorage.removeItem('return_to_checkout_step')
        
        // Use user data directly from StackAuthProvider (already loaded, no API call needed)
        // Pre-fill contact form with user's information
        const contactFormData = {
          email: user.email || '',
          firstName: user.user_metadata?.firstName || '',
          lastName: user.user_metadata?.lastName || '',
          phone: user.phone || '',
        }
        
        console.log('[App] Pre-filling checkout form with user data:', contactFormData)
        setContactForm(contactFormData)
        
        // Navigate to checkout at the specified step
        navigate(`/checkout?step=${returnToCheckoutStep}`)
      } else {
        console.log('[App] User is authenticated, redirecting from', location.pathname, 'to profile')
        navigate('/profile')
      }
    }
  }, [user, isLoading, location.pathname, navigate, setContactForm])

  // Handle return to checkout after login/signup (when redirected to home page)
  useEffect(() => {
    if (!isLoading && user && location.pathname === '/' && checkoutStep === null) {
      const returnToCheckout = sessionStorage.getItem('return_to_checkout') === 'true'
      const returnToCheckoutStep = sessionStorage.getItem('return_to_checkout_step') || 'review'
      
      if (returnToCheckout) {
        console.log('[App] User authenticated on home page, returning to checkout with pre-filled info')
        sessionStorage.removeItem('return_to_checkout')
        sessionStorage.removeItem('return_to_checkout_step')
        
        // Use user data directly from StackAuthProvider (already loaded, no API call needed)
        // Pre-fill contact form with user's information
        const contactFormData = {
          email: user.email || '',
          firstName: user.user_metadata?.firstName || '',
          lastName: user.user_metadata?.lastName || '',
          phone: user.phone || '',
        }
        
        console.log('[App] Pre-filling checkout form with user data:', contactFormData)
        setContactForm(contactFormData)
        
        // Go to the specified checkout step (usually 'review' when coming from account page)
        setCheckoutStep(returnToCheckoutStep as 'account' | 'contact' | 'review')
      }
    }
  }, [user, isLoading, location.pathname, checkoutStep])

  // Handle return from Square checkout - verify payment and load order data
  useEffect(() => {
    const orderId = searchParams.get('id')
    
    // Clear payment error when navigating away from order-confirmation page
    if (location.pathname !== '/order-confirmation' && paymentError) {
      setPaymentError(null)
    }
    
    // Check for error codes ONLY in explicit query parameters
    // Square may send errors in different formats: error, error_code, code
    // Only check explicit parameters, not patterns in the URL (to avoid false positives)
    let errorCode = searchParams.get('error') || 
                    searchParams.get('error_code') || 
                    searchParams.get('code') ||
                    searchParams.get('errorCode')
    
    // Only check hash for explicit error parameters (not patterns)
    if (!errorCode && location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1))
      errorCode = hashParams.get('error') || 
                  hashParams.get('error_code') || 
                  hashParams.get('code') ||
                  hashParams.get('errorCode')
    }
    
    const errorMessage = searchParams.get('error_message') || 
                        searchParams.get('error_description') ||
                        searchParams.get('message') ||
                        searchParams.get('errorMessage')
    
    // Log for debugging
    console.log('[Order Confirmation] Checking for errors:', {
      orderId,
      errorCode,
      errorMessage,
      search: location.search,
      hash: location.hash,
      fullUrl: location.pathname + location.search + location.hash,
      allParams: Object.fromEntries(searchParams.entries()),
    })
    
    // CRITICAL: If we have an order ID, IGNORE error codes completely
    // Square sometimes adds error codes to URLs even on success
    // The order status from the database is the source of truth
    // Only show error if we have error code AND NO order ID (meaning payment truly failed before order creation)
    if (location.pathname === '/order-confirmation' && errorCode && !orderId) {
      // If we have an error code but no order ID, show the error immediately
      const errorMessages: Record<string, string> = {
        '-107': 'Payment was declined. Please check your payment method and try again.',
        '107': 'Payment was declined. Please check your payment method and try again.',
      }
      const normalizedErrorCode = errorCode.startsWith('-') ? errorCode : `-${errorCode}`
      const message = errorMessage || errorMessages[errorCode] || errorMessages[normalizedErrorCode] || `Payment error (Code: ${errorCode}). Please try again or contact support.`
      
      setPaymentError({
        code: normalizedErrorCode,
        message: message,
      })
      return
    }
    
    // Only process if we're on order-confirmation route with an id parameter
    // and we don't already have order confirmation data set
    // Process order loading FIRST (before error handling) to verify actual order status
    // Note: OrderConfirmationPage component now fetches its own data, so this is for backward compatibility
    if (location.pathname === '/order-confirmation' && orderId && !orderConfirmation) {
      const verifyAndLoadOrder = async () => {
        try {
          setIsProcessing(true)
          
          // Error handling is done above, before this function is called
          // If we reach here, there's no error code in the URL
          
          // Determine API base URL
          const isLocalDev =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1')
          const apiBaseUrl = isLocalDev
            ? import.meta.env.VITE_API_URL || 'http://localhost:3000'
            : typeof window !== 'undefined'
              ? window.location.origin
              : 'http://localhost:3000'

          // First, try to load from localStorage (faster)
          try {
            const storedOrders = JSON.parse(localStorage.getItem('lct_orders') || '{}')
            const orderKey = Object.keys(storedOrders).find(
              key => storedOrders[key].orderId === orderId
            )
            
            if (orderKey && storedOrders[orderKey]) {
              const storedOrder = storedOrders[orderKey]
              
              // Verify payment status with backend
              const verifyResponse = await fetch(`${apiBaseUrl}/api/orders/${orderId}/status`)
              
              if (verifyResponse.ok) {
                const statusData = await verifyResponse.json()
                
                // If payment was successful, show confirmation
                if (statusData.status === 'confirmed' || statusData.status === 'paid') {
                  setOrderConfirmation({
                    orderNumber: storedOrder.orderNumber,
                    cartItems: storedOrder.cartItems,
                    contactForm: storedOrder.contactForm || storedOrder.shippingForm, // Support legacy data
                    cartSubtotal: storedOrder.cartSubtotal,
                    estimatedTax: storedOrder.estimatedTax,
                  })
                  setIsProcessing(false)
                  return
                }
              }
            }
          } catch (localError) {
            console.warn('[Checkout] Failed to load from localStorage:', localError)
          }

          // Use the new secure order details endpoint (Task 3.7 & 3.8)
          // This endpoint joins orders, order_items, and customers tables
          const orderResponse = await fetch(`${apiBaseUrl}/api/order/details?orderId=${encodeURIComponent(orderId)}`)
          
          if (orderResponse.ok) {
            const orderData = await orderResponse.json()
            
            // Check if order status indicates payment failure
            if (orderData.status === 'cancelled' || orderData.status === 'failed') {
              setPaymentError({
                code: '-107',
                message: 'Payment was declined. Your order was not processed. Please try again with a different payment method.',
              })
              setOrderConfirmation(null)
              setIsProcessing(false)
              return
            }
            
            // Verify payment status - show confirmation if payment succeeded or order exists
            // If order exists and is not explicitly cancelled/failed, show confirmation
            // (pending orders might be in process, so don't show error unless explicitly failed)
            if (orderData.status === 'confirmed' || orderData.status === 'paid' || orderData.status === 'pending' || orderData.status === 'OPEN') {
              // Build shipping form data from order data
              let contactFormData: any = {};
              // For pickup orders, use pickup_details if available
              if (orderData.pickup_details) {
                contactFormData = {
                  email: orderData.customer.email || orderData.pickup_details.email || '',
                  firstName: orderData.customer.name.first || orderData.pickup_details.firstName || '',
                  lastName: orderData.customer.name.last || orderData.pickup_details.lastName || '',
                  phone: orderData.customer.phone || orderData.pickup_details.phone || '',
                };
              } else {
                // Fallback: construct from customer data
                contactFormData = {
                  email: orderData.customer.email || '',
                  firstName: orderData.customer.name.first || '',
                  lastName: orderData.customer.name.last || '',
                  phone: orderData.customer.phone || '',
                };
              }
              
              // Clear any payment error if order is confirmed (error code was false positive)
              setPaymentError(null)
              
              // Set order confirmation - OrderConfirmationPage will fetch from endpoint itself
              // But we set minimal data for backward compatibility
              setOrderConfirmation({
                orderNumber: orderData.order_number,
                cartItems: orderData.items.map((item: any) => ({
                  id: item.product_id,
                  name: item.product_name || 'Product',
                  price: item.price,
                  quantity: item.quantity,
                  imageUrl: item.image_url || '',
                  category: item.category || '',
                  stockCount: 0,
                })),
                contactForm: contactFormData,
                cartSubtotal: orderData.subtotal,
                estimatedTax: orderData.tax,
              })
            } else {
              // Payment failed or pending - provide user-friendly error message
              const statusMessages: Record<string, string> = {
                'pending': 'Your payment is still being processed. Please wait a moment and refresh this page.',
                'cancelled': 'Your payment was cancelled. Please try again.',
                'failed': 'Payment failed. Please check your payment method and try again.',
              }
              
              const message = statusMessages[orderData.status] || 
                `Order status: ${orderData.status}. Payment may not have been completed.`
              
              alert(`Payment Issue: ${message}`)
              navigate('/cart')
            }
          } else if (orderResponse.status === 404) {
            // Order not found - might be a payment failure before order creation
            alert('Order not found. This may indicate a payment issue. Please try again or contact support if the problem persists.')
            navigate('/cart')
          } else {
            throw new Error(`Failed to fetch order: ${orderResponse.statusText}`)
          }
        } catch (error) {
          console.error('[Checkout] Failed to verify order:', error)
          alert('Failed to load order confirmation. Please contact support.')
          navigate('/')
        } finally {
          setIsProcessing(false)
        }
      }

      verifyAndLoadOrder()
    }
  }, [location.pathname, searchParams, orderConfirmation, navigate])

  // Navigation handlers using useNavigate
  const handleNavigate = {
    toContact: () => navigate('/contact'),
    toAbout: () => navigate('/about'),
    toCatalog: () => navigate('/catalog'),
    toShippingReturns: () => navigate('/shipping-returns'),
    toReturns: () => navigate('/returns'),
    toPrivacy: () => navigate('/privacy'),
    toTerms: () => navigate('/terms'),
    toDashboard: () => navigate('/dashboard'),
    toLogin: () => navigate('/login'),
    toSignUp: () => navigate('/signup'),
    toForgotPassword: () => navigate('/forgot-password'),
    toTrackOrder: () => navigate('/order-lookup'),
    toHome: () => navigate('/'),
  }
  // Calculate cart count from cartItems, or fallback to localStorage if products aren't loaded yet
  const [cartCountFromStorage, setCartCountFromStorage] = useState(0)
  
  // Update cart count from localStorage when cartItems is empty (for auth pages before products load)
  useEffect(() => {
    if (cartItems.length === 0) {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY)
        if (savedCart) {
          const parsedCart = JSON.parse(savedCart)
          if (Array.isArray(parsedCart)) {
            const count = parsedCart.reduce((total: number, item: any) => total + (item.quantity || 0), 0)
            setCartCountFromStorage(count)
          } else {
            setCartCountFromStorage(0)
          }
        } else {
          setCartCountFromStorage(0)
        }
      } catch (error) {
        setCartCountFromStorage(0)
      }
    } else {
      setCartCountFromStorage(0) // Clear storage count when cartItems is loaded
    }
  }, [cartItems.length])

  const cartCount = cartItems.length > 0 
    ? cartItems.reduce((total, item) => total + item.quantity, 0)
    : cartCountFromStorage
  const effectiveWishlist = wishlistFeatureEnabled ? wishlist : []
  const wishlistCount = effectiveWishlist.length

  const addToCart = (product: Product, quantity = 1) => {
    console.log('[Cart] addToCart called:', { productId: product.id, productName: product.name, quantity, currentCartItems: cartItems.length })
    
    // Test I-104: Stock Limit - Prevent adding more than available stock
    if (product.stockCount <= 0) {
      alert('This item is sold out and cannot be added to cart.')
      return
    }
    
    setCartItems((prev) => {
      console.log('[Cart] setCartItems callback - prev items:', prev.length)
      const existing = prev.find((item) => item.id === product.id)
      const currentQuantity = existing ? existing.quantity : 0
      const newQuantity = currentQuantity + quantity
      
      // Check if adding this quantity would exceed available stock
      if (newQuantity > product.stockCount) {
        const available = product.stockCount - currentQuantity
        if (available <= 0) {
          alert('This item is sold out and cannot be added to cart.')
          return prev
        } else {
          alert(`Inventory Limit Reached. Only ${available} ${available === 1 ? 'item' : 'items'} available.`)
          // Add only the available quantity
          const updated = prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: product.stockCount }
              : item,
          )
          console.log('[Cart] Updated cart (stock limit):', updated.length, 'items')
          saveCartToDatabase(updated)
          return updated
        }
      }
      
      const updated = existing
        ? prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: newQuantity }
              : item,
          )
        : [...prev, { ...product, quantity }]
      
      console.log('[Cart] Updated cart:', updated.length, 'items', updated.map(i => ({ id: i.id, name: i.name, qty: i.quantity })))
      
      // P.4: Save to database if logged in
      saveCartToDatabase(updated)
      
      return updated
    })
    setCartOpen(true)
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0
    setCartItems((prev) => {
      const updated = prev
        .map((item) => {
          if (item.id === productId) {
            // Test I-104: Stock Limit - Prevent setting quantity above available stock
            const maxQuantity = Math.min(safeQuantity, item.stockCount)
            if (safeQuantity > item.stockCount) {
              alert(`Inventory Limit Reached. Only ${item.stockCount} ${item.stockCount === 1 ? 'item' : 'items'} available.`)
            }
            return { ...item, quantity: Math.max(0, maxQuantity) }
          }
          return item
        })
        .filter((item) => item.quantity > 0)
      
      // P.4: Save to database if logged in
      saveCartToDatabase(updated)
      
      return updated
    })
  }

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== productId)
      
      // P.4: Save to database if logged in
      saveCartToDatabase(updated)
      
      return updated
    })
  }

  const cartSubtotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  )
  // Tax calculation for pickup orders
  const estimatedTax = cartSubtotal > 0 ? cartSubtotal * 0.0825 : 0

  const toggleWishlist = (product: Product) => {
    if (!wishlistFeatureEnabled) {
      return
    }
    setWishlist((prev) => {
      const exists = prev.some((item) => item.id === product.id)
      if (exists) {
        return prev.filter((item) => item.id !== product.id)
      }
      return [...prev, product]
    })
    setWishlistOpen(true)
  }

  const shareWishlist = () => {
    // Prevent sharing if wishlist is empty
    if (effectiveWishlist.length === 0) {
      return
    }
    const names = effectiveWishlist.map((item) => item.name).join(', ')
    const payload = {
      title: 'My Local Commerce wishlist',
      text: `Here are the items I'm eyeing: ${names}`,
      url: window.location.origin,
    }
    if (navigator.share) {
      navigator.share(payload).catch(() => {
        navigator.clipboard?.writeText(`${payload.text} ${payload.url}`)
      })
    } else {
      navigator.clipboard?.writeText(`${payload.text} ${payload.url}`)
    }
  }
  const lastEventRef = useRef(performance.now())

  // Fetch products from catalog API
  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    const fetchProducts = async () => {
      try {
        setProductsLoading(true)
        setProductsError(null)
        const startTime = performance.now()
        const products = await fetchProductsFromCatalog({ limit: 500 })
        const now = performance.now()
        const duration = Math.round(now - startTime)
        
        if (!cancelled) {
          setProducts(products)
          setLastLatencyMs(duration)
          lastEventRef.current = now
          setConnectionMode('snapshot') // Using API endpoint, not live WebSocket
          setProductsLoading(false)
          
          // Log performance for monitoring
          if (duration > 300) {
            console.warn(`[Performance] Product fetch took ${duration}ms (target: <300ms)`)
          } else {
            console.log(`[Performance] Product fetch: ${duration}ms ✅`)
          }
        }
      } catch (error) {
        console.error('[App] Failed to fetch products from catalog API:', error)
        if (!cancelled) {
          setProductsError(error instanceof Error ? error.message : 'Failed to load products')
          setConnectionMode('offline')
          setProductsLoading(false)
          // Fallback to WebSocket subscription if API fails
          const unsubscribe = subscribeToProducts(
            siteConfig.appId,
            (nextProducts) => {
              const now = performance.now()
              setProducts(nextProducts)
              setLastLatencyMs(Math.round(now - lastEventRef.current))
              lastEventRef.current = now
              setProductsError(null) // Clear error if fallback succeeds
            },
            {
              onChannelChange: setConnectionMode,
            },
          )
          return () => unsubscribe()
        }
      }
    }

    fetchProducts()

    // Poll for updates every 30 seconds
    timer = window.setInterval(() => {
      if (!cancelled) {
        fetchProducts()
      }
    }, 30000)

    return () => {
      cancelled = true
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [])

  // Initialize client monitors (respects cookie consent)
  useEffect(() => {
    const teardown = initClientMonitors()
    return () => teardown()
  }, [showCookieBanner]) // Re-initialize when consent changes

  // Health check - only run if using WebSocket adapter, not for catalog API
  useEffect(() => {
    // Skip health check if we're using the catalog API (connectionMode === 'snapshot')
    // The catalog API fetch already sets adapterHealth to 'healthy' on success
    if (connectionMode === 'snapshot') {
      return
    }

    let cancelled = false
    let timer: number | null = null

    const poll = async () => {
      try {
        const healthy = await checkAdapterHealth()
        if (!cancelled) {
          setAdapterHealth(healthy ? 'healthy' : 'degraded')
        }
      } catch {
        if (!cancelled) {
          setAdapterHealth('degraded')
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(poll, 30000)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [connectionMode])

  useEffect(() => {
    if (!lastLatencyMs) {
      return
    }
    trackMetric('adapter_latency_ms', lastLatencyMs, { mode: connectionMode })
  }, [lastLatencyMs, connectionMode])

  useEffect(() => {
    if (connectionMode === 'offline') {
      reportClientError('Adapter offline or unavailable', 'adapter.offline')
    }
  }, [connectionMode])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const consent = window.localStorage.getItem('lct_cookie_consent')
    setShowCookieBanner(!consent)
  }, [])

  const handleAcceptCookies = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lct_cookie_consent', 'true')
    }
    setShowCookieBanner(false)
  }

  const handleDismissCookies = () => {
    setShowCookieBanner(false)
  }


  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category))
    return ['All', ...unique]
  }, [products])

  // New Arrivals - products with higher stock (likely newer)
  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => b.stockCount - a.stockCount)
      .slice(0, 8)
  }, [products])

  // Featured Categories - unique categories from products
  const featuredCategories = useMemo(() => {
    const categoryCounts = new Map<string, number>()
    products.forEach((p) => {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) || 0) + 1)
    })
    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category]) => category)
  }, [products])


  const adapterHealthLabel =
    adapterHealth === 'healthy'
      ? 'Healthy'
      : adapterHealth === 'degraded'
        ? 'Needs attention'
        : 'Checking…'

  const statusColor =
    connectionMode === 'live'
      ? 'animate-pulse bg-accent'
      : connectionMode === 'snapshot'
        ? 'bg-primary'
        : connectionMode === 'mock'
          ? 'bg-secondary'
          : 'bg-rose-500'

  // Helper function to create page props
  const createPageProps = () => ({
    user,
    isLoading,
    cartCount,
    wishlistCount,
    wishlistFeatureEnabled,
    products,
    productsLoading,
    productsError,
    orderTrackingEnabled,
    onSignIn: handleNavigate.toLogin,
    onSignOut: signOut,
    onAccount: handleNavigate.toDashboard,
    onCart: () => setCartOpen(true),
    onWishlist: () => setWishlistOpen(true),
    onSearch: () => setSearchOpen(true),
    onProductSelect: (product: Product) => setPdpProduct(product),
    onTrackOrder: handleNavigate.toTrackOrder,
    onContactUs: handleNavigate.toContact,
    onAboutUs: handleNavigate.toAbout,
    onShippingReturns: handleNavigate.toShippingReturns,
    onPrivacyPolicy: handleNavigate.toPrivacy,
    onTermsOfService: handleNavigate.toTerms,
  })

  // Maintenance page handler
  const handleMaintenanceNotify = (email: string) => {
    console.log('Notification requested for:', email)
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(
        window.localStorage.getItem('lct_maintenance_notifications') || '[]',
      )
      notifications.push({ email, timestamp: Date.now() })
      window.localStorage.setItem(
        'lct_maintenance_notifications',
        JSON.stringify(notifications),
      )
    }
  }

  // Coming soon page handler
  const handleComingSoonNotify = (email: string) => {
    console.log('Coming soon notification requested for:', email)
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(
        window.localStorage.getItem('lct_coming_soon_notifications') || '[]',
      )
      notifications.push({ email, timestamp: Date.now() })
      window.localStorage.setItem(
        'lct_coming_soon_notifications',
        JSON.stringify(notifications),
      )
    }
  }

  // If coming soon page feature is enabled, show it as the only page
  if (featureFlags.enableComingSoonPage) {
    return (
      <ComingSoonPage
        message="We're building something amazing! Stay tuned for our grand opening."
        expectedLaunch="January 15, 2025"
        onNotifyMe={handleComingSoonNotify}
      />
    )
  }

  // If maintenance page feature is enabled, show it as the homepage
  if (featureFlags.enableMaintenancePage && location.pathname === '/') {
    return (
      <MaintenancePage
        reason="We are currently performing scheduled maintenance to improve your experience."
        expectedReturn="December 15, 2024 at 2:00 PM EST"
        onNotifyMe={handleMaintenanceNotify}
      />
    )
  }

  return (
    <>
      <Routes>
        {/* Coming Soon route (when feature is disabled, for testing) */}
        <Route
          path="/coming-soon"
          element={
            <ComingSoonPage
              message="We're building something amazing! Stay tuned for our grand opening."
              expectedLaunch="January 15, 2025"
              onNotifyMe={handleComingSoonNotify}
            />
          }
        />

        {/* Maintenance route (when feature is disabled, for testing) */}
        <Route
          path="/503"
          element={
            <MaintenancePage
              reason="We are currently performing scheduled maintenance to improve your experience."
              expectedReturn="December 15, 2024 at 2:00 PM EST"
              onNotifyMe={handleMaintenanceNotify}
            />
          }
        />

        {/* 404 Route */}
        <Route
          path="/404"
          element={
            <NotFoundPage
              {...createPageProps()}
              onProductSelect={(product) => {
                setPdpProduct(product)
                handleNavigate.toHome()
              }}
              onSearch={() => {
                setSearchOpen(true)
                handleNavigate.toHome()
              }}
            />
          }
        />

        {/* Contact Us Route */}
        <Route
          path="/contact"
          element={<ContactUsPage {...createPageProps()} />}
        />

        {/* FAQ Route */}
        <Route
          path="/faq"
          element={<FAQPage {...createPageProps()} />}
        />

        {/* About Us Route */}
        <Route
          path="/about"
          element={<AboutUsPage {...createPageProps()} />}
        />

        {/* Catalog/Menu Route */}
        <Route
          path="/catalog"
          element={
            <CatalogPage
              {...createPageProps()}
              onQuickView={(product) => setQuickViewProduct(product)}
              onViewDetails={(product) => navigate(`/product/${product.id}`)}
              onToggleWishlist={toggleWishlist}
              onAddToCart={addToCart}
            />
          }
        />

        {/* Clearance/Sale Route */}
        <Route
          path="/clearance"
          element={
            <ClearancePage
              {...createPageProps()}
              onQuickView={(product) => setQuickViewProduct(product)}
              onViewDetails={(product) => navigate(`/product/${product.id}`)}
              onToggleWishlist={toggleWishlist}
              onAddToCart={addToCart}
            />
          }
        />

        {/* Product Detail Page Route */}
        <Route
          path="/product/:productId"
          element={
            <ProductDetailPage
              product={null}
              {...createPageProps()}
              onAddToCart={addToCart}
              onToggleWishlist={toggleWishlist}
            />
          }
        />

        {/* Shipping & Returns Route */}
        <Route
          path="/shipping-returns"
          element={<ShippingReturnsPage {...createPageProps()} />}
        />

        {/* Privacy Policy Route */}
        <Route
          path="/privacy"
          element={<PrivacyTermsPage {...createPageProps()} />}
        />

        {/* Order Confirmation Route - fetches order data from URL parameter */}
        <Route
          path="/order-confirmation"
          element={
            <OrderConfirmationPage
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              orderTrackingEnabled={orderTrackingEnabled}
              onViewOrderStatus={() => {
                navigate('/order-lookup')
              }}
              onGoToDashboard={() => {
                setDashboardOpen(true)
                navigate('/')
              }}
              onContinueShopping={() => {
                navigate('/')
              }}
              onSignIn={handleNavigate.toLogin}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => setPdpProduct(product)}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
            />
          }
        />

        {/* Terms of Service Route */}
        <Route
          path="/terms"
          element={<PrivacyTermsPage {...createPageProps()} />}
        />

        {/* Login Route */}
        <Route
          path="/login"
          element={
            <LoginPage
              onSignIn={async (provider) => {
                await signInWithOAuth(provider)
                navigate('/')
              }}
              onSignUp={() => navigate('/signup')}
              onForgotPassword={() => navigate('/forgot-password')}
              onBack={() => navigate('/')}
              isLoading={isLoading}
              user={user}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
              onReturnToCheckout={() => {
                // Navigate to checkout at review step
                const returnToCheckoutStep = sessionStorage.getItem('return_to_checkout_step') || 'review'
                sessionStorage.removeItem('return_to_checkout_step')
                
                const contactFormData = {
                  email: user?.email || '',
                  firstName: user?.user_metadata?.firstName || '',
                  lastName: user?.user_metadata?.lastName || '',
                  phone: user?.phone || '',
                }
                
                console.log('[App] Navigating to checkout after login:', contactFormData)
                setContactForm(contactFormData)
                navigate(`/checkout?step=${returnToCheckoutStep}`)
              }}
            />
          }
        />

        {/* Checkout Route */}
        <Route
          path="/checkout"
          element={
            <CheckoutPage
              cartItems={cartItems}
              contactForm={contactForm}
              cartSubtotal={cartSubtotal}
              estimatedTax={estimatedTax}
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onSetContactForm={setContactForm}
              onComplete={async (checkoutPayload) => {
                if (!checkoutPayload) {
                  console.error('[Checkout] No payload provided')
                  alert('Checkout failed. Please try again.')
                  return
                }

                setIsProcessing(true)

                try {
                  const isLocalDev =
                    typeof window !== 'undefined' &&
                    (window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1')
                  const apiBaseUrl = isLocalDev
                    ? 'http://localhost:3000'
                    : typeof window !== 'undefined'
                      ? window.location.origin
                      : ''

                  const response = await fetch(`${apiBaseUrl}/api/checkout/create`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify(checkoutPayload),
                  })

                  const data = await response.json()

                  if (!response.ok) {
                    throw new Error(data.error || 'Checkout failed')
                  }

                  if (data.url) {
                    window.location.href = data.url
                  } else {
                    throw new Error('No checkout URL received')
                  }
                } catch (error) {
                  console.error('[Checkout] Error:', error)
                  alert(`Checkout failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
                  setIsProcessing(false)
                }
              }}
              onCancel={() => {
                navigate('/')
                setContactForm(null)
              }}
              onSignIn={() => navigate('/login')}
              onSignUp={() => navigate('/signup')}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
            />
          }
        />

        {/* Sign Up Route */}
        <Route
          path="/signup"
          element={
            <SignUpPage
              onSignUp={async (provider) => {
                await signInWithOAuth(provider)
                navigate('/')
              }}
              onSignIn={() => navigate('/login')}
              onBack={() => navigate('/')}
              isLoading={isLoading}
              user={user}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Forgot Password Route */}
        <Route
          path="/forgot-password"
          element={
            <ForgotPasswordPage
              onBack={() => navigate('/login')}
              onSignIn={() => navigate('/login')}
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Reset Password Route */}
        <Route
          path="/reset-password"
          element={
            <ResetPasswordPage
              onBack={() => navigate('/forgot-password')}
              onSignIn={() => navigate('/login')}
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Profile Route */}
        <Route
          path="/profile"
          element={
            <ProfilePage
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Orders Route */}
        <Route
          path="/orders"
          element={
            <OrdersPage
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Returns Route */}
        <Route
          path="/returns"
          element={
            <ReturnsPage
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onBack={() => navigate('/orders')}
            />
          }
        />


        {/* Order Lookup Route */}
        <Route
          path="/order-lookup"
          element={
            <OrderLookupPage
              onBack={() => navigate('/')}
              onOrderFound={(orderData) => {
                // Order lookup now navigates directly to order confirmation
                // This callback is kept for compatibility but won't be used
                console.log('[Order Lookup] Order found:', orderData)
              }}
              onContactSupport={() => {
                handleNavigate.toContact()
              }}
              user={user}
              isLoading={isLoading}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
              wishlistFeatureEnabled={wishlistFeatureEnabled}
              products={products}
              productsLoading={productsLoading}
              productsError={productsError ? new Error(productsError) : null}
              orderTrackingEnabled={featureFlags.enableOrderTracking}
              onCart={() => setCartOpen(true)}
              onWishlist={() => setWishlistOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onProductSelect={(product) => {
                setPdpProduct(product)
                navigate(`/product/${product.id}`)
              }}
              onTrackOrder={handleNavigate.toTrackOrder}
              onContactUs={handleNavigate.toContact}
              onAboutUs={handleNavigate.toAbout}
              onShippingReturns={handleNavigate.toShippingReturns}
              onPrivacyPolicy={handleNavigate.toPrivacy}
              onTermsOfService={handleNavigate.toTerms}
              onSignIn={handleNavigate.toLogin}
              onSignOut={() => signOut()}
              onAccount={handleNavigate.toDashboard}
            />
          }
        />

        {/* Homepage Route */}
        <Route
          path="/"
          element={
            <div className="flex min-h-screen flex-col">
              <Header
                user={user}
                isLoading={isLoading}
                cartCount={cartCount}
                wishlistCount={wishlistCount}
                wishlistFeatureEnabled={wishlistFeatureEnabled}
                products={products}
                onSignIn={handleNavigate.toLogin}
                onSignOut={() => signOut()}
                onAccount={handleNavigate.toDashboard}
                onCart={() => setCartOpen(true)}
                onWishlist={() => setWishlistOpen(true)}
                onSearch={() => setSearchOpen(true)}
                onProductSelect={(product) => setPdpProduct(product)}
              />

              <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-12 px-4 pt-40 pb-10 text-text sm:px-6 sm:pt-48 md:pt-56 lg:px-8">
                {/* Hero Section */}
                <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-primary/20 via-white/10 to-secondary/10 p-8 lg:p-12 shadow-brand">
                  <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-6 flex-1">
                      <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-secondary">Live Catalog</p>
                        <h1 className="text-4xl font-bold leading-tight text-text sm:text-5xl lg:text-6xl">
                          {siteConfig.hero.headline}
                        </h1>
                        <p className="max-w-2xl text-lg text-slate-100 lg:text-xl">
                          {siteConfig.hero.subheading}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button 
                          onClick={() => navigate('/catalog')}
                          className="rounded-full bg-primary px-8 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80 hover:scale-105"
                        >
                          {siteConfig.hero.primaryCta}
                        </button>
                        <button 
                          onClick={handleNavigate.toContact}
                          className="rounded-full border border-white/30 px-8 py-3 text-base font-semibold text-white/80 hover:border-white/60 hover:bg-white/5"
                        >
                          {siteConfig.hero.secondaryCta}
                        </button>
                        <button
                          className="rounded-full border border-white/20 px-6 py-3 text-base font-semibold text-white/80 hover:border-white/40 hover:bg-white/5"
                          onClick={() => setSearchOpen(true)}
                        >
                          Search
                        </button>
                      </div>
                    </div>
                    <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-surface/80 backdrop-blur-sm p-6 text-sm text-slate-300">
                      <p className="text-xs uppercase tracking-[0.4em] text-secondary">
                        Real-time Status
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-3xl font-semibold text-text">
                          {connectionMode === 'snapshot'
                            ? 'API'
                            : connectionMode === 'mock'
                              ? 'Mock mode'
                              : connectionMode === 'offline'
                                ? 'Offline'
                                : 'Live'}
                        </span>
                        <span className={`h-3 w-3 rounded-full ${statusColor}`} />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        Latency: {lastLatencyMs}ms
                      </p>
                      <p className="text-xs text-slate-400">
                        Status:{' '}
                        <span
                          className={
                            adapterHealth === 'healthy'
                              ? 'text-accent'
                              : adapterHealth === 'degraded'
                                ? 'text-secondary'
                                : 'text-slate-200'
                          }
                        >
                          {adapterHealthLabel}
                        </span>
                      </p>
                    </div>
                  </div>
                </section>

                {/* Featured Categories */}
                {featuredCategories.length > 0 && (
                  <SectionShell
                    title="Shop by Category"
                    description="Browse our curated collections"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {featuredCategories.map((category) => {
                        const categoryProducts = products.filter((p) => p.category === category)
                        const categoryImage = categoryProducts[0]?.imageUrl
                        return (
                          <button
                            key={category}
                            onClick={() => {
                              navigate(`/catalog?category=${encodeURIComponent(category)}`)
                            }}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-6 text-left transition hover:border-primary/60 hover:scale-[1.02]"
                          >
                            {categoryImage && (
                              <div className="absolute inset-0 opacity-10 transition group-hover:opacity-20">
                                <img
                                  src={categoryImage}
                                  alt={category}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="relative z-10">
                              <h3 className="text-lg font-semibold text-white">{category}</h3>
                              <p className="mt-1 text-sm text-slate-400">
                                {categoryProducts.length} {categoryProducts.length === 1 ? 'item' : 'items'}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </SectionShell>
                )}

                {/* New Arrivals Section */}
                <SectionShell
                  title="New Arrivals"
                  description="Discover our latest products. Fresh inventory updated in real-time."
                >
                {newArrivals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
                    No new arrivals at the moment. Check back soon!
                  </div>
                ) : (
                  <div className="relative">
                    {/* Left Arrow */}
                    <button
                      onClick={() => {
                        if (newArrivalsScrollRef.current) {
                          newArrivalsScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' })
                        }
                      }}
                      className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-white shadow-brand backdrop-blur-sm transition hover:bg-surface hover:scale-110"
                      aria-label="Scroll left"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {/* Right Arrow */}
                    <button
                      onClick={() => {
                        if (newArrivalsScrollRef.current) {
                          newArrivalsScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' })
                        }
                      }}
                      className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-surface/90 p-2 text-white shadow-brand backdrop-blur-sm transition hover:bg-surface hover:scale-110"
                      aria-label="Scroll right"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <div ref={newArrivalsScrollRef} className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                      {newArrivals.map((product) => (
                        <article
                          key={product.id}
                          className="flex min-w-[280px] max-w-[280px] flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/70 shadow-brand transition hover:-translate-y-1 hover:border-primary/60 cursor-pointer"
                          onClick={() => navigate(`/product/${product.id}`)}
                        >
                          <div className="relative aspect-video w-full overflow-hidden">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                            <span className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                              {product.category}
                            </span>
                            <span className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                              New
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col gap-3 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-lg font-semibold text-white truncate">{product.name}</p>
                                <p className="text-sm text-slate-400 line-clamp-2">{product.description}</p>
                              </div>
                              <span className={`text-base font-semibold flex-shrink-0 ${
                                product.stockCount > 0 
                                  ? 'text-secondary' 
                                  : 'text-slate-500 line-through opacity-50'
                              }`}>
                                {moneyFormatter.format(product.price)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                              <span>Stock</span>
                              <span
                                className={
                                  product.stockCount === 0
                                    ? 'font-semibold text-slate-500'
                                    : product.stockCount <= 5
                                      ? 'font-semibold text-secondary'
                                      : 'font-semibold text-accent'
                                }
                              >
                                {product.stockCount === 0 ? 'Sold Out' : `${product.stockCount} units`}
                              </span>
                            </div>
                            <div className="mt-auto flex flex-col gap-2">
                              {product.stockCount > 0 ? (
                                <button
                                  className="w-full rounded-full bg-primary/80 px-4 py-2 text-xs font-semibold text-white shadow-brand hover:bg-primary transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    addToCart(product)
                                  }}
                                >
                                  Add to cart
                                </button>
                              ) : (
                                <button
                                  className="w-full rounded-full bg-slate-700/50 px-4 py-2 text-xs font-semibold text-slate-500 cursor-not-allowed"
                                  disabled
                                >
                                  Sold Out
                                </button>
                              )}
                              <div className="flex gap-2">
                                <button
                                  className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setQuickViewProduct(product)
                                  }}
                                >
                                  Quick view
                                </button>
                                <button
                                  className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigate(`/product/${product.id}`)
                                  }}
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                      {/* See More Card */}
                      <div className="flex min-w-[280px] max-w-[280px] flex-shrink-0 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5">
                        <div className="flex flex-col items-center gap-4 p-6 text-center">
                          <p className="text-sm font-semibold text-white">See More</p>
                          <p className="text-xs text-slate-400">Browse all new arrivals</p>
                          <button
                            onClick={() => navigate('/catalog')}
                            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-white shadow-brand hover:bg-primary/80"
                          >
                            View Catalog
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </SectionShell>

              {featureFlags.enableAbout ? (
                <SectionShell title={siteConfig.about.heading}>
                  <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
                    <p className="text-lg text-slate-200">{siteConfig.about.body}</p>
                    <ul className="space-y-4 text-sm text-slate-300">
                      {siteConfig.about.highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <span className="mt-1 h-2 w-2 rounded-full bg-accent" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </SectionShell>
              ) : null}

              {featureFlags.enableEvents ? (
                <SectionShell
                  title="Events & activations"
                  description="Toggle via config flags without touching JSX."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {siteConfig.events.map((event) => (
                      <div
                        key={event.title}
                        className="rounded-2xl border border-white/10 bg-surface/70 p-5 text-slate-200"
                      >
                        <p className="text-xs uppercase tracking-[0.4em] text-secondary">
                          {event.date}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold text-white">{event.title}</h3>
                        <p className="text-sm text-slate-300">{event.description}</p>
                      </div>
                    ))}
                  </div>
                </SectionShell>
              ) : null}

                {/* Trust Elements */}
                <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-8 lg:p-12">
                  <div className="mb-8 text-center">
                    <h2 className="text-3xl font-bold text-text">Why Shop With Us</h2>
                    <p className="mt-2 text-slate-300">We're committed to providing the best shopping experience</p>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full bg-primary/20 p-5 transition hover:scale-110">
                        <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-white">Secure Checkout</h3>
                      <p className="text-sm text-slate-400">SSL encrypted payments</p>
                    </div>
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full bg-accent/20 p-5 transition hover:scale-110">
                        <svg className="h-10 w-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-white">Free Returns</h3>
                      <p className="text-sm text-slate-400">30-day return policy</p>
                    </div>
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full bg-secondary/20 p-5 transition hover:scale-110">
                        <svg className="h-10 w-10 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-white">Fast Shipping</h3>
                      <p className="text-sm text-slate-400">1-2 day delivery</p>
                    </div>
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full bg-primary/20 p-5 transition hover:scale-110">
                        <svg className="h-10 w-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold text-white">24/7 Support</h3>
                      <p className="text-sm text-slate-400">Always here to help</p>
                    </div>
                  </div>
                </section>

                {/* Promotional Banner */}
                <section className="rounded-3xl border border-secondary/30 bg-gradient-to-br from-secondary/20 via-primary/10 to-secondary/10 p-8 lg:p-12">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-white">Limited Time Offers</h2>
                      </div>
                      <p className="max-w-2xl text-base text-slate-200">
                        Special deals and discounts on select items. Limited quantities available. Shop now before they're gone!
                      </p>
                    </div>
                    <button
                      onClick={() => navigate('/clearance')}
                      className="rounded-full border-2 border-secondary/50 bg-secondary/30 px-8 py-3 text-base font-semibold text-white transition hover:bg-secondary/40 hover:scale-105 lg:flex-shrink-0"
                    >
                      Shop Clearance →
                    </button>
                  </div>
                </section>

                {/* Contact Section */}
                <SectionShell title="Visit Us">
                  <div className="grid gap-6 md:grid-cols-3">
                    <ContactCard label="Phone" value={siteConfig.contact.phone} />
                    <ContactCard label="Email" value={siteConfig.contact.email} />
                    <ContactCard label="Location" value={siteConfig.contact.location} />
                  </div>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="text-sm font-semibold text-white">Store Hours</p>
                    <p className="mt-1 text-sm text-slate-400">{siteConfig.contact.hours}</p>
                  </div>
                </SectionShell>


              </main>

              <Footer
                orderTrackingEnabled={orderTrackingEnabled}
                onTrackOrder={handleNavigate.toTrackOrder}
                onContactUs={handleNavigate.toContact}
                onAboutUs={handleNavigate.toAbout}
                onShippingReturns={handleNavigate.toShippingReturns}
                onPrivacyPolicy={handleNavigate.toPrivacy}
                onTermsOfService={handleNavigate.toTerms}
              />
            </div>
          }
        />

        {/* Catch-all 404 route */}
        <Route
          path="*"
          element={
            <NotFoundPage
              {...createPageProps()}
              onProductSelect={(product) => {
                setPdpProduct(product)
                handleNavigate.toHome()
              }}
              onSearch={() => {
                setSearchOpen(true)
                handleNavigate.toHome()
              }}
            />
          }
        />
      </Routes>

      {/* Global Modals/Overlays - Available on all pages */}

      {showCookieBanner ? (
        <CookieBanner
          onAccept={handleAcceptCookies}
          onDismiss={handleDismissCookies}
        />
      ) : null}

      <SearchOverlay
        products={products}
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(product) => setPdpProduct(product)}
      />

      {isCartOpen ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-lg flex-col bg-black backdrop-blur-lg text-white shadow-brand">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-black backdrop-blur-lg">
              <div>
                <p className="text-lg font-semibold">Shopping bag</p>
                <p className="text-xs text-slate-400">{cartCount} items</p>
              </div>
              <button
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                onClick={() => setCartOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 bg-black/80">
              {cartItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">
                  Your bag is empty. Add products to reserve them.
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.category}</p>
                          </div>
                          <button
                            className="text-xs text-slate-400 hover:text-white"
                            onClick={() => removeFromCart(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/80">
                          <div className="flex items-center gap-2">
                            <button
                              className="rounded-full border border-white/20 px-2 text-xs"
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="h-8 w-14 rounded-full border border-white/10 bg-transparent text-center text-sm"
                              value={item.quantity}
                              onChange={(event) =>
                                updateCartQuantity(item.id, Number(event.target.value))
                              }
                            />
                            <button
                              className="rounded-full border border-white/20 px-2 text-xs"
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          <span className="font-semibold">
                            {moneyFormatter.format(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cartItems.length > 0 ? (
                <p className="mt-3 text-xs text-secondary">
                  Items are not reserved until checkout. Complete your order to guarantee
                  availability.
                </p>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-5 py-5 bg-black/80">
              {/* Promo codes are handled by Square's hosted checkout page */}
              <div className="space-y-2 text-sm text-slate-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{moneyFormatter.format(cartSubtotal)}</span>
                </div>
                {/* Shipping not shown for pickup orders */}
                <div className="flex justify-between text-slate-400">
                  <span>Est. taxes</span>
                  <span>{moneyFormatter.format(estimatedTax)}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Final shipping and taxes are confirmed during checkout once your address is
                provided.
              </p>
              <div className="mt-4">
                <button
                  className={`w-full rounded-full px-4 py-3 text-sm font-semibold text-white shadow-brand ${
                    cartItems.length === 0
                      ? 'cursor-not-allowed bg-slate-600/50 opacity-50'
                      : 'bg-primary'
                  }`}
                  onClick={async () => {
                    if (cartItems.length === 0) {
                      return // Prevent checkout if cart is empty
                    }
                    
                    console.log('[Checkout] Button clicked, checking user:', {
                      hasUser: !!user,
                      userId: user?.id,
                      isLoading,
                    })
                    
                    // Check if user is authenticated and has all required info
                    // Use user data from StackAuthProvider (already loaded) instead of making API call
                    if (user && user.id && !isLoading) {
                      // Extract customer info from user object (already fetched by StackAuthProvider)
                      const customerEmail = user.email || ''
                      const customerFirstName = user.user_metadata?.firstName || ''
                      const customerLastName = user.user_metadata?.lastName || ''
                      const customerPhone = user.phone || ''
                      
                      // Check if we have minimum required fields for pickup
                      // Email and firstName are required, lastName and phone can be added on review if missing
                      const hasRequiredInfo = customerEmail && customerFirstName
                      
                      console.log('[Checkout] Using user data from StackAuthProvider:', {
                        email: customerEmail,
                        firstName: customerFirstName,
                        lastName: customerLastName,
                        phone: customerPhone,
                        hasRequiredInfo,
                      })
                      
                      if (hasRequiredInfo) {
                        // Skip contact page - go directly to review
                        const contactFormData = {
                          email: customerEmail,
                          firstName: customerFirstName,
                          lastName: customerLastName,
                          phone: customerPhone,
                        }
                        
                        console.log('[Checkout] User has complete info, skipping to review')
                        
                        // Set form first, then navigate to checkout review
                        setContactForm(contactFormData)
                        setCartOpen(false)
                        navigate('/checkout?step=review')
                        return
                      } else {
                        console.log('[Checkout] Missing required info, will show contact page')
                        // Logged in user with incomplete info - show contact page to complete
                        const contactFormData = {
                          email: customerEmail,
                          firstName: customerFirstName,
                          lastName: customerLastName,
                          phone: customerPhone,
                        }
                        setContactForm(contactFormData)
                        setCartOpen(false)
                        navigate('/checkout?step=contact')
                        return
                      }
                    } else {
                      console.log('[Checkout] User not authenticated or still loading, will show account page')
                    }
                    
                    // Default: show account selection page
                    console.log('[Checkout] Showing account selection page')
                    setCartOpen(false)
                    navigate('/checkout?step=account')
                  }}
                  disabled={cartItems.length === 0}
                >
                  Continue to Checkout
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Visa</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  Mastercard
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">Amex</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/80">
                  SSL Secure
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {quickViewProduct ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-6 sm:items-center">
          <div className="w-full max-w-xl rounded-3xl bg-surface/95 shadow-brand">
            <div className="relative">
              <img
                src={quickViewProduct.imageUrl}
                alt={quickViewProduct.name}
                className="h-64 w-full rounded-t-3xl object-cover"
              />
              <button
                className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs text-white"
                onClick={() => setQuickViewProduct(null)}
              >
                Close
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-white">{quickViewProduct.name}</p>
                  <p className="text-sm text-slate-300">{quickViewProduct.description}</p>
                </div>
                <span className="text-base font-semibold text-secondary">
                  {moneyFormatter.format(quickViewProduct.price)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-400">
                <span>Category • {quickViewProduct.category}</span>
                <span className="text-white/70">·</span>
                <span>
                  {quickViewProduct.stockCount > 0
                    ? `${quickViewProduct.stockCount} in stock`
                    : 'Out of stock'}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-brand"
                  onClick={() => quickViewProduct && addToCart(quickViewProduct)}
                >
                  Add to cart
                </button>
                {wishlistFeatureEnabled ? (
                  <button
                    className={`flex-1 rounded-full border px-4 py-3 text-sm font-semibold ${
                      effectiveWishlist.some((item) => item.id === quickViewProduct.id)
                        ? 'border-secondary text-secondary'
                        : 'border-white/20 text-white/80'
                    }`}
                    onClick={() => toggleWishlist(quickViewProduct)}
                  >
                    {effectiveWishlist.some((item) => item.id === quickViewProduct.id)
                      ? 'Saved'
                      : 'Save for later'}
                  </button>
                ) : null}
                <button
                  className="w-full rounded-full border border-primary/60 px-4 py-3 text-sm font-semibold text-primary"
                  onClick={() => {
                    setPdpProduct(quickViewProduct)
                    setQuickViewProduct(null)
                  }}
                >
                  View full details
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {wishlistFeatureEnabled && isWishlistOpen ? (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-md flex-col bg-black backdrop-blur-lg text-white shadow-brand">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-black backdrop-blur-lg">
              <div>
                <p className="text-lg font-semibold">Wishlist</p>
                <p className="text-xs text-slate-400">{wishlistCount} saved items</p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`rounded-full border px-3 py-1 text-xs ${
                    effectiveWishlist.length === 0
                      ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/40 opacity-50'
                      : 'border-white/20 text-white/80 hover:border-white/40'
                  }`}
                  onClick={shareWishlist}
                  disabled={effectiveWishlist.length === 0}
                >
                  Share
                </button>
                <button
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                  onClick={() => setWishlistOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-black/80">
              {effectiveWishlist.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-300">
                  Save products you love to keep them handy.
                </div>
              ) : (
                <div className="space-y-4">
                  {effectiveWishlist.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-16 w-16 rounded-2xl object-cover"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-slate-400">{item.category}</p>
                          </div>
                          <button
                            className="text-xs text-slate-400 hover:text-white"
                            onClick={() => toggleWishlist(item)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-sm text-white/80">
                          <span>{moneyFormatter.format(item.price)}</span>
                          <div className="flex gap-2">
                            <button
                              className="rounded-full border border-white/20 px-3 py-1 text-xs"
                              onClick={() => addToCart(item)}
                            >
                              Add to cart
                            </button>
                            <button
                              className="rounded-full border border-white/20 px-3 py-1 text-xs"
                              onClick={() => setPdpProduct(item)}
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-white/10 px-5 py-5 text-xs text-slate-400 bg-black/80">
              Share your wishlist or move items to cart whenever you're ready.
            </div>
          </div>
        </div>
      ) : null}

      {pdpProduct ? (
        <ProductDetailView
          product={pdpProduct}
          onClose={() => setPdpProduct(null)}
          onAddToCart={(quantity = 1) => {
            addToCart(pdpProduct, quantity)
          }}
          onSave={wishlistFeatureEnabled ? () => toggleWishlist(pdpProduct) : undefined}
          isSaved={wishlistFeatureEnabled && effectiveWishlist.some((item) => item.id === pdpProduct.id)}
        />
      ) : null}

      {/* Checkout is now handled by /checkout route - old modal rendering removed */}
      {false && checkoutStep === 'account' ? (
        <CheckoutAccountPage
          cartSubtotal={cartSubtotal}
          estimatedTax={estimatedTax}
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          orderTrackingEnabled={orderTrackingEnabled}
          onContinueAsGuest={() => {
            setCheckoutStep('contact')
          }}
          // Task 1.2: If logged in user reaches account page, redirect to review
          onRedirectToReview={async () => {
            if (user) {
              try {
                const response = await fetch('/api/auth/me', {
                  method: 'GET',
                  credentials: 'include',
                })
                const data = await response.json()
                if (data?.success && data.customer) {
                  setContactForm({
                    email: data.customer.email,
                    firstName: data.customer.firstName,
                    lastName: data.customer.lastName,
                    phone: data.customer.phone || '',
                  })
                  setCheckoutStep('review')
                }
              } catch (error) {
                console.error('[App] Failed to fetch user data for redirect:', error)
              }
            }
          }}
          onSignIn={() => {
            // Mark that we should return to checkout review after login
            sessionStorage.setItem('return_to_checkout', 'true')
            sessionStorage.setItem('return_to_checkout_step', 'review')
            handleNavigate.toLogin()
          }}
          onSignUp={() => {
            // Mark that we should return to checkout review after signup
            sessionStorage.setItem('return_to_checkout', 'true')
            sessionStorage.setItem('return_to_checkout_step', 'review')
            handleNavigate.toSignUp()
          }}
          onCancel={() => {
            setCheckoutStep(null)
            setContactForm(null)
          }}
          onSignOut={async () => {
            await signOut()
          }}
          onAccount={handleNavigate.toDashboard}
          onCart={() => setCartOpen(true)}
          onWishlist={() => setWishlistOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onProductSelect={(product) => setPdpProduct(product)}
          onTrackOrder={handleNavigate.toTrackOrder}
          onContactUs={handleNavigate.toContact}
          onAboutUs={handleNavigate.toAbout}
          onShippingReturns={handleNavigate.toShippingReturns}
          onPrivacyPolicy={handleNavigate.toPrivacy}
          onTermsOfService={handleNavigate.toTerms}
        />
      ) : null}

      {/* Checkout is now handled by /checkout route - keeping this for backward compatibility during transition */}
      {false && checkoutStep === 'contact' ? (
        <CheckoutContactPage
          cartSubtotal={cartSubtotal}
          estimatedTax={estimatedTax}
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          orderTrackingEnabled={orderTrackingEnabled}
          onNext={(form) => {
            setContactForm(form)
            setCheckoutStep('review')
          }}
          onCancel={() => {
            // Go back to account selection
            setCheckoutStep('account')
            setContactForm(null)
          }}
          onSignIn={() => {
            // Mark that we should return to checkout review after login
            sessionStorage.setItem('return_to_checkout', 'true')
            sessionStorage.setItem('return_to_checkout_step', 'review')
            handleNavigate.toLogin()
          }}
          onSignOut={async () => {
            await signOut()
            // Stay on checkout page as guest
          }}
          onAccount={handleNavigate.toDashboard}
          onCart={() => setCartOpen(true)}
          onWishlist={() => setWishlistOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onProductSelect={(product) => setPdpProduct(product)}
          onTrackOrder={handleNavigate.toTrackOrder}
          onContactUs={handleNavigate.toContact}
          onAboutUs={handleNavigate.toAbout}
          onShippingReturns={handleNavigate.toShippingReturns}
          onPrivacyPolicy={handleNavigate.toPrivacy}
          onTermsOfService={handleNavigate.toTerms}
        />
      ) : null}

      {/* Checkout is now handled by /checkout route - keeping this for backward compatibility during transition */}
      {false && checkoutStep === 'review' && contactForm ? (
        <CheckoutReviewPage
          cartItems={cartItems}
          contactForm={contactForm}
          paymentForm={null} // No payment form - Square handles payment on their hosted page
          cartSubtotal={cartSubtotal}
          estimatedTax={estimatedTax}
          customerId={user?.id || null}
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          orderTrackingEnabled={orderTrackingEnabled}
          onBack={() => {
            // If user is logged in, go back to account selection
            // If guest, go back to contact form
            if (user) {
              setCheckoutStep('account')
            } else {
              setCheckoutStep('contact')
            }
          }}
          onComplete={async (checkoutPayload) => {
            if (!checkoutPayload) {
              console.error('[Checkout] No payload provided')
              alert('Checkout failed. Please try again.')
              return
            }

            setIsProcessing(true)

            try {
              // Determine API base URL (local dev vs production)
              const isLocalDev =
                typeof window !== 'undefined' &&
                (window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1')
              const apiBaseUrl = isLocalDev
                ? import.meta.env.VITE_API_URL || 'http://localhost:3000'
                : typeof window !== 'undefined'
                  ? window.location.origin
                  : 'http://localhost:3000'

              // Send checkout payload to backend
              const response = await fetch(`${apiBaseUrl}/api/checkout/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(checkoutPayload),
              })

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(
                  errorData.message || `Checkout API error: ${response.status}`,
                )
              }

            const orderResult = await response.json()
            console.log('[Checkout] Order created successfully:', orderResult)

            // Extract checkout URL and Square order ID from simplified response
            // Response format: { "url": "...", "square_order_id": "..." }
            const checkoutUrl = orderResult.url
            const squareOrderId = orderResult.square_order_id

            if (!checkoutUrl) {
              throw new Error('Invalid response from checkout API: missing checkout URL')
            }

            // Store minimal order data locally (before redirect)
            // We'll load full order details when Square redirects back
            const completedOrderItems = [...cartItems]
            const completedContactForm = { ...contactForm }

            // Generate a temporary order number for localStorage key
            // The actual order number will be retrieved from the database on return
            const tempOrderKey = `temp-${Date.now()}-${squareOrderId?.substring(0, 8)}`

            const orderData = {
              squareOrderId, // Store Square order ID for lookup
              cartItems: completedOrderItems,
              contactForm: completedContactForm,
              cartSubtotal,
              estimatedTax,
              checkoutPayload,
            }

            try {
              const storedOrders = JSON.parse(localStorage.getItem('lct_orders') || '{}')
              storedOrders[tempOrderKey] = orderData
              localStorage.setItem('lct_orders', JSON.stringify(storedOrders))
            } catch (e) {
              console.error('Failed to store order locally', e)
            }

            // Clear checkout state
            setCheckoutStep(null)
            setCartItems([])
            setContactForm(null)

            // Execute immediate redirect to Square-hosted checkout page
            // This page automatically includes Apple Pay, Google Pay, and other digital wallets
            console.log('[Checkout] Redirecting to Square checkout:', checkoutUrl)
            window.location.href = checkoutUrl
            // Note: Code execution stops here - Square will redirect back to return_url_success

            } catch (error) {
              console.error('[Checkout] Failed to create order:', error)
              alert(
                error instanceof Error
                  ? error.message
                  : 'Order creation failed. Please try again or contact support.',
              )
              setIsProcessing(false)
            }
          }}
          onCancel={() => {
            setCheckoutStep(null)
            setContactForm(null)
          }}
        />
      ) : null}

      {/* Show payment error only if no order ID (payment failed before order creation) */}
      {/* If we have an order ID, let OrderConfirmationPage component handle it */}
      {paymentError && location.pathname === '/order-confirmation' && !orderId ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-surface text-white">
          <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-4 py-8">
            <div className="rounded-2xl border border-red-500/50 bg-red-500/10 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="mb-2 text-2xl font-semibold text-red-400">Payment Failed</h1>
              <p className="mb-6 text-slate-300">{paymentError.message}</p>
              <p className="mb-6 text-xs text-slate-400">Error Code: {paymentError.code}</p>
              <button
                onClick={() => {
                  setPaymentError(null)
                  navigate('/cart')
                }}
                className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-brand hover:bg-primary/90"
              >
                Return to Cart
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {orderConfirmation ? (
        <OrderConfirmationPage
          orderNumber={orderConfirmation.orderNumber}
          cartItems={orderConfirmation.cartItems}
          contactForm={orderConfirmation.contactForm}
          cartSubtotal={orderConfirmation.cartSubtotal}
          estimatedTax={orderConfirmation.estimatedTax}
          onViewOrderStatus={() => {
            setOrderStatusView({
              orderNumber: orderConfirmation.orderNumber,
              cartItems: orderConfirmation.cartItems,
              contactForm: orderConfirmation.contactForm,
              cartSubtotal: orderConfirmation.cartSubtotal,
              estimatedTax: orderConfirmation.estimatedTax,
            })
            setOrderConfirmation(null)
          }}
          onGoToDashboard={() => {
            setOrderConfirmation(null)
            setDashboardOpen(true)
          }}
          onContinueShopping={() => {
            setOrderConfirmation(null)
          }}
        />
      ) : null}


      {orderStatusView ? (
        <OrderStatusPage
          orderNumber={orderStatusView.orderNumber}
          cartItems={orderStatusView.cartItems}
          contactForm={orderStatusView.contactForm}
          cartSubtotal={orderStatusView.cartSubtotal}
          estimatedTax={orderStatusView.estimatedTax}
          currentStatus="confirmed"
          trackingNumber={undefined}
          estimatedDeliveryDate="December 15, 2024"
          onBack={() => setOrderStatusView(null)}
        />
      ) : null}

      {isDashboardOpen ? (
        <UserDashboard
          user={user}
          onBack={() => setDashboardOpen(false)}
          onViewOrder={(order) => {
            setDashboardOpen(false)
            setOrderStatusView({
              orderNumber: order.orderNumber,
              cartItems: order.cartItems,
              contactForm: order.contactForm || order.shippingForm, // Support legacy data
              cartSubtotal: order.cartSubtotal,
              estimatedTax: order.estimatedTax,
            })
          }}
          onReOrder={(order) => {
            setCartItems(order.cartItems)
            setDashboardOpen(false)
            setCartOpen(true)
          }}
        />
      ) : null}

      {authPage === 'login' ? (
        <LoginPage
          onSignIn={async (provider) => {
            await signInWithOAuth(provider)
            setAuthPage(null)
          }}
          onSignUp={() => setAuthPage('signup')}
          onForgotPassword={() => setAuthPage('forgot-password')}
          onBack={() => setAuthPage(null)}
          isLoading={isLoading}
          user={user}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          productsLoading={productsLoading}
          productsError={productsError ? new Error(productsError) : null}
          orderTrackingEnabled={featureFlags.enableOrderTracking}
          onCart={() => setCartOpen(true)}
          onWishlist={() => setWishlistOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onProductSelect={(product) => {
            setPdpProduct(product)
            navigate(`/product/${product.id}`)
          }}
          onTrackOrder={handleNavigate.toTrackOrder}
          onContactUs={handleNavigate.toContact}
          onAboutUs={handleNavigate.toAbout}
          onShippingReturns={handleNavigate.toShippingReturns}
          onPrivacyPolicy={handleNavigate.toPrivacy}
          onTermsOfService={handleNavigate.toTerms}
          onSignOut={() => signOut()}
          onAccount={handleNavigate.toDashboard}
          onReturnToCheckout={() => {
            // Directly open checkout at review step with user data
            const returnToCheckoutStep = sessionStorage.getItem('return_to_checkout_step') || 'review'
            sessionStorage.removeItem('return_to_checkout_step')
            
            const contactFormData = {
              email: user?.email || '',
              firstName: user?.user_metadata?.firstName || '',
              lastName: user?.user_metadata?.lastName || '',
              phone: user?.phone || '',
            }
            
            console.log('[App] Opening checkout directly after login:', contactFormData)
            setContactForm(contactFormData)
            setCheckoutStep(returnToCheckoutStep as 'account' | 'contact' | 'review')
            setAuthPage(null) // Close login modal
          }}
        />
      ) : null}

      {authPage === 'signup' ? (
        <SignUpPage
          onSignUp={async (provider) => {
            await signInWithOAuth(provider)
            setAuthPage(null)
          }}
          onSignIn={() => setAuthPage('login')}
          onBack={() => setAuthPage(null)}
          isLoading={isLoading}
          user={user}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          productsLoading={productsLoading}
          productsError={productsError ? new Error(productsError) : null}
          orderTrackingEnabled={featureFlags.enableOrderTracking}
          onCart={() => setCartOpen(true)}
          onWishlist={() => setWishlistOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onProductSelect={(product) => {
            setPdpProduct(product)
            navigate(`/product/${product.id}`)
          }}
          onTrackOrder={handleNavigate.toTrackOrder}
          onContactUs={handleNavigate.toContact}
          onAboutUs={handleNavigate.toAbout}
          onShippingReturns={handleNavigate.toShippingReturns}
          onPrivacyPolicy={handleNavigate.toPrivacy}
          onTermsOfService={handleNavigate.toTerms}
          onSignOut={() => signOut()}
          onAccount={handleNavigate.toDashboard}
        />
      ) : null}

      {authPage === 'forgot-password' ? (
        <ForgotPasswordPage
          onBack={() => setAuthPage('login')}
          onSignIn={() => setAuthPage('login')}
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          productsLoading={productsLoading}
          productsError={productsError ? new Error(productsError) : null}
          orderTrackingEnabled={featureFlags.enableOrderTracking}
          onCart={() => setCartOpen(true)}
          onWishlist={() => setWishlistOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onProductSelect={(product) => {
            setPdpProduct(product)
            navigate(`/product/${product.id}`)
          }}
          onTrackOrder={handleNavigate.toTrackOrder}
          onContactUs={handleNavigate.toContact}
          onAboutUs={handleNavigate.toAbout}
          onShippingReturns={handleNavigate.toShippingReturns}
          onPrivacyPolicy={handleNavigate.toPrivacy}
          onTermsOfService={handleNavigate.toTerms}
          onSignOut={() => signOut()}
          onAccount={handleNavigate.toDashboard}
        />
      ) : null}
    </>
  )
}

export default App

