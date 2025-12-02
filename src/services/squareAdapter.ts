/**
 * Square SDK Adapter Service
 * 
 * This service uses the Square SDK to fetch catalog items and inventory.
 * 
 * IMPORTANT: This should be used server-side only (API routes, serverless functions, etc.)
 * Never expose Square access tokens in client-side code.
 * 
 * Usage:
 * - In a Next.js API route: import and use in /api/square/products
 * - In a Vercel serverless function: use in /api/square/products.ts
 * - In an Express backend: use in your API endpoints
 */

import { SquareClient, SquareEnvironment } from 'square'

export type SquareConfig = {
  accessToken: string
  environment: 'sandbox' | 'production'
  locationId?: string
  applicationId?: string
}

import type { ProductCategory, RecordFormat, RecordCondition, ProductStatus } from '../types/productEnums.js'
import { enhanceProductWithInferences } from '../utils/productCategorizer.js'

export type SquareProduct = {
  id: string
  name: string
  description: string
  price: number
  category: string | ProductCategory
  stockCount: number
  imageUrl: string
  rating: number
  reviewCount: number
  // Extended fields (optional)
  format?: RecordFormat | string
  conditionSleeve?: RecordCondition | string
  conditionMedia?: RecordCondition | string
  status?: ProductStatus
}

/**
 * Initialize Square client
 */
export function createSquareClient(config: SquareConfig) {
  return new SquareClient({
    token: config.accessToken,
    environment: config.environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  })
}

/**
 * Fetch all catalog items from Square
 */
export async function fetchSquareCatalogItems(
  client: SquareClient,
  locationId?: string,
): Promise<any[]> {
  try {
    const catalog = client.catalog
    
    // List catalog objects - types should be a comma-separated string
    console.log('[SquareAdapter] Fetching catalog objects with types: "ITEM"...')
    const response = await catalog.list({ types: 'ITEM' })
    
    const items: any[] = []
    let pageCount = 0
    let totalObjects = 0
    
    // The Page class iterates over CatalogObject items directly, not response objects
    for await (const catalogObject of response) {
      totalObjects++
      
      // Each item in the iteration is a CatalogObject
      if (catalogObject.type === 'ITEM') {
        items.push(catalogObject)
      }
      
      // Log every 10 items to avoid spam
      if (totalObjects % 10 === 0) {
        console.log(`[SquareAdapter] Processed ${totalObjects} objects, found ${items.length} ITEM objects so far...`)
      }
    }
    
    // Also check the response object for metadata
    if (response.response) {
      pageCount = 1 // We'll count pages differently
      const responseData = response.response as any
      console.log(`[SquareAdapter] Response metadata:`, {
        cursor: responseData.cursor,
        hasMore: response.hasNextPage(),
      })
    }
    
    console.log(`[SquareAdapter] Summary: ${items.length} ITEM objects found (${totalObjects} total objects processed)`)
    
    if (items.length > 0) {
      console.log(`[SquareAdapter] Item IDs:`, items.map((item: any) => item.id).slice(0, 10))
      if (items[0]) {
        console.log('[SquareAdapter] First item sample:', {
          id: items[0].id,
          type: items[0].type,
          name: items[0].itemData?.name,
          hasVariations: !!items[0].itemData?.variations?.length,
        })
      }
    }
    
    // If no items found, try listing ALL objects to see what's available
    if (items.length === 0) {
      console.log('[SquareAdapter] No ITEM objects found. Trying to list ALL catalog objects...')
      const allObjectsResponse = await catalog.list()
      let allObjects: any[] = []
      
      for await (const catalogObject of allObjectsResponse) {
        allObjects.push(catalogObject)
      }
      
      const objectTypes = [...new Set(allObjects.map((obj: any) => obj.type))]
      console.log(`[SquareAdapter] Total catalog objects: ${allObjects.length} of types:`, objectTypes)
      
      if (allObjects.length > 0) {
        // Filter for items
        const foundItems = allObjects.filter((obj: any) => obj.type === 'ITEM')
        console.log(`[SquareAdapter] Found ${foundItems.length} ITEM objects in all objects`)
        items.push(...foundItems)
      }
    }
    
    if (items.length === 0 && totalObjects === 0) {
      console.warn('[SquareAdapter] No catalog objects found. Your Square sandbox may be empty.')
      console.warn('[SquareAdapter] Add items via Square Dashboard or use the Square API to create test items.')
    }
    
    return items
  } catch (error) {
    console.error('[SquareAdapter] Error fetching catalog items:', error)
    if (error instanceof Error) {
      console.error('[SquareAdapter] Error details:', error.message, error.stack)
    }
    throw error
  }
}

/**
 * Fetch inventory counts for catalog items
 */
export async function fetchSquareInventory(
  client: SquareClient,
  catalogObjectIds: string[],
  locationId: string,
): Promise<Map<string, number>> {
  try {
    const inventory = client.inventory
    
    // Trim whitespace/newlines from locationId (common issue with .env files)
    const trimmedLocationId = locationId.trim()
    
    const inventoryMap = new Map<string, number>()
    
    // Fetch inventory counts for all items at once
    try {
      const response = await inventory.batchGetCounts({
        catalogObjectIds,
        locationIds: [trimmedLocationId],
      })
      
      // Iterate through paginated results
      for await (const page of response) {
        if (page.result?.counts) {
          // Group counts by catalog object ID
          for (const count of page.result.counts) {
            const catalogObjectId = count.catalogObjectId
            if (catalogObjectId) {
              const currentCount = inventoryMap.get(catalogObjectId) || 0
              // Convert BigInt to Number if needed
              let quantity = 0
              if (count.quantity != null) {
                quantity = typeof count.quantity === 'bigint' 
                  ? Number(count.quantity) 
                  : Number(count.quantity) || 0
              }
              inventoryMap.set(catalogObjectId, currentCount + quantity)
            }
          }
        }
      }
      
      // Set 0 for items that don't have inventory counts
      for (const catalogObjectId of catalogObjectIds) {
        if (!inventoryMap.has(catalogObjectId)) {
          inventoryMap.set(catalogObjectId, 0)
        }
      }
    } catch (error) {
      console.warn('[SquareAdapter] Error fetching inventory:', error)
      // Set all to 0 if batch fetch fails
      for (const catalogObjectId of catalogObjectIds) {
        inventoryMap.set(catalogObjectId, 0)
      }
    }
    
    return inventoryMap
  } catch (error) {
    console.error('[SquareAdapter] Error fetching inventory:', error)
    return new Map()
  }
}

/**
 * Fetch image URLs from Square catalog
 */
export async function fetchSquareImageUrls(
  client: SquareClient,
  imageIds: string[],
): Promise<Map<string, string>> {
  if (imageIds.length === 0) {
    return new Map()
  }

  try {
    const catalog = client.catalog
    const imageMap = new Map<string, string>()

    // Fetch image objects in batches (Square API limit is typically 100 objects per batch)
    const batchSize = 100
    for (let i = 0; i < imageIds.length; i += batchSize) {
      const batch = imageIds.slice(i, i + batchSize)
      const response = await catalog.batchGet({
        objectIds: batch,
        includeRelatedObjects: false,
      })

      if (response.result?.objects) {
        for (const obj of response.result.objects) {
          if (obj.type === 'IMAGE' && obj.imageData?.url) {
            imageMap.set(obj.id, obj.imageData.url)
          }
        }
      }
    }

    return imageMap
  } catch (error) {
    console.warn('[SquareAdapter] Error fetching image URLs:', error)
    return new Map()
  }
}

/**
 * Transform Square catalog item to app Product format
 */
export function transformSquareItemToProduct(
  squareItem: any,
  inventoryCount: number = 0,
  imageUrlMap?: Map<string, string>,
): SquareProduct {
  // Extract item data
  const itemData = squareItem.itemData || {}
  
  // Get primary image URL from the image map
  let imageUrl = ''
  if (itemData.imageIds && itemData.imageIds.length > 0 && imageUrlMap) {
    const firstImageId = itemData.imageIds[0]
    imageUrl = imageUrlMap.get(firstImageId) || ''
  }
  
  // Get price from variations
  let price = 0
  if (itemData.variations && itemData.variations.length > 0) {
    const firstVariation = itemData.variations[0]
    if (firstVariation.itemVariationData?.priceMoney) {
      const priceMoney = firstVariation.itemVariationData.priceMoney
      // Square prices are in cents as BigInt, convert to dollars
      if (priceMoney.amount != null) {
        // Convert BigInt to Number before division
        const amount = typeof priceMoney.amount === 'bigint' 
          ? Number(priceMoney.amount) 
          : Number(priceMoney.amount) || 0
        price = amount / 100
      }
    }
  }
  
  // Get category (Square uses categoryId, but we'll infer from name if needed)
  const rawCategory = itemData.categoryId || 'Uncategorized'
  
  // Create base product
  const baseProduct = {
    id: squareItem.id || '',
    name: itemData.name || 'Unnamed Item',
    description: itemData.description || '',
    price,
    category: rawCategory,
    stockCount: inventoryCount,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
    rating: 4.5, // Default rating (Square doesn't provide ratings)
    reviewCount: 0, // Default review count
  }
  
  // Enhance with inferred details using enums
  const enhanced = enhanceProductWithInferences(baseProduct)
  
  return {
    ...baseProduct,
    ...enhanced,
  }
}

/**
 * Main function to fetch all products from Square
 */
export async function fetchSquareProducts(config: SquareConfig): Promise<SquareProduct[]> {
  const client = createSquareClient(config)
  // Trim whitespace/newlines from locationId (common issue with .env files)
  const locationId = config.locationId?.trim()
  
  if (!locationId) {
    throw new Error('Square locationId is required')
  }
  
  try {
    // Fetch catalog items
    const catalogItems = await fetchSquareCatalogItems(client, locationId)
    
    if (catalogItems.length === 0) {
      return []
    }
    
    // Get catalog object IDs
    const catalogObjectIds = catalogItems
      .map((item: any) => item.id)
      .filter((id: string) => id)
    
    // Collect all image IDs from items
    const imageIds: string[] = []
    for (const item of catalogItems) {
      const itemData = item.itemData || {}
      if (itemData.imageIds && Array.isArray(itemData.imageIds)) {
        imageIds.push(...itemData.imageIds)
      }
    }
    
    // Remove duplicates
    const uniqueImageIds = [...new Set(imageIds)]
    console.log(`[SquareAdapter] Found ${uniqueImageIds.length} image IDs (${uniqueImageIds.length} unique)`)
    
    // Fetch image URLs
    const imageUrlMap = await fetchSquareImageUrls(client, uniqueImageIds)
    console.log(`[SquareAdapter] Fetched ${imageUrlMap.size} image URLs`)
    
    // Fetch inventory counts
    const inventoryMap = await fetchSquareInventory(client, catalogObjectIds, locationId)
    
    // Transform to app format
    const products = catalogItems.map((item: any) => {
      const inventoryCount = inventoryMap.get(item.id) || 0
      return transformSquareItemToProduct(item, inventoryCount, imageUrlMap)
    })
    
    return products
  } catch (error) {
    console.error('[SquareAdapter] Error fetching products:', error)
    throw error
  }
}

/**
 * Fetch a single product by ID
 */
export async function fetchSquareProductById(
  config: SquareConfig,
  productId: string,
): Promise<SquareProduct | null> {
  const client = createSquareClient(config)
  // Trim whitespace/newlines from locationId (common issue with .env files)
  const locationId = config.locationId?.trim()
  
  if (!locationId) {
    throw new Error('Square locationId is required')
  }
  
  try {
    const catalog = client.catalog
    const response = await catalog.batchGet({
      objectIds: [productId],
      includeRelatedObjects: true,
    })
    
    if (response.result?.objects && response.result.objects.length > 0) {
      const object = response.result.objects[0]
      
      // Get image IDs from the item
      const itemData = object.itemData || {}
      const imageIds = itemData.imageIds || []
      
      // Fetch image URLs
      const imageUrlMap = await fetchSquareImageUrls(client, imageIds)
      
      // Fetch inventory
      const inventoryMap = await fetchSquareInventory(client, [productId], locationId)
      const inventoryCount = inventoryMap.get(productId) || 0
      
      return transformSquareItemToProduct(object, inventoryCount, imageUrlMap)
    }
    
    return null
  } catch (error) {
    console.error('[SquareAdapter] Error fetching product:', error)
    return null
  }
}

