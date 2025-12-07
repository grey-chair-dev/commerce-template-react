/**
 * User Orders Endpoint
 * 
 * GET: Get all orders for the authenticated customer
 */

import { authenticateRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config();

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported. Use GET.`,
    });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId } = authResult;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SPR_DATABASE_URL);

    // Get all orders for this customer, ordered by most recent first
    const ordersResult = await sql`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.subtotal,
        o.shipping,
        o.tax,
        o.total,
        o.shipping_method,
        o.pickup_details,
        o.created_at,
        o.updated_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ${customerId}
      GROUP BY o.id, o.order_number, o.status, o.subtotal, o.shipping, o.tax, o.total, o.shipping_method, o.pickup_details, o.created_at, o.updated_at
      ORDER BY o.created_at DESC
    `;

    // Parse pickup_details for each order
    const orders = ordersResult.map(order => {
      let pickupDetails = null;
      if (order.pickup_details) {
        try {
          pickupDetails = typeof order.pickup_details === 'string' 
            ? JSON.parse(order.pickup_details)
            : order.pickup_details;
        } catch (e) {
          console.error('[Orders] Error parsing pickup_details:', e);
        }
      }

      return {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        subtotal: parseFloat(order.subtotal || 0),
        shipping: parseFloat(order.shipping || 0),
        tax: parseFloat(order.tax || 0),
        total: parseFloat(order.total || 0),
        shippingMethod: order.shipping_method,
        pickupDetails,
        itemCount: parseInt(order.item_count || 0, 10),
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      };
    });

    return res.status(200).json({
      success: true,
      orders,
      count: orders.length,
    });

  } catch (error) {
    console.error('[Orders] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

