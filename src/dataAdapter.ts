import { sanitizeText } from './utils/sanitize'

export type Product = {
  id: string
  name: string
  description: string
  price: number
  category: string
  stockCount: number
  imageUrl: string
  rating: number
  reviewCount: number
}

export type ProductSnapshotHandler = (products: Product[]) => void

export type ConnectionMode = 'live' | 'snapshot' | 'mock' | 'offline'

type SubscribeOptions = {
  onChannelChange?: (mode: ConnectionMode) => void
}

type MockState = {
  timer: number | null
  products: Product[]
}

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: 'bean-001',
    name: 'Single Origin Espresso',
    description: 'Chocolate + citrus espresso blend roasted this morning.',
    price: 18,
    category: 'Coffee',
    stockCount: 22,
    imageUrl:
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    reviewCount: 188,
  },
  {
    id: 'print-101',
    name: 'Mission Street Print',
    description: 'Limited-run risograph print by resident artist Noe Alba.',
    price: 45,
    category: 'Art',
    stockCount: 5,
    imageUrl:
      'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
    rating: 4.6,
    reviewCount: 74,
  },
  {
    id: 'pantry-221',
    name: 'Citrus Chili Salt',
    description: 'Small-batch seasoning using reclaimed citrus zest.',
    price: 14,
    category: 'Pantry',
    stockCount: 38,
    imageUrl:
      'https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    reviewCount: 212,
  },
  {
    id: 'body-500',
    name: 'Botanical Body Oil',
    description: 'Camellia + sage oil infused for 72 hours.',
    price: 32,
    category: 'Wellness',
    stockCount: 17,
    imageUrl:
      'https://images.unsplash.com/photo-1506812574058-fc75fa93fead?auto=format&fit=crop&w=600&q=80',
    rating: 4.7,
    reviewCount: 131,
  },
]

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80'

const MAX_RETRIES = Number(import.meta.env.VITE_WS_MAX_RETRIES ?? 5)
const BACKOFF_BASE_MS = Number(import.meta.env.VITE_WS_BACKOFF_BASE_MS ?? 1000)
const BACKOFF_CAP_MS = Number(import.meta.env.VITE_WS_BACKOFF_CAP_MS ?? 30000)
const SNAPSHOT_POLL_INTERVAL_MS = Number(
  import.meta.env.VITE_SNAPSHOT_POLL_INTERVAL_MS ?? 30000,
)

const cachedProducts = new Map<string, Product>()

/**
 * Subscribes to the mandated real-time data adapter via WebSocket.
 * Automatically falls back to snapshot polling or mock data with
 * exponential backoff retry logic.
 */
export function subscribeToProducts(
  appId: string,
  onSnapshot: ProductSnapshotHandler,
  options?: SubscribeOptions,
): () => void {
  if (typeof window === 'undefined') {
    console.warn('[dataAdapter] subscribeToProducts requires a browser environment.')
    return () => undefined
  }

  const wsUrl = import.meta.env.VITE_PRODUCTS_WS_URL
  const mockEnabled =
    (import.meta.env.VITE_ENABLE_MOCK_DATA ?? 'true').toString().toLowerCase() !== 'false'
  const snapshotUrl = resolveSnapshotUrl(appId)

  const notifyMode = (mode: ConnectionMode) => {
    options?.onChannelChange?.(mode)
  }

  if (!wsUrl) {
    if (snapshotUrl) {
      notifyMode('snapshot')
      return startSnapshotFallback(appId, snapshotUrl, onSnapshot)
    }
    if (mockEnabled) {
      notifyMode('mock')
      return createMockRealtimeFeed(onSnapshot)
    }
    console.warn(
      '[dataAdapter] No realtime adapter or snapshot URL configured. Provide VITE_PRODUCTS_WS_URL, VITE_PRODUCTS_SNAPSHOT_URL, or enable mock data.',
    )
    onSnapshot([])
    notifyMode('offline')
    return () => undefined
  }

  const placeholder = sanitizeBatch(FALLBACK_PRODUCTS, false)
  if (placeholder.length) {
    onSnapshot(placeholder)
  }

  const connectionUrl = new URL(wsUrl)
  connectionUrl.searchParams.set('collection', `/artifacts/${appId}/public/data/products`)

  let socket: WebSocket | null = null
  let retryCount = 0
  let reconnectTimer: number | null = null
  let fallbackCleanup: (() => void) | null = null
  let disposed = false
  let inFallbackMode = false

  const subscribePayload = JSON.stringify({
    type: 'subscribe',
    collection: `/artifacts/${appId}/public/data/products`,
  })

  const connect = () => {
    if (disposed || inFallbackMode) {
      return
    }
    socket = new WebSocket(connectionUrl.toString())
    socket.addEventListener('open', handleOpen)
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('error', handleError)
    socket.addEventListener('close', handleClose)
  }

  const cleanup = () => {
    disposed = true
    if (socket) {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('message', handleMessage)
      socket.removeEventListener('error', handleError)
      socket.removeEventListener('close', handleClose)
      socket.close()
      socket = null
    }
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
    }
    fallbackCleanup?.()
  }

  const handleOpen = () => {
    retryCount = 0
    socket?.send(subscribePayload)
    notifyMode('live')
  }

  const handleMessage = (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data)
      if (Array.isArray(payload.products)) {
        onSnapshot(sanitizeBatch(payload.products))
      } else if (payload.product) {
        onSnapshot(upsertProductFromPayload(payload.product))
      }
    } catch (error) {
      console.error('[dataAdapter] Failed to parse payload', error)
    }
  }

  const handleError = (event: Event) => {
    console.warn('[dataAdapter] WebSocket error encountered', event)
  }

  const handleClose = () => {
    if (disposed || inFallbackMode) {
      return
    }
    if (retryCount >= MAX_RETRIES) {
      enterFallbackMode('Maximum retries exceeded')
      return
    }
    const delay = Math.min(BACKOFF_BASE_MS * 2 ** retryCount, BACKOFF_CAP_MS)
    retryCount += 1
    reconnectTimer = window.setTimeout(connect, delay)
  }

  const enterFallbackMode = (reason: string) => {
    if (inFallbackMode) {
      return
    }
    console.warn(`[dataAdapter] ${reason}. Switching to degraded mode.`)
    inFallbackMode = true
    if (socket) {
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('message', handleMessage)
      socket.removeEventListener('error', handleError)
      socket.removeEventListener('close', handleClose)
      socket.close()
      socket = null
    }

    if (snapshotUrl) {
      notifyMode('snapshot')
      fallbackCleanup = startSnapshotFallback(appId, snapshotUrl, onSnapshot)
      return
    }

    if (mockEnabled) {
      notifyMode('mock')
      fallbackCleanup = createMockRealtimeFeed(onSnapshot)
      return
    }

    onSnapshot([])
    notifyMode('offline')
  }

  connect()
  return cleanup
}

export async function fetchProductSnapshot(
  appId: string,
  options?: { signal?: AbortSignal; resolvedUrl?: string | null },
): Promise<Product[]> {
  const snapshotUrl = options?.resolvedUrl ?? resolveSnapshotUrl(appId)
  if (!snapshotUrl) {
    throw new Error('Snapshot URL is not configured')
  }

  const response = await fetch(snapshotUrl, {
    headers: { accept: 'application/json' },
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new Error(`Snapshot request failed: ${response.status}`)
  }

  const body = await response.json()
  const payload = Array.isArray(body) ? body : Array.isArray(body?.products) ? body.products : []

  return sanitizeBatch(payload)
}

/**
 * Fetch products from the catalog API endpoint
 * This uses the new /api/catalog/products endpoint
 */
export async function fetchProductsFromCatalog(
  options?: {
    signal?: AbortSignal
    limit?: number
    offset?: number
    category?: string
    inStock?: boolean
    search?: string
  },
): Promise<Product[]> {
  // Use production URL for API calls (serverless functions only work in production/vercel dev)
  // In local dev with Vite, try to use vercel dev URL first, then fallback to production
  const isLocalDev = typeof window !== 'undefined' && 
                     (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  
  // Try vercel dev first (port 3000), then production URL
  const baseUrl = isLocalDev 
    ? import.meta.env.VITE_API_URL || 'http://localhost:3000'
    : typeof window !== 'undefined' 
      ? window.location.origin 
      : 'http://localhost:5173'
  
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.offset) params.set('offset', options.offset.toString())
  if (options?.category) params.set('category', options.category)
  if (options?.inStock !== undefined) params.set('in_stock', options.inStock.toString())
  if (options?.search) params.set('search', options.search)

  const url = `${baseUrl}/api/catalog/products${params.toString() ? `?${params.toString()}` : ''}`

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: options?.signal,
    })

    if (!response.ok) {
      throw new Error(`Catalog API request failed: ${response.status}`)
    }

    // Check if response is actually JSON (not JavaScript source code)
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Catalog API returned non-JSON response. Make sure you are using vercel dev or the deployed URL.')
    }

            const body = await response.json()
            // API now returns a direct JSON array instead of { products: [...] }
            const products = Array.isArray(body) ? body : (Array.isArray(body?.products) ? body.products : [])

    // Transform API response to match Product type
    // Note: Category is already mapped by the API endpoint using the lookup table
    return sanitizeBatch(products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price || 0,
      category: p.category || 'Uncategorized', // Already mapped by API
      stockCount: p.stock_count || 0,
      imageUrl: p.image_url || PLACEHOLDER_IMAGE,
      rating: p.rating || 0,
      reviewCount: p.review_count || 0,
    })))
  } catch (error) {
    // If it's a CORS or network error, provide helpful message
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      if (isLocalDev) {
        throw new Error('Catalog API not available. Run "vercel dev" in a separate terminal to enable the API locally, or test on the deployed URL.')
      }
      throw new Error('Failed to fetch products from catalog API. Check your network connection.')
    }
    // If it's a JSON parse error, provide a helpful message
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new Error('Catalog API endpoint not available. Use "vercel dev" for local development or test on the deployed URL.')
    }
    throw error
  }
}

export async function checkAdapterHealth(signal?: AbortSignal): Promise<boolean> {
  const healthUrl =
    import.meta.env.VITE_ADAPTER_HEALTH_URL ?? import.meta.env.ADAPTER_HEALTH_URL

  if (!healthUrl) {
    return false
  }

  try {
    const response = await fetch(healthUrl, { signal })
    if (!response.ok) {
      return false
    }
    if (response.headers.get('content-type')?.includes('application/json')) {
      const payload = await response.json()
      if (typeof payload?.status === 'string') {
        return ['ok', 'healthy', 'pass'].includes(payload.status.toLowerCase())
      }
    }
    return true
  } catch (error) {
    console.error('[dataAdapter] Health check failed', error)
    return false
  }
}

function createMockRealtimeFeed(onSnapshot: ProductSnapshotHandler): () => void {
  if (typeof window === 'undefined') {
    onSnapshot(sanitizeBatch(FALLBACK_PRODUCTS))
    return () => undefined
  }

  const state: MockState = {
    timer: null,
    products: sanitizeBatch(FALLBACK_PRODUCTS),
  }

  const pushUpdate = () => {
    const clone = cloneProducts(state.products)
    const target = clone[Math.floor(Math.random() * clone.length)]
    const delta = Math.random() > 0.5 ? 1 : -1
    target.stockCount = Math.max(0, target.stockCount + delta)
    state.products = clone
    onSnapshot(clone)
  }

  state.timer = window.setInterval(pushUpdate, 1500)
  onSnapshot(state.products)

  return () => {
    if (state.timer) {
      window.clearInterval(state.timer)
    }
  }
}

function startSnapshotFallback(
  appId: string,
  snapshotUrl: string,
  onSnapshot: ProductSnapshotHandler,
): () => void {
  if (typeof window === 'undefined') {
    fetchProductSnapshot(appId, { resolvedUrl: snapshotUrl })
      .then(onSnapshot)
      .catch((error) => {
        console.error('[dataAdapter] Snapshot fallback failed', error)
      })
    return () => undefined
  }

  let cancelled = false
  let timer: number | null = null

  const poll = async () => {
    try {
      const products = await fetchProductSnapshot(appId, {
        resolvedUrl: snapshotUrl,
      })
      if (!cancelled) {
        onSnapshot(products)
      }
    } catch (error) {
      console.error('[dataAdapter] Snapshot poll failed', error)
    }

    if (!cancelled) {
      timer = window.setTimeout(poll, SNAPSHOT_POLL_INTERVAL_MS)
    }
  }

  poll()

  return () => {
    cancelled = true
    if (timer) {
      window.clearTimeout(timer)
    }
  }
}

function resolveSnapshotUrl(appId: string): string | null {
  const raw =
    import.meta.env.VITE_PRODUCTS_SNAPSHOT_URL ??
    import.meta.env.PRODUCTS_SNAPSHOT_URL ??
    null

  if (!raw) {
    return null
  }

  const tokenized = raw
    .replace(':appId', encodeURIComponent(appId))
    .replace('{appId}', encodeURIComponent(appId))

  try {
    return new URL(
      tokenized,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    ).toString()
  } catch {
    return null
  }
}

function sanitizeBatch(payload: Product[], shouldCache = true): Product[] {
  return payload.map((product) => {
    const sanitized = sanitizeProduct(product)
    if (shouldCache) {
      cachedProducts.set(sanitized.id, sanitized)
    }
    return sanitized
  })
}

function upsertProductFromPayload(product: Product): Product[] {
  const sanitized = sanitizeProduct(product)
  cachedProducts.set(sanitized.id, sanitized)
  return Array.from(cachedProducts.values())
}

function cloneProducts(products: Product[]): Product[] {
  return products.map((product) => ({ ...product }))
}

function sanitizeProduct(product: Product): Product {
  const safeImage = sanitizeImageUrl(product.imageUrl)
  return {
    ...product,
    id: sanitizeText(product.id, { maxLength: 120 }) || crypto.randomUUID(),
    name: sanitizeText(product.name, { maxLength: 160 }),
    description: sanitizeText(product.description, { maxLength: 800 }),
    category: sanitizeText(product.category, { maxLength: 120 }),
    imageUrl: safeImage,
    price: coerceNumber(product.price, 0, 2),
    stockCount: Math.max(0, Math.round(coerceNumber(product.stockCount, 0, 0))),
    rating: clamp(coerceNumber(product.rating, 4.5, 1), 0, 5),
    reviewCount: Math.max(0, Math.round(coerceNumber(product.reviewCount, 0, 0))),
  }
}

function sanitizeImageUrl(url: string): string {
  const candidate = sanitizeText(url, { maxLength: 500 })
  if (candidate.startsWith('https://') || candidate.startsWith('http://')) {
    return candidate
  }
  return PLACEHOLDER_IMAGE
}

function coerceNumber(value: unknown, fallback: number, precision: number): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN
  if (Number.isNaN(numeric)) return fallback
  const factor = precision ? 10 ** precision : 1
  return precision ? Math.round(numeric * factor) / factor : numeric
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

