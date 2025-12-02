/**
 * Order Sync Service
 * 
 * Syncs orders and transactions from Square webhooks to Order and Order_Item tables
 */

import { neon } from '@neondatabase/serverless'
import { OrderStatus } from '../types/productEnums.js'

export type SquareOrder = {
  id: string
  orderNumber?: string
  locationId?: string
  customerId?: string | null
  totalAmount: number
  status: string
  lineItems?: Array<{
    uid?: string
    name?: string
    quantity?: string
    itemType?: string
    basePriceMoney?: {
      amount?: number | bigint
      currency?: string
    }
    catalogObjectId?: string
    catalogVersion?: number
  }>
  createdAt?: string
  updatedAt?: string
}

/**
 * Map Square order state to our OrderStatus enum
 */
function mapSquareOrderStateToStatus(state: string): string {
  const stateMap: Record<string, string> = {
    'DRAFT': OrderStatus.PENDING,
    'OPEN': OrderStatus.PROCESSING,
    'COMPLETED': OrderStatus.CONFIRMED,
    'CANCELED': OrderStatus.CANCELLED,
  }
  return stateMap[state] || OrderStatus.PROCESSING
}

/**
 * Sync a Square order to the database
 */
export async function syncOrderToDatabase(
  order: SquareOrder,
  databaseUrl: string
): Promise<{ orderId: number; inserted: boolean; updated: boolean }> {
  const sql = neon(databaseUrl)

  // Generate order number if not provided
  const orderNumber = order.orderNumber || order.id || `SQ-${order.id}`

  // Convert amount from cents to dollars
  const totalAmount = typeof order.totalAmount === 'bigint'
    ? Number(order.totalAmount) / 100
    : Number(order.totalAmount) / 100

  // Map Square order state to our status
  const status = mapSquareOrderStateToStatus(order.status)

  // Check if order exists
  const existing = await sql`
    SELECT order_id FROM "Order" WHERE order_number = ${orderNumber}
  `

  const wasExisting = existing.length > 0
  let orderId: number

  if (wasExisting) {
    orderId = existing[0].order_id

    // Update existing order
    await sql`
      UPDATE "Order"
      SET
        total_amount = ${totalAmount},
        current_status = ${status},
        customer_id = ${order.customerId ? parseInt(order.customerId) : null}
      WHERE order_id = ${orderId}
    `
  } else {
    // Insert new order
    const result = await sql`
      INSERT INTO "Order" (
        order_number,
        customer_id,
        total_amount,
        current_status,
        created_at
      )
      VALUES (
        ${orderNumber},
        ${order.customerId ? parseInt(order.customerId) : null},
        ${totalAmount},
        ${status},
        ${order.createdAt ? new Date(order.createdAt) : new Date()}
      )
      RETURNING order_id
    `
    orderId = result[0].order_id
  }

  // Sync order items
  if (order.lineItems && order.lineItems.length > 0) {
    // Delete existing order items (we'll recreate them)
    await sql`
      DELETE FROM "Order_Item" WHERE order_id = ${orderId}
    `

    // Insert order items
    for (const lineItem of order.lineItems) {
      // Only process ITEM type line items (skip modifiers, taxes, etc.)
      if (lineItem.itemType !== 'ITEM' || !lineItem.catalogObjectId) {
        continue
      }

      const quantity = parseInt(lineItem.quantity || '1')
      const priceAmount = lineItem.basePriceMoney?.amount
      const priceAtPurchase = priceAmount
        ? (typeof priceAmount === 'bigint' ? Number(priceAmount) : Number(priceAmount)) / 100
        : 0

      try {
        await sql`
          INSERT INTO "Order_Item" (
            order_id,
            square_item_id,
            quantity,
            price_at_purchase
          )
          VALUES (
            ${orderId},
            ${lineItem.catalogObjectId},
            ${quantity},
            ${priceAtPurchase}
          )
        `
      } catch (error: any) {
        // If foreign key fails, product doesn't exist in Square_Item yet
        // Log and continue - product will be synced later
        console.warn(
          `[OrderSync] Could not add order item: product ${lineItem.catalogObjectId} not in Square_Item table`
        )
      }
    }
  }

  return {
    orderId,
    inserted: !wasExisting,
    updated: wasExisting,
  }
}

/**
 * Extract order data from Square webhook event
 */
export function extractOrderFromWebhook(event: any): SquareOrder | null {
  // Square webhook structure varies by event type
  // For order.created, order.updated: event.data.object contains the order
  const order = event.data?.object

  if (!order || !order.id) {
    return null
  }

  return {
    id: order.id,
    orderNumber: order.reference_id || order.id,
    locationId: order.location_id,
    customerId: order.customer_id || null,
    totalAmount: order.total_money?.amount || order.net_amounts?.total_money?.amount || 0,
    status: order.state || 'OPEN',
    lineItems: order.line_items || [],
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  }
}

