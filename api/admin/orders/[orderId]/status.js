/**
 * Admin Order Status Update Endpoint
 * 
 * PUT /api/admin/orders/:orderId/status
 * 
 * Updates a specific order's status
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { SquareClient, SquareEnvironment } from 'square';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config();

// Helper function to get admin password (loads fresh each time for serverless)
function getAdminPassword() {
  let password = process.env.ADMIN_PASSWORD || '';
  if (password) {
    password = password.trim().replace(/^["']|["']$/g, '');
  }
  return password;
}

function getAdminPasswordHash() {
  let hash = process.env.ADMIN_PASSWORD_HASH || '';
  if (hash) {
    hash = hash.trim().replace(/^["']|["']$/g, '');
  }
  return hash;
}

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://commerce-template-react.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed.split('://')[1]))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify admin password
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin password required',
    });
  }

  const providedPassword = authHeader.replace('Bearer ', '').trim();
  
  // Get password fresh from environment (important for serverless)
  const ADMIN_PASSWORD = getAdminPassword();
  const ADMIN_PASSWORD_HASH = getAdminPasswordHash();
  
  let passwordValid = false;
  if (ADMIN_PASSWORD && providedPassword === ADMIN_PASSWORD) {
    passwordValid = true;
    console.log('[Admin] Password matched (plain text)');
  } else if (ADMIN_PASSWORD_HASH) {
    try {
      passwordValid = await bcrypt.compare(providedPassword, ADMIN_PASSWORD_HASH);
      console.log('[Admin] Password check result (bcrypt):', passwordValid);
    } catch (err) {
      console.error('[Admin] Password comparison error:', err);
    }
  } else {
    console.error('[Admin] No password configured! Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
  }

  if (!passwordValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin password',
    });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts PUT requests. Received: ${req.method}`,
    });
  }

  try {
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.NEON_DATABASE_URL || 
                        process.env.DATABASE_URL;

    if (!databaseUrl) {
      return res.status(500).json({
        error: 'Database not configured',
        message: 'Set SPR_DATABASE_URL in Vercel environment variables',
      });
    }

    const sql = neon(databaseUrl);
    const orderId = req.query.orderId;
    const { status } = req.body;

    console.log('[Admin Order Status] Update request:', { orderId, status, body: req.body });

    if (!orderId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Order ID is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Status is required',
      });
    }

    // Valid Square fulfillment statuses
    const validStatuses = ['in progress', 'ready', 'picked up'];
    const normalizedStatus = status.toLowerCase().trim();
    
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        received: status,
      });
    }

    console.log('[Admin Order Status] Updating order:', { orderId, normalizedStatus });

    // First, find the order by ID or order_number to get Square order ID
    let actualOrderId = orderId;
    let squareOrderId = null;
    let orderVersion = null;
    const isOrderNumber = orderId && orderId.startsWith('ORD-');
    
    if (isOrderNumber) {
      // Look up the order by order_number to get the actual ID and Square order ID
      const orderLookup = await sql`
        SELECT id, square_order_id FROM orders WHERE order_number = ${orderId}
      `;
      
      if (orderLookup && orderLookup.length > 0) {
        actualOrderId = orderLookup[0].id;
        squareOrderId = orderLookup[0].square_order_id;
        console.log('[Admin Order Status] Found order by order_number:', { orderNumber: orderId, actualId: actualOrderId, squareOrderId });
      } else {
        return res.status(404).json({
          error: 'Order not found',
          message: `No order found with order number: ${orderId}`,
        });
      }
    } else {
      // Look up by UUID
      const orderLookup = await sql`
        SELECT id, square_order_id FROM orders WHERE id = ${orderId}
      `;
      
      if (orderLookup && orderLookup.length > 0) {
        squareOrderId = orderLookup[0].square_order_id;
        console.log('[Admin Order Status] Found order by ID:', { actualId: actualOrderId, squareOrderId });
      } else {
        return res.status(404).json({
          error: 'Order not found',
          message: `No order found with ID: ${orderId}`,
        });
      }
    }

    if (!squareOrderId) {
      return res.status(400).json({
        error: 'Square order not found',
        message: 'This order does not have a Square order ID. Cannot update Square fulfillment status.',
      });
    }

    // Update Square order fulfillment status
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();

    if (!squareAccessToken || !squareLocationId) {
      return res.status(500).json({
        error: 'Square not configured',
        message: 'SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID must be set',
      });
    }

    const squareClient = new SquareClient({
      accessToken: squareAccessToken,
      environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });

    // Get current order from Square to get version
    try {
      const getOrderResponse = await squareClient.orders.retrieveOrder(squareOrderId);
      
      if (!getOrderResponse.result || !getOrderResponse.result.order) {
        return res.status(404).json({
          error: 'Square order not found',
          message: `Square order ${squareOrderId} not found`,
        });
      }

      const squareOrder = getOrderResponse.result.order;
      orderVersion = squareOrder.version;

      // Map our status to Square fulfillment state
      // Square states: PROPOSED, RESERVED, PREPARED, COMPLETED
      let squareFulfillmentState = 'RESERVED'; // Default
      let dbStatus = 'processing';
      
      if (normalizedStatus === 'in progress') {
        squareFulfillmentState = 'RESERVED'; // Order is being prepared
        dbStatus = 'processing';
      } else if (normalizedStatus === 'ready') {
        squareFulfillmentState = 'PREPARED'; // Ready for customer pickup
        dbStatus = 'ready for pickup';
      } else if (normalizedStatus === 'picked up') {
        squareFulfillmentState = 'COMPLETED'; // Customer has picked up
        dbStatus = 'picked up';
      }

      // Update fulfillment in Square order
      const fulfillments = squareOrder.fulfillments || [];
      if (fulfillments.length === 0) {
        return res.status(400).json({
          error: 'No fulfillments found',
          message: 'This order does not have any fulfillments to update',
        });
      }

      // Update the first fulfillment (pickup fulfillment)
      // Square requires all fulfillment fields to be included when updating
      const updatedFulfillments = fulfillments.map((fulfillment, index) => {
        if (index === 0 && fulfillment.type === 'PICKUP') {
          return {
            uid: fulfillment.uid, // Required: unique identifier
            type: fulfillment.type,
            state: squareFulfillmentState,
            pickupDetails: fulfillment.pickupDetails || {},
          };
        }
        return fulfillment;
      });

      // Update order in Square
      // Square SDK expects a single object with orderId, idempotencyKey, and order
      const updateOrderResponse = await squareClient.orders.updateOrder({
        orderId: squareOrderId,
        idempotencyKey: randomUUID(),
        order: {
          version: orderVersion,
          fulfillments: updatedFulfillments,
        },
      });

      if (!updateOrderResponse.result || !updateOrderResponse.result.order) {
        return res.status(500).json({
          error: 'Square update failed',
          message: 'Failed to update order in Square',
        });
      }

      console.log('[Admin Order Status] Square order updated:', {
        squareOrderId,
        fulfillmentState: squareFulfillmentState,
      });

      // Update database to match Square
      const updateResult = await sql`
        UPDATE orders
        SET status = ${dbStatus},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${actualOrderId}
        RETURNING id, order_number, status, updated_at
      `;

      console.log('[Admin Order Status] Database updated:', updateResult);

    if (!updateResult || updateResult.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: `No order found with ID: ${orderId}`,
      });
    }

    const updatedOrder = updateResult[0];

    console.log('[Admin Order Status] Successfully updated:', {
      id: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      status: updatedOrder.status,
    });

    return res.status(200).json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.order_number,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updated_at,
      },
    });
  } catch (error) {
    console.error('[Admin Order Status] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while updating the order status.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

