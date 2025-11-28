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

export type SquareProduct = {
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

/**
 * Initialize Square client
 */
export function createSquareClient(config: SquareConfig) {
  return new SquareClient({
    accessToken: config.accessToken,
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
    
    // List all catalog objects
    const response = await catalog.listCatalog({ types: ['ITEM'] })
    
    if (response.result?.objects) {
      return response.result.objects.filter((obj: any) => obj.type === 'ITEM')
    }
    
    return []
  } catch (error) {
    console.error('[SquareAdapter] Error fetching catalog items:', error)
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
    
    const inventoryMap = new Map<string, number>()
    
    // Fetch inventory counts for all items at once
    try {
      const response = await inventory.batchRetrieveInventoryCounts({
        catalogObjectIds,
        locationIds: [locationId],
      })
      
      if (response.result?.counts) {
        // Group counts by catalog object ID
        for (const count of response.result.counts) {
          const catalogObjectId = count.catalogObjectId
          if (catalogObjectId) {
            const currentCount = inventoryMap.get(catalogObjectId) || 0
            inventoryMap.set(catalogObjectId, currentCount + (count.quantity || 0))
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
 * Transform Square catalog item to app Product format
 */
export function transformSquareItemToProduct(
  squareItem: any,
  inventoryCount: number = 0,
): SquareProduct {
  // Extract item data
  const itemData = squareItem.itemData || {}
  
  // Get primary image URL
  let imageUrl = ''
  if (itemData.imageIds && itemData.imageIds.length > 0) {
    // In a real implementation, you'd fetch the image URL from Square
    // For now, we'll use a placeholder or construct from image ID
    imageUrl = `https://square-cdn.com/${itemData.imageIds[0]}` // This is a placeholder
  }
  
  // Get price from variations
  let price = 0
  if (itemData.variations && itemData.variations.length > 0) {
    const firstVariation = itemData.variations[0]
    if (firstVariation.itemVariationData?.priceMoney) {
      const priceMoney = firstVariation.itemVariationData.priceMoney
      // Square prices are in cents, convert to dollars
      price = (priceMoney.amount || 0) / 100
    }
  }
  
  // Get category
  const category = itemData.categoryId || 'Uncategorized'
  
  return {
    id: squareItem.id || '',
    name: itemData.name || 'Unnamed Item',
    description: itemData.description || '',
    price,
    category,
    stockCount: inventoryCount,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80',
    rating: 4.5, // Default rating (Square doesn't provide ratings)
    reviewCount: 0, // Default review count
  }
}

/**
 * Main function to fetch all products from Square
 */
export async function fetchSquareProducts(config: SquareConfig): Promise<SquareProduct[]> {
  const client = createSquareClient(config)
  const locationId = config.locationId
  
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
    
    // Fetch inventory counts
    const inventoryMap = await fetchSquareInventory(client, catalogObjectIds, locationId)
    
    // Transform to app format
    const products = catalogItems.map((item: any) => {
      const inventoryCount = inventoryMap.get(item.id) || 0
      return transformSquareItemToProduct(item, inventoryCount)
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
  const locationId = config.locationId
  
  if (!locationId) {
    throw new Error('Square locationId is required')
  }
  
  try {
    const catalog = client.catalog
    const response = await catalog.retrieveCatalogObject(productId, { includeRelatedObjects: true })
    
    if (response.result?.object) {
      const inventoryMap = await fetchSquareInventory(client, [productId], locationId)
      const inventoryCount = inventoryMap.get(productId) || 0
      return transformSquareItemToProduct(response.result.object, inventoryCount)
    }
    
    return null
  } catch (error) {
    console.error('[SquareAdapter] Error fetching product:', error)
    return null
  }
}

