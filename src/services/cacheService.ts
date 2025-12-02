/**
 * Cache Service for Product Data
 * 
 * Provides a unified interface for caching product data.
 * Currently uses Neon PostgreSQL, but can be swapped for other backends.
 */

import { neon } from '@neondatabase/serverless'
import { enhanceProductWithInferences } from '../utils/productCategorizer.js'

const CACHE_KEY = 'square:products:spiralgroove'

// Initialize Neon client (lazy-loaded)
let sql: ReturnType<typeof neon> | null = null

function getSql() {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    sql = neon(databaseUrl)
  }
  return sql
}

export type CacheValue = {
  products: any[]
  timestamp: string
  count: number
}

/**
 * Get cached products from Neon database
 */
export async function getCachedProducts(appId: string = 'spiralgroove'): Promise<CacheValue | null> {
  try {
    const db = getSql()
    const key = `square:products:${appId}`
    
    const result = await db`
      SELECT value, updated_at
      FROM product_cache
      WHERE key = ${key}
      LIMIT 1
    `
    
    if (result.length === 0) {
      return null
    }
    
    const row = result[0]
    const value = row.value as CacheValue
    
    // Enhance products with inferred category, format, and status using enums
    const enhancedProducts = value.products.map((product: any) => {
      const enhanced = enhanceProductWithInferences({
        name: product.name || '',
        description: product.description || '',
        category: product.category,
        price: product.price || 0,
        stockCount: product.stockCount || 0,
        format: product.format,
        conditionSleeve: product.conditionSleeve,
        conditionMedia: product.conditionMedia,
        status: product.status,
      })
      
      return {
        ...product,
        ...enhanced,
      }
    })
    
    return {
      ...value,
      products: enhancedProducts,
      count: enhancedProducts.length,
      timestamp: row.updated_at.toISOString(),
    }
  } catch (error: any) {
    console.error('[Cache Service] Error reading from cache:', error)
    
    // Provide helpful error message if table doesn't exist
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      const helpfulError = new Error(
        'product_cache table does not exist. Please create it first. See QUICK_SETUP_CACHE.md'
      )
      helpfulError.cause = error
      throw helpfulError
    }
    
    throw error
  }
}

/**
 * Set cached products in Neon database
 */
export async function setCachedProducts(
  products: any[],
  appId: string = 'spiralgroove'
): Promise<void> {
  try {
    const db = getSql()
    const key = `square:products:${appId}`
    
    const cacheValue: CacheValue = {
      products,
      timestamp: new Date().toISOString(),
      count: products.length,
    }
    
    await db`
      INSERT INTO product_cache (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(cacheValue)}::jsonb, NOW())
      ON CONFLICT (key) 
      DO UPDATE SET 
        value = ${JSON.stringify(cacheValue)}::jsonb,
        updated_at = NOW()
    `
    
    console.log(`[Cache Service] Cached ${products.length} products for ${appId}`)
  } catch (error: any) {
    console.error('[Cache Service] Error writing to cache:', error)
    
    // Provide helpful error message if table doesn't exist
    if (error?.message?.includes('does not exist') || error?.message?.includes('relation')) {
      const helpfulError = new Error(
        'product_cache table does not exist. Please run the migration:\n' +
        '1. Go to https://console.neon.tech\n' +
        '2. Open SQL Editor\n' +
        '3. Run: CREATE TABLE IF NOT EXISTS product_cache (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());'
      )
      helpfulError.cause = error
      throw helpfulError
    }
    
    throw error
  }
}

/**
 * Clear cached products (useful for testing or manual refresh)
 */
export async function clearCachedProducts(appId: string = 'spiralgroove'): Promise<void> {
  try {
    const db = getSql()
    const key = `square:products:${appId}`
    
    await db`
      DELETE FROM product_cache
      WHERE key = ${key}
    `
    
    console.log(`[Cache Service] Cleared cache for ${appId}`)
  } catch (error) {
    console.error('[Cache Service] Error clearing cache:', error)
    throw error
  }
}

