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

const wishlistFeatureEnabled =
  (import.meta.env.VITE_ENABLE_WISHLIST ?? 'true').toString().toLowerCase() !== 'false'

const WISHLIST_STORAGE_KEY = 'lct_wishlist'

type WishlistContextValue = {
  wishlist: Product[]
  wishlistCount: number
  isWishlistOpen: boolean
  isWishlistSyncing: boolean
  toggleWishlist: (product: Product) => void
  shareWishlist: () => void
  setWishlistOpen: (open: boolean) => void
  isWishlistEnabled: boolean
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined)

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useUser()
  const [wishlist, setWishlist] = useState<Product[]>([])
  const [isWishlistOpen, setWishlistOpen] = useState(false)
  const [isWishlistSyncing, setIsWishlistSyncing] = useState(false)
  const lastSyncedUserIdRef = useRef<string | null>(null)
  const hasAttemptedLoadFromStorageRef = useRef<boolean>(false)

  // P.2: Load wishlist from localStorage on app initialization (for guest users only)
  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) {
      return
    }

    // Skip if user is logged in (will load from database instead)
    if (user && user.id) {
      return
    }

    // Only load if wishlist is empty (to avoid overwriting)
    if (wishlist.length > 0) {
      return
    }

    // Mark that we've attempted to load from storage
    hasAttemptedLoadFromStorageRef.current = true

    try {
      const savedWishlist = localStorage.getItem(WISHLIST_STORAGE_KEY)
      if (savedWishlist) {
        const parsedWishlist = JSON.parse(savedWishlist)
        if (Array.isArray(parsedWishlist) && parsedWishlist.length > 0) {
          // Match localStorage wishlist items with current products
          // Note: We store product IDs, but we need full Product objects
          // For now, we'll just store the IDs and let components handle display
          const productIds = parsedWishlist.filter((id): id is string => typeof id === 'string')
          if (productIds.length > 0) {
            console.log('[Wishlist] Loaded wishlist from localStorage:', productIds.length, 'items')
            // We'll need to fetch products separately or store full product data
            // For now, we'll keep it simple and just track IDs
            // This will be populated when products are available
          }
        }
      }
    } catch (error) {
      console.error('[Wishlist] Failed to load wishlist from localStorage:', error)
    }
  }, [isLoading, user, wishlist.length])

  // P.1: Save wishlist to localStorage on every change (for guest users only)
  useEffect(() => {
    // Only save to localStorage for guest users (not logged in)
    // Logged-in users use the database instead
    if (user && user.id) {
      return
    }

    // Don't clear localStorage if we haven't tried loading from it yet
    if (wishlist.length === 0 && !hasAttemptedLoadFromStorageRef.current) {
      return
    }

    try {
      if (wishlist.length > 0) {
        // Serialize wishlist items (only IDs for storage)
        const wishlistData = wishlist.map((item) => item.id)
        localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistData))
      } else {
        // Clear localStorage if wishlist is empty
        localStorage.removeItem(WISHLIST_STORAGE_KEY)
      }
    } catch (error) {
      console.error('[Wishlist] Failed to save guest wishlist to localStorage:', error)
    }
  }, [wishlist, user])

  // P.3: Sync wishlist with database when user logs in
  useEffect(() => {
    const syncWishlistOnLogin = async () => {
      // Only sync if user is logged in, we're not already syncing, and we haven't synced for this user yet
      if (!user || !user.id || isWishlistSyncing || lastSyncedUserIdRef.current === user.id) {
        return
      }

      try {
        setIsWishlistSyncing(true)
        lastSyncedUserIdRef.current = user.id
        console.log('[Wishlist] User logged in, clearing guest wishlist and loading from database...')

        // Clear guest wishlist from localStorage and state when user logs in
        localStorage.removeItem(WISHLIST_STORAGE_KEY)
        setWishlist([])
        console.log('[Wishlist] Cleared guest wishlist on login')

        // Load wishlist from database only
        console.log('[Wishlist] Loading wishlist from database...')
        const response = await DataGateway.getWishlist()

        if (response.error) {
          console.error('[Wishlist] Failed to load wishlist from database:', response.error.message)
        } else if (response.data && response.data.length > 0) {
          console.log('[Wishlist] Loaded wishlist from database:', response.data.length, 'items')
          setWishlist(response.data)

          // Save to localStorage for offline access
          const wishlistData = response.data.map((item: Product) => item.id)
          localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistData))
        } else {
          console.log('[Wishlist] No wishlist found in database - starting with empty wishlist')
          setWishlist([])
        }
      } catch (error) {
        console.error('[Wishlist] Error syncing wishlist on login:', error)
        // Reset ref on error so we can retry
        if (lastSyncedUserIdRef.current === user.id) {
          lastSyncedUserIdRef.current = null
        }
      } finally {
        setIsWishlistSyncing(false)
      }
    }

    syncWishlistOnLogin()

    // Reset ref when user logs out
    if (!user || !user.id) {
      lastSyncedUserIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Only depend on user.id, not isWishlistSyncing (which would cause infinite loop)

  // P.4: Save wishlist to database when logged-in user makes changes
  const saveWishlistToDatabase = useCallback(
    async (productId: string, action: 'add' | 'remove') => {
      if (!user || !user.id) {
        return // Only save if user is logged in
      }

      // Don't save during initial sync to avoid race conditions
      if (isWishlistSyncing) {
        return
      }

      try {
        if (action === 'add') {
          await DataGateway.addToWishlist(productId)
        } else {
          await DataGateway.removeFromWishlist(productId)
        }
      } catch (error) {
        console.error('[Wishlist] Failed to save wishlist to database:', error)
      }
    },
    [user, isWishlistSyncing],
  )

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!wishlistFeatureEnabled) {
        return
      }

      const exists = wishlist.some((item) => item.id === product.id)
      const action = exists ? 'remove' : 'add'

      // Optimistically update UI
      setWishlist((prev) => {
        if (exists) {
          return prev.filter((item) => item.id !== product.id)
        }
        return [...prev, product]
      })
      setWishlistOpen(true)

      // Save to database if user is logged in
      if (user && user.id) {
        await saveWishlistToDatabase(product.id, action)
      }
    },
    [wishlist, user, saveWishlistToDatabase],
  )

  const shareWishlist = useCallback(() => {
    // Prevent sharing if wishlist is empty
    if (wishlist.length === 0) {
      return
    }
    const names = wishlist.map((item) => item.name).join(', ')
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
  }, [wishlist])

  const effectiveWishlist = wishlistFeatureEnabled ? wishlist : []
  const wishlistCount = effectiveWishlist.length

  const value: WishlistContextValue = {
    wishlist: effectiveWishlist,
    wishlistCount,
    isWishlistOpen,
    isWishlistSyncing,
    toggleWishlist,
    shareWishlist,
    setWishlistOpen,
    isWishlistEnabled: wishlistFeatureEnabled,
  }

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext)
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider')
  }
  return context
}
