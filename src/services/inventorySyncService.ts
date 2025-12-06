/**
 * Inventory Sync Service
 * 
 * Handles inventory updates from Square webhooks
 */

import { syncInventoryLevel } from './dbSyncService.js'

/**
 * Process inventory update from Square webhook
 */
export async function processInventoryUpdate(
  event: any,
  databaseUrl: string
): Promise<void> {
  // Extract inventory data from webhook
  // Square inventory webhook structure: event.data.object contains the inventory count
  const inventoryData = event.data?.object

  if (!inventoryData) {
    console.log('[InventorySync] No inventory data in event')
    return
  }

  // Square inventory webhook can have different structures
  // Check for catalog_object_id and quantity
  const squareItemId = inventoryData.catalog_object_id || 
                       inventoryData.catalog_object?.id ||
                       inventoryData.object_id

  const quantity = inventoryData.quantity || 
                   inventoryData.quantity_on_hand ||
                   0

  if (!squareItemId) {
    console.log('[InventorySync] No square_item_id found in inventory data')
    return
  }

  console.log(`[InventorySync] Updating inventory for ${squareItemId}: ${quantity}`)

  try {
    await syncInventoryLevel(squareItemId, quantity, databaseUrl, 'webhook')
    console.log(`[InventorySync] ✅ Inventory updated for ${squareItemId}`)
  } catch (error: any) {
    console.error(`[InventorySync] ❌ Error updating inventory:`, error.message)
    throw error
  }
}

