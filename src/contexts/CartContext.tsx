import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { Product } from '../dataAdapter'
import { useUser } from '../auth/StackAuthProvider'
import { DataGateway } from '../services/DataGateway'

export type CartItem = Product & { quantity: number }

const CART_STORAGE_KEY = 'lct_cart'

type CartContextValue = {
  cartItems: CartItem[]
  cartCount: number
  cartSubtotal: number
  estimatedTax: number
  isCartOpen: boolean
  isCartSyncing: boolean
  addToCart: (product: Product, quantity?: number) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  removeFromCart: (productId: string) => void
  clearCart: () => void
  setCartItems: (items: CartItem[]) => void
  setCartOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

export function CartProvider({
  children,
  products,
}: {
  children: ReactNode
  products: Product[]
}) {
  const { user, isLoading } = useUser()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartSyncing, setIsCartSyncing] = useState(false)
  const [isCartOpen, setCartOpen] = useState(false)
  const lastSyncedUserIdRef = useRef<string | null>(null)
  const hasAttemptedLoadFromStorageRef = useRef<boolean>(false)

  // P.2: Load cart from localStorage on app initialization (after products are loaded)
  // For guest users only - logged-in users load from database in P.3
  useEffect(() => {
    console.log('[Cart] P.2 useEffect triggered:', {
      isLoading,
      productsCount: products.length,
      hasUser: !!(user && user.id),
      cartItemsCount: cartItems.length,
    })

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
            const product = products.find((p) => p.id === item.sku)
            if (product && item.quantity > 0) {
              matchedCart.push({
                ...product,
                quantity: item.quantity,
              })
            } else {
              console.log('[Cart] P.2 - Product not found or invalid quantity:', {
                sku: item.sku,
                quantity: item.quantity,
                productFound: !!product,
              })
            }
          }

          if (matchedCart.length > 0) {
            console.log(
              '[Cart] ✅ Loaded cart from localStorage:',
              matchedCart.length,
              'items',
              matchedCart.map((i) => ({ id: i.id, name: i.name, qty: i.quantity })),
            )
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
  }, [products, user, isLoading, cartItems.length])

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
        const cartData = cartItems.map((item) => ({
          sku: item.id,
          quantity: item.quantity,
        }))
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
        console.log(
          '[Cart] ✅ Saved guest cart to localStorage:',
          cartItems.length,
          'items',
          cartData,
        )
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
        const response = await DataGateway.getCart()

        if (response.error) {
          console.error('[Cart] Failed to load cart from database:', response.error.message)
        } else if (response.data && response.data.length > 0) {
          console.log('[Cart] Loaded cart from database:', response.data.length, 'items')
          setCartItems(response.data)

          // Save to localStorage for offline access
          const cartData = response.data.map((item: CartItem) => ({
            sku: item.id,
            quantity: item.quantity,
          }))
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
        } else {
          console.log('[Cart] No cart found in database - starting with empty cart')
          setCartItems([])
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
  const saveCartToDatabase = useCallback(
    async (items: CartItem[]) => {
      if (!user || !user.id) {
        return // Only save if user is logged in
      }

      // Don't save during initial sync to avoid race conditions
      if (isCartSyncing) {
        return
      }

      try {
        // Serialize cart items (only sku and quantity)
        const cartData = items.map((item) => ({
          sku: item.id,
          quantity: item.quantity,
        }))

        console.log('[Cart] Saving cart to database:', cartData.length, 'items')

        // Save to database asynchronously (don't block UI)
        const response = await DataGateway.saveCart(items)

        if (response.error) {
          console.error('[Cart] Failed to save cart to database:', response.error.message)
        } else {
          console.log('[Cart] Successfully saved cart to database')
        }
      } catch (error) {
        console.error('[Cart] Error saving cart to database:', error)
      }
    },
    [user, isCartSyncing],
  )

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      console.log('[Cart] addToCart called:', {
        productId: product.id,
        productName: product.name,
        quantity,
        currentCartItems: cartItems.length,
      })

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
            alert(
              `Inventory Limit Reached. Only ${available} ${available === 1 ? 'item' : 'items'} available.`,
            )
            // Add only the available quantity
            const updated = prev.map((item) =>
              item.id === product.id ? { ...item, quantity: product.stockCount } : item,
            )
            console.log('[Cart] Updated cart (stock limit):', updated.length, 'items')
            saveCartToDatabase(updated)
            return updated
          }
        }

        const updated = existing
          ? prev.map((item) =>
              item.id === product.id ? { ...item, quantity: newQuantity } : item,
            )
          : [...prev, { ...product, quantity }]

        console.log(
          '[Cart] Updated cart:',
          updated.length,
          'items',
          updated.map((i) => ({ id: i.id, name: i.name, qty: i.quantity })),
        )

        // P.4: Save to database if logged in
        saveCartToDatabase(updated)

        return updated
      })
      setCartOpen(true)
    },
    [cartItems.length, saveCartToDatabase],
  )

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      const safeQuantity = Number.isFinite(quantity) ? quantity : 0
      setCartItems((prev) => {
        const updated = prev
          .map((item) => {
            if (item.id === productId) {
              // Test I-104: Stock Limit - Prevent setting quantity above available stock
              const maxQuantity = Math.min(safeQuantity, item.stockCount)
              if (safeQuantity > item.stockCount) {
                alert(
                  `Inventory Limit Reached. Only ${item.stockCount} ${item.stockCount === 1 ? 'item' : 'items'} available.`,
                )
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
    },
    [saveCartToDatabase],
  )

  const removeFromCart = useCallback(
    (productId: string) => {
      console.log('[Cart] removeFromCart called:', {
        productId,
        currentCartItems: cartItems.length,
      })
      
      setCartItems((prev) => {
        const updated = prev.filter((item) => item.id !== productId)
        
        console.log('[Cart] Removed item from cart:', {
          productId,
          beforeCount: prev.length,
          afterCount: updated.length,
        })

        // Save to database if logged in (async, don't block UI)
        if (user && user.id && !isCartSyncing) {
          saveCartToDatabase(updated).catch((error) => {
            console.error('[Cart] Failed to save cart after removal:', error)
          })
        } else {
          // For guest users, immediately save to localStorage
          try {
            if (updated.length > 0) {
              const cartData = updated.map((item) => ({
                sku: item.id,
                quantity: item.quantity,
              }))
              localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData))
              console.log('[Cart] Saved guest cart to localStorage after removal:', updated.length, 'items')
            } else {
              localStorage.removeItem(CART_STORAGE_KEY)
              console.log('[Cart] Cleared guest cart from localStorage after removal')
            }
          } catch (error) {
            console.error('[Cart] Failed to save guest cart to localStorage after removal:', error)
          }
        }

        return updated
      })
    },
    [saveCartToDatabase, user, isCartSyncing, cartItems.length],
  )

  const clearCart = useCallback(() => {
    console.log('[Cart] clearCart called')
    setCartItems([])
    try {
      localStorage.removeItem(CART_STORAGE_KEY)
      console.log('[Cart] Cleared cart from localStorage')
    } catch (error) {
      console.error('[Cart] Failed to clear cart from localStorage:', error)
    }
    
    // P.4: Save empty cart to database if logged in
    if (user && user.id && !isCartSyncing) {
      console.log('[Cart] Saving empty cart to database')
      saveCartToDatabase([]).catch((error) => {
        console.error('[Cart] Failed to clear cart in database:', error)
      })
    }
  }, [user, isCartSyncing, saveCartToDatabase])

  const setCartItemsDirect = useCallback(
    (items: CartItem[]) => {
      setCartItems(items)
      // Save to database if logged in
      saveCartToDatabase(items)
    },
    [saveCartToDatabase],
  )

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
            const count = parsedCart.reduce(
              (total: number, item: any) => total + (item.quantity || 0),
              0,
            )
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

  const cartCount =
    cartItems.length > 0
      ? cartItems.reduce((total, item) => total + item.quantity, 0)
      : cartCountFromStorage

  const cartSubtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0)
  // Tax calculation for pickup orders
  const estimatedTax = cartSubtotal > 0 ? cartSubtotal * 0.0825 : 0

  const value: CartContextValue = {
    cartItems,
    cartCount,
    cartSubtotal,
    estimatedTax,
    isCartOpen,
    isCartSyncing,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    setCartItems: setCartItemsDirect,
    setCartOpen,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
