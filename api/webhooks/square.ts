/**
 * Square Webhook Endpoint
 * 
 * Receives webhook notifications from Square when catalog or inventory changes.
 * When triggered, this endpoint:
 * 1. Verifies the webhook signature for security
 * 2. Fetches fresh data from Square
 * 3. Transforms and caches the data for fast frontend reads
 * 
 * Configure this URL in Square Dashboard:
 * https://your-app.vercel.app/api/webhooks/square
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { setCachedProducts, getCachedProducts } from '../../src/services/cacheService.js'
import { fetchSquareProducts, type SquareConfig } from '../../src/services/squareAdapter.js'
import { fetchDiscogsForNewProducts } from '../../src/services/discogsAutoFetch.js'
import { syncAllProductsToDatabase } from '../../src/services/dbSyncService.js'
import { syncOrderToDatabase, extractOrderFromWebhook } from '../../src/services/orderSyncService.js'
import { processInventoryUpdate } from '../../src/services/inventorySyncService.js'

/**
 * Verify Square webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  signatureKey: string,
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', signatureKey)
    hmac.update(payload)
    const computedSignature = hmac.digest('base64')
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature),
    )
  } catch (error) {
    console.error('[Webhook] Signature verification error:', error)
    return false
  }
}

/**
 * Process and cache products from Square
 */
async function refreshProductsCache(): Promise<void> {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
  // Trim whitespace/newlines from locationId (common issue with .env files)
  const locationId = process.env.SQUARE_LOCATION_ID?.trim()
  const databaseUrl = process.env.DATABASE_URL

  if (!accessToken || !locationId) {
    throw new Error('Square credentials not configured')
  }

  const config: SquareConfig = {
    accessToken,
    environment,
    locationId,
  }

  console.log('[Webhook] Fetching fresh products from Square...')
  const products = await fetchSquareProducts(config)
  
  console.log(`[Webhook] Caching ${products.length} products`)
  
  // Cache the products in Neon database
  await setCachedProducts(products, 'spiralgroove')
  
  console.log('[Webhook] Products cached successfully')

  // Sync products to database tables (Square_Item and Product_Detail)
  if (databaseUrl) {
    console.log('[Webhook] Syncing products to database tables...')
    try {
      const syncResults = await syncAllProductsToDatabase(products, databaseUrl)
      console.log(`[Webhook] Database sync complete:`)
      console.log(`  Square_Item: ${syncResults.squareItem.inserted} inserted, ${syncResults.squareItem.updated} updated`)
      console.log(`  Product_Detail: ${syncResults.productDetail.inserted} inserted, ${syncResults.productDetail.updated} updated`)
    } catch (error: any) {
      console.error('[Webhook] Error syncing products to database:', error.message)
      // Don't throw - cache update succeeded, DB sync can be retried
    }
  } else {
    console.warn('[Webhook] DATABASE_URL not configured, skipping database sync')
  }
}

/**
 * Process new items and fetch Discogs data for music products
 */
async function processNewItemsForDiscogs(event: any): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  const discogsToken = process.env.DISCOGS_USER_TOKEN
  const discogsUserAgent = process.env.DISCOGS_USER_AGENT || 'SpiralGroove/1.0'

  if (!databaseUrl || !discogsToken) {
    console.warn('[Webhook] Discogs credentials not configured, skipping Discogs fetch')
    return
  }

  // Only process item.created events
  const isItemCreated = event.type === 'catalog.item.created' || 
                        event.type?.includes('item.created') ||
                        event.data?.type === 'ITEM' && event.type?.includes('created')

  if (!isItemCreated) {
    return
  }

  try {
    // Get the new item from the event
    // Square webhook structure: event.data.object contains the catalog object
    const catalogObject = event.data?.object
    const newItem = catalogObject?.itemData || catalogObject
    
    if (!newItem || !newItem.name) {
      console.log('[Webhook] No item data in event, skipping Discogs fetch')
      return
    }

    // Get cached products to check if this is truly new
    const cached = await getCachedProducts('spiralgroove')
    const existingProduct = cached?.products.find((p: any) => p.id === catalogObject?.id || p.name === newItem.name)

    if (existingProduct) {
      console.log(`[Webhook] Product "${newItem.name}" already exists, skipping Discogs fetch`)
      return
    }

    // Create product object for Discogs fetch
    const product = {
      id: catalogObject?.id || '',
      name: newItem.name || '',
      description: newItem.description || '',
      category: 'Uncategorized', // Will be enhanced by categorizer
      format: undefined,
      discogsReleaseId: null,
      tracklist: null,
    }

    console.log(`[Webhook] New item detected: "${product.name}" (ID: ${product.id}), fetching Discogs data...`)

    // Fetch Discogs data (with rate limiting)
    const result = await fetchDiscogsForNewProducts(
      [product],
      {
        userToken: discogsToken,
        userAgent: discogsUserAgent,
      },
      databaseUrl
    )

    console.log(`[Webhook] Discogs fetch result: ${result.successful} successful, ${result.failed} failed, ${result.skipped} skipped`)
  } catch (error: any) {
    console.error('[Webhook] Error processing new item for Discogs:', error.message)
    // Don't throw - we don't want to fail the webhook if Discogs fetch fails
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (Square sends webhooks via POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  if (!signatureKey) {
    console.warn('[Webhook] SQUARE_WEBHOOK_SIGNATURE_KEY not configured, skipping signature verification')
  }

  // Get the raw body for signature verification
  // Note: Vercel automatically parses JSON, so we reconstruct the raw body
  const rawBody = typeof req.body === 'string' 
    ? req.body 
    : JSON.stringify(req.body)
  
  // Verify webhook signature if key is configured
  const signature = req.headers['x-square-signature'] as string
  if (signatureKey && signature) {
    const isValid = verifyWebhookSignature(rawBody, signature, signatureKey)
    if (!isValid) {
      console.error('[Webhook] Invalid signature')
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }
    console.log('[Webhook] Signature verified successfully')
  }

  try {
    const event = req.body as any
    
    // Log the webhook event type
    console.log('[Webhook] Received Square webhook:', {
      type: event.type,
      eventId: event.event_id,
      merchantId: event.merchant_id,
    })

    // Process different event types
    const catalogEvents = [
      'catalog.version.updated',
      'catalog.item.created',
      'catalog.item.updated',
      'catalog.item.deleted',
    ]

    const inventoryEvents = [
      'inventory.count.updated',
      'inventory.physical_count.updated',
      'inventory.adjustment.created',
    ]

    const orderEvents = [
      'order.created',
      'order.updated',
      'payment.created',
      'payment.updated',
      'refund.created',
    ]

    const isCatalogEvent = catalogEvents.some(eventType => 
      event.type?.includes(eventType) || 
      event.data?.type?.includes('CATALOG')
    )

    const isInventoryEvent = inventoryEvents.some(eventType => 
      event.type?.includes(eventType) ||
      event.type?.includes('inventory')
    )

    const isOrderEvent = orderEvents.some(eventType => 
      event.type?.includes(eventType)
    )

    // Handle inventory events (separate from catalog events)
    if (isInventoryEvent) {
      const databaseUrl = process.env.DATABASE_URL
      if (databaseUrl) {
        console.log(`[Webhook] Processing inventory update: ${event.type}`)
        processInventoryUpdate(event, databaseUrl)
          .then(() => {
            console.log('[Webhook] Inventory update processed successfully')
          })
          .catch((error) => {
            console.error('[Webhook] Error processing inventory update:', error.message)
          })
      } else {
        console.warn('[Webhook] DATABASE_URL not configured, skipping inventory sync')
      }

      // Respond immediately
      return res.status(200).json({
        received: true,
        message: 'Inventory webhook received, processing',
      })
    }

    // Handle order/transaction events
    if (isOrderEvent) {
      const databaseUrl = process.env.DATABASE_URL
      if (databaseUrl) {
        const order = extractOrderFromWebhook(event)
        if (order) {
          console.log(`[Webhook] Processing order: ${order.id} (${order.orderNumber})`)
          syncOrderToDatabase(order, databaseUrl)
            .then((result) => {
              console.log(`[Webhook] Order synced: ${result.inserted ? 'inserted' : 'updated'} (ID: ${result.orderId})`)
            })
            .catch((error) => {
              console.error('[Webhook] Error syncing order:', error.message)
            })
        } else {
          console.log('[Webhook] Could not extract order data from event')
        }
      } else {
        console.warn('[Webhook] DATABASE_URL not configured, skipping order sync')
      }

      // Respond immediately
      return res.status(200).json({
        received: true,
        message: 'Order webhook received, processing',
      })
    }

    // Handle catalog events
    if (isCatalogEvent) {
      // Refresh the cache asynchronously (don't wait for it)
      refreshProductsCache()
        .then(() => {
          // After cache refresh, check for new items and fetch Discogs data
          return processNewItemsForDiscogs(event)
        })
        .catch((error) => {
          console.error('[Webhook] Error refreshing cache:', error)
        })

      // Respond immediately to Square (don't wait for cache refresh or Discogs fetch)
      return res.status(200).json({
        received: true,
        message: 'Webhook received, cache refresh and Discogs fetch initiated',
      })
    }

    // Unknown event type
    console.log('[Webhook] Event type does not require processing:', event.type)
    return res.status(200).json({ 
      received: true,
      message: 'Event received but no processing needed',
    })
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error)
    return res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message || 'Unknown error',
    })
  }
}

