import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  subscribeToProducts,
  fetchProductsFromCatalog,
  type Product,
  checkAdapterHealth,
  type ConnectionMode,
} from '../dataAdapter'
import { initClientMonitors, reportClientError, trackMetric } from '../monitoring'
import { siteConfig } from '../config'
import { DataGateway } from '../services/DataGateway'

type ProductsContextValue = {
  products: Product[]
  productsLoading: boolean
  productsError: string | null
  connectionMode: ConnectionMode
  adapterHealth: 'unknown' | 'healthy' | 'degraded'
  lastLatencyMs: number
  categories: string[]
  newArrivals: Product[]
  featuredCategories: string[]
}

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('offline')
  const [adapterHealth, setAdapterHealth] = useState<'unknown' | 'healthy' | 'degraded'>('unknown')
  const [lastLatencyMs, setLastLatencyMs] = useState(0)
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)
  const lastEventRef = useRef(performance.now())

  // Fetch products from catalog API
  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    const abortController = new AbortController()

    const fetchProducts = async () => {
      try {
        setProductsLoading(true)
        setProductsError(null)
        const startTime = performance.now()
        
        const response = await DataGateway.getProducts({ limit: 500, signal: abortController.signal })
        const now = performance.now()
        const duration = Math.round(now - startTime)

        if (!cancelled) {
          if (response.error) {
            throw new Error(response.error.message)
          }

          setProducts(response.data || [])
          setLastLatencyMs(duration)
          lastEventRef.current = now
          setConnectionMode('snapshot') // Using API endpoint, not live WebSocket
          setProductsLoading(false)

          // Log performance for monitoring
          if (duration > 300) {
            console.warn(`[Performance] Product fetch took ${duration}ms (target: <300ms)`)
          } else {
            console.log(`[Performance] Product fetch: ${duration}ms ✅ ${response.cached ? '(cached)' : ''}`)
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
      abortController.abort()
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [])

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

  const categories = useMemo(() => {
    const unique = new Set(products.map((product) => product.category))
    return ['All', ...unique]
  }, [products])

  // New Arrivals - products with higher stock (likely newer)
  const newArrivals = useMemo(() => {
    return [...products].sort((a, b) => b.stockCount - a.stockCount).slice(0, 8)
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

  const value: ProductsContextValue = {
    products,
    productsLoading,
    productsError,
    connectionMode,
    adapterHealth,
    lastLatencyMs,
    categories,
    newArrivals,
    featuredCategories,
  }

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
}

export function useProducts(): ProductsContextValue {
  const context = useContext(ProductsContext)
  if (!context) {
    throw new Error('useProducts must be used within ProductsProvider')
  }
  return context
}
