/**
 * Database Sync Service
 * 
 * Syncs products from cache to Square_Item and Product_Detail tables
 */

import { neon } from '@neondatabase/serverless'
import { enhanceProductWithInferences } from '../utils/productCategorizer.js'

export type ProductForSync = {
  id: string
  name: string
  description?: string
  price: number
  stockCount: number
  imageUrl?: string
  category?: string
  format?: string
  conditionSleeve?: string
  conditionMedia?: string
  isStaffPick?: boolean
}

/**
 * Sync a single product to Square_Item table
 */
export async function syncProductToSquareItem(
  product: ProductForSync,
  databaseUrl: string
): Promise<{ inserted: boolean; updated: boolean }> {
  const sql = neon(databaseUrl)

  // Check if product exists
  const existing = await sql`
    SELECT square_item_id FROM "Square_Item" WHERE square_item_id = ${product.id}
  `

  const wasExisting = existing.length > 0

  // Insert or update Square_Item (without stock_level - that goes in Inventory table)
  await sql`
    INSERT INTO "Square_Item" (
      square_item_id,
      name,
      base_price,
      updated_at
    )
    VALUES (
      ${product.id},
      ${product.name || 'Unnamed'},
      ${product.price || 0},
      NOW()
    )
    ON CONFLICT (square_item_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      base_price = EXCLUDED.base_price,
      updated_at = NOW()
  `

  // Sync inventory to Inventory dimension table
  await syncInventoryLevel(product.id, product.stockCount, databaseUrl, 'sync')

  return {
    inserted: !wasExisting,
    updated: wasExisting,
  }
}

/**
 * Sync inventory level to Inventory dimension table
 */
export async function syncInventoryLevel(
  squareItemId: string,
  stockLevel: number,
  databaseUrl: string,
  source: string = 'webhook'
): Promise<void> {
  const sql = neon(databaseUrl)

  // Insert new inventory record (time-series)
  await sql`
    INSERT INTO "Inventory" (
      square_item_id,
      stock_level,
      recorded_at,
      source
    )
    VALUES (
      ${squareItemId},
      ${stockLevel},
      NOW(),
      ${source}
    )
  `
}

/**
 * Get current inventory level for a product
 * Returns the most recent inventory record
 */
export async function getCurrentInventoryLevel(
  squareItemId: string,
  databaseUrl: string
): Promise<number | null> {
  const sql = neon(databaseUrl)

  const result = await sql`
    SELECT stock_level
    FROM "Inventory"
    WHERE square_item_id = ${squareItemId}
    ORDER BY recorded_at DESC
    LIMIT 1
  `

  return result.length > 0 ? result[0].stock_level : null
}

/**
 * Sync a single product to Product_Detail table
 */
export async function syncProductToProductDetail(
  product: ProductForSync,
  databaseUrl: string
): Promise<{ inserted: boolean; updated: boolean }> {
  const sql = neon(databaseUrl)

  // Enhance product with inferred details
  const enhanced = enhanceProductWithInferences({
    name: product.name,
    description: product.description || '',
    category: product.category,
    price: product.price,
    stockCount: product.stockCount,
    format: product.format,
    conditionSleeve: product.conditionSleeve,
    conditionMedia: product.conditionMedia,
    status: undefined,
  })

  // Check if product detail exists
  const existing = await sql`
    SELECT square_item_id FROM "Product_Detail" WHERE square_item_id = ${product.id}
  `

  const wasExisting = existing.length > 0

  // Insert or update Product_Detail
  await sql`
    INSERT INTO "Product_Detail" (
      square_item_id,
      thumbnail_url,
      category,
      format,
      condition_sleeve,
      condition_media,
      full_description,
      is_staff_pick,
      updated_at
    )
    VALUES (
      ${product.id},
      ${product.imageUrl || null},
      ${enhanced.category || null},
      ${enhanced.format || null},
      ${enhanced.conditionSleeve || null},
      ${enhanced.conditionMedia || null},
      ${product.description || null},
      ${product.isStaffPick || false},
      NOW()
    )
    ON CONFLICT (square_item_id)
    DO UPDATE SET
      thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, "Product_Detail".thumbnail_url),
      category = COALESCE(EXCLUDED.category, "Product_Detail".category),
      format = COALESCE(EXCLUDED.format, "Product_Detail".format),
      condition_sleeve = COALESCE(EXCLUDED.condition_sleeve, "Product_Detail".condition_sleeve),
      condition_media = COALESCE(EXCLUDED.condition_media, "Product_Detail".condition_media),
      full_description = COALESCE(EXCLUDED.full_description, "Product_Detail".full_description),
      is_staff_pick = COALESCE(EXCLUDED.is_staff_pick, "Product_Detail".is_staff_pick),
      updated_at = NOW()
  `

  return {
    inserted: !wasExisting,
    updated: wasExisting,
  }
}

/**
 * Sync all products from cache to database
 */
export async function syncAllProductsToDatabase(
  products: ProductForSync[],
  databaseUrl: string
): Promise<{
  squareItem: { inserted: number; updated: number }
  productDetail: { inserted: number; updated: number }
}> {
  const results = {
    squareItem: { inserted: 0, updated: 0 },
    productDetail: { inserted: 0, updated: 0 },
  }

  for (const product of products) {
    try {
      // Sync to Square_Item first (required for foreign key)
      const squareItemResult = await syncProductToSquareItem(product, databaseUrl)
      if (squareItemResult.inserted) {
        results.squareItem.inserted++
      } else {
        results.squareItem.updated++
      }

      // Then sync to Product_Detail
      const productDetailResult = await syncProductToProductDetail(product, databaseUrl)
      if (productDetailResult.inserted) {
        results.productDetail.inserted++
      } else {
        results.productDetail.updated++
      }
    } catch (error: any) {
      console.error(`[DBSync] Error syncing product ${product.id}:`, error.message)
    }
  }

  return results
}

