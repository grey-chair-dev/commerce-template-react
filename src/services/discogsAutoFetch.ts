/**
 * Automatic Discogs Data Fetching
 * 
 * Fetches Discogs data for new music products with rate limiting
 */

import { neon } from '@neondatabase/serverless'
import { 
  matchProductToDiscogs, 
  getDiscogsRelease, 
  extractTracklist,
  type DiscogsConfig 
} from './discogsAdapter.js'
import { discogsRateLimiter } from './discogsRateLimiter.js'
import { isMusicProduct, hasDiscogsData } from '../utils/isMusicProduct.js'

export type ProductForDiscogs = {
  id: string
  name: string
  description?: string
  category?: string
  format?: string
  discogsReleaseId?: number | null
  tracklist?: any[] | null
}

/**
 * Fetch Discogs data for a product and store in database
 */
export async function fetchAndStoreDiscogsData(
  product: ProductForDiscogs,
  config: DiscogsConfig,
  databaseUrl: string
): Promise<{
  success: boolean
  releaseId?: number
  tracklist?: any[]
  error?: string
}> {
  // Check if product is music-related
  if (!isMusicProduct(product)) {
    console.log(`[DiscogsAutoFetch] Skipping ${product.id}: not a music product`)
    return { success: false, error: 'Not a music product' }
  }

  // Check if we already have Discogs data
  if (hasDiscogsData(product)) {
    console.log(`[DiscogsAutoFetch] Skipping ${product.id}: already has Discogs data`)
    return { success: false, error: 'Already has Discogs data' }
  }

  try {
    const sql = neon(databaseUrl)

    // Step 1: Search for release ID (rate limited)
    console.log(`[DiscogsAutoFetch] Searching Discogs for: "${product.name}"`)
    const releaseId = await discogsRateLimiter.execute(() =>
      matchProductToDiscogs(product.name, config)
    )

    if (!releaseId) {
      console.log(`[DiscogsAutoFetch] No Discogs match found for: "${product.name}"`)
      return { success: false, error: 'No Discogs match found' }
    }

    // Step 2: Fetch release details (rate limited)
    console.log(`[DiscogsAutoFetch] Fetching release ${releaseId} from Discogs`)
    const release = await discogsRateLimiter.execute(() =>
      getDiscogsRelease(releaseId, config)
    )

    const tracklist = extractTracklist(release)

    // Step 3: Store in database
    try {
      await sql`
        INSERT INTO "Product_Detail" (
          square_item_id,
          tracklist,
          discogs_release_id,
          discogs_year,
          discogs_label,
          discogs_updated_at,
          updated_at
        )
        VALUES (
          ${product.id},
          ${JSON.stringify(tracklist)}::jsonb,
          ${releaseId},
          ${release.year || null},
          ${release.labels?.[0]?.name || null},
          NOW(),
          NOW()
        )
        ON CONFLICT (square_item_id)
        DO UPDATE SET
          tracklist = ${JSON.stringify(tracklist)}::jsonb,
          discogs_release_id = ${releaseId},
          discogs_year = ${release.year || null},
          discogs_label = ${release.labels?.[0]?.name || null},
          discogs_updated_at = NOW(),
          updated_at = NOW()
      `
      console.log(`[DiscogsAutoFetch] ✅ Stored Discogs data for product ${product.id}`)
      
      return {
        success: true,
        releaseId,
        tracklist,
      }
    } catch (error: any) {
      // If foreign key constraint fails, product doesn't exist in Square_Item yet
      if (error.message?.includes('foreign key') || error.message?.includes('violates foreign key')) {
        console.warn(`[DiscogsAutoFetch] ⚠️  Product ${product.id} not in Square_Item table yet, skipping storage`)
        return {
          success: false,
          error: 'Product not in Square_Item table',
        }
      }
      throw error
    }
  } catch (error: any) {
    console.error(`[DiscogsAutoFetch] ❌ Error fetching Discogs data for ${product.id}:`, error.message)
    return {
      success: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Fetch Discogs data for multiple products (with rate limiting)
 */
export async function fetchDiscogsForNewProducts(
  products: ProductForDiscogs[],
  config: DiscogsConfig,
  databaseUrl: string
): Promise<{
  processed: number
  successful: number
  failed: number
  skipped: number
}> {
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
  }

  console.log(`[DiscogsAutoFetch] Processing ${products.length} products for Discogs data`)

  for (const product of products) {
    results.processed++
    
    const result = await fetchAndStoreDiscogsData(product, config, databaseUrl)
    
    if (result.success) {
      results.successful++
    } else if (result.error === 'Not a music product' || result.error === 'Already has Discogs data') {
      results.skipped++
    } else {
      results.failed++
    }

    // Log progress every 10 products
    if (results.processed % 10 === 0) {
      console.log(`[DiscogsAutoFetch] Progress: ${results.processed}/${products.length} processed`)
    }
  }

  console.log(`[DiscogsAutoFetch] Complete: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`)
  
  return results
}

