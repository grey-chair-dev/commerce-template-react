/**
 * Order Detail Endpoint (for authenticated users)
 * 
 * GET: Get detailed order information including items for authenticated customer
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

  // Authenticate request (required for this endpoint)
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId } = authResult;

  try {
    const { orderId } = req.query;

    if (!orderId) {
      return res.status(400).json({
        error: 'Order ID required',
        message: 'Please provide an order ID',
      });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SPR_DATABASE_URL);

    // Fetch order - verify it belongs to the authenticated customer
    let orderResult = await sql`
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
        o.updated_at
      FROM orders o
      WHERE (o.id = ${orderId} OR o.order_number = ${orderId})
        AND o.customer_id = ${customerId}
    `;

    if (!orderResult || orderResult.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Order not found or you do not have permission to view this order',
      });
    }

    const order = orderResult[0];

    // Parse pickup_details
    let pickupDetails = null;
    if (order.pickup_details) {
      try {
        pickupDetails = typeof order.pickup_details === 'string' 
          ? JSON.parse(order.pickup_details)
          : order.pickup_details;
      } catch (e) {
        console.error('[Order Detail] Error parsing pickup_details:', e);
      }
    }

    // Fetch order items
    const itemsResult = await sql`
      SELECT 
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.price,
        oi.subtotal,
        p.name as product_name,
        p.image_url,
        p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
      ORDER BY oi.created_at ASC
    `;

    const items = itemsResult.map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name || 'Product',
      quantity: parseInt(item.quantity || 0, 10),
      price: parseFloat(item.price || 0),
      subtotal: parseFloat(item.subtotal || 0),
      imageUrl: item.image_url,
      category: item.category,
    }));

    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        subtotal: parseFloat(order.subtotal || 0),
        shipping: parseFloat(order.shipping || 0),
        tax: parseFloat(order.tax || 0),
        total: parseFloat(order.total || 0),
        shippingMethod: order.shipping_method,
        pickupDetails,
        items,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });

  } catch (error) {
    console.error('[Order Detail] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order details',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

