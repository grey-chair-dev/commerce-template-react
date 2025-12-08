/**
 * Manual Square Order Sync Endpoint
 * 
 * This endpoint manually fetches orders from Square and syncs them to Neon.
 * Use this if webhooks aren't working or as a backup sync mechanism.
 * 
 * GET /api/admin/sync-square-orders?orderId=SQUARE_ORDER_ID
 * Or GET /api/admin/sync-square-orders (syncs all recent orders)
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config();

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
    'https://spiralgrooverecords.greychair.io',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts GET requests. Received: ${req.method}`,
    });
  }

  // Admin password protection
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Admin password required. Send as: Authorization: Bearer YOUR_PASSWORD',
    });
  }

  const providedPassword = authHeader.substring(7).trim();
  const adminPassword = getAdminPassword();
  const adminPasswordHash = getAdminPasswordHash();

  let isAuthenticated = false;
  if (adminPassword && providedPassword === adminPassword) {
    isAuthenticated = true;
  } else if (adminPasswordHash) {
    try {
      isAuthenticated = await bcrypt.compare(providedPassword, adminPasswordHash);
    } catch (error) {
      console.error('[Admin Sync] Password hash comparison error:', error);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin password',
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

    // Square API setup
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

    let syncedOrders = [];

    if (orderId) {
      // Sync a specific order
      console.log(`[Admin Sync] Syncing specific order: ${orderId}`);
      const orderResponse = await squareClient.orders.retrieveOrder(orderId);
      
      if (!orderResponse.result || !orderResponse.result.order) {
        return res.status(404).json({
          error: 'Order not found',
          message: `Square order ${orderId} not found`,
        });
      }

      const squareOrder = orderResponse.result.order;
      const result = await syncOrderToDatabase(squareOrder, sql);
      syncedOrders.push({ orderId, ...result });
    } else {
      // Sync recent orders (last 24 hours)
      console.log(`[Admin Sync] Syncing recent orders from Square`);
      const searchResponse = await squareClient.orders.searchOrders({
        locationIds: [squareLocationId],
        query: {
          filter: {
            dateTimeFilter: {
              createdAtAt: {
                startAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                endAt: new Date().toISOString(),
              },
            },
          },
        },
        limit: 100,
      });

      if (searchResponse.result && searchResponse.result.orders) {
        for (const squareOrder of searchResponse.result.orders) {
          const result = await syncOrderToDatabase(squareOrder, sql);
          syncedOrders.push({ orderId: squareOrder.id, ...result });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Synced ${syncedOrders.length} order(s)`,
      orders: syncedOrders,
    });

  } catch (error) {
    console.error('[Admin Sync] Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred while syncing orders.',
    });
  }
}

async function syncOrderToDatabase(squareOrder, sql) {
  try {
    const squareOrderId = squareOrder.id;
    
    // Extract fulfillment state
    let fulfillmentState = null;
    const fulfillments = squareOrder.fulfillments || [];
    if (fulfillments.length > 0) {
      const firstFulfillment = fulfillments[0];
      fulfillmentState = firstFulfillment.state || firstFulfillment.fulfillment_state || null;
      if (fulfillmentState) {
        fulfillmentState = String(fulfillmentState).toUpperCase();
      }
    }

    // Map fulfillment state to database status
    let orderStatus = 'pending';
    if (fulfillmentState) {
      const fulfillmentStatusMap = {
        'PROPOSED': 'processing',
        'RESERVED': 'processing',
        'PREPARED': 'ready for pickup',
        'COMPLETED': 'picked up',
        'CANCELED': 'cancelled',
        'CANCELLED': 'cancelled',
      };
      orderStatus = fulfillmentStatusMap[fulfillmentState] || orderStatus;
    } else {
      // Fallback to order state
      const orderState = squareOrder.state || 'DRAFT';
      const statusMap = {
        'DRAFT': 'pending',
        'OPEN': 'confirmed',
        'COMPLETED': 'confirmed',
        'CANCELED': 'cancelled',
      };
      orderStatus = statusMap[orderState] || 'pending';
    }

    // Check if order exists
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE square_order_id = ${squareOrderId}
    `;

    if (existingOrder.length > 0) {
      // Update existing order
      const orderId = existingOrder[0].id;
      await sql`
        UPDATE orders
        SET status = ${orderStatus},
            updated_at = NOW()
        WHERE id = ${orderId}
      `;
      console.log(`[Admin Sync] Updated order ${orderId}: ${existingOrder[0].status} → ${orderStatus}`);
      return { action: 'updated', orderId, oldStatus: existingOrder[0].status, newStatus: orderStatus };
    } else {
      console.log(`[Admin Sync] Order ${squareOrderId} not found in database - skipping (use webhook for new orders)`);
      return { action: 'skipped', reason: 'Order not in database' };
    }
  } catch (error) {
    console.error(`[Admin Sync] Error syncing order:`, error);
    return { action: 'error', error: error.message };
  }
}

