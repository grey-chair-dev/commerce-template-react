/**
 * Order Status Endpoint
 * Returns the current status of an order, including payment status
 * Note: Order statuses are managed by Square webhooks, not directly via API
 */

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://commerce-template-react.vercel.app',
  ];
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed.split('://')[1]))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts GET requests. Received: ${req.method}`,
    });
  }

  try {
    // Get database URL
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.NEON_DATABASE_URL || 
                        process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error('❌ Database URL not configured');
      return res.status(500).json({
        error: 'Database not configured',
        message: 'Set SPR_DATABASE_URL in Vercel environment variables',
      });
    }

    // Get order ID from URL - can be either database ID (UUID) or order_number
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Order ID is required',
      });
    }

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // Fetch order status - try by ID first, then by order_number
    let orderResult = await sql`
      SELECT 
        id,
        order_number,
        status,
        square_order_id,
        square_payment_id,
        payment_method,
        total,
        created_at,
        updated_at
      FROM orders
      WHERE id = ${orderId}
    `;

    // If not found by ID, try by order_number
    if (!orderResult || orderResult.length === 0) {
      orderResult = await sql`
        SELECT 
          id,
          order_number,
          status,
          square_order_id,
          square_payment_id,
          payment_method,
          total,
          created_at,
          updated_at
        FROM orders
        WHERE order_number = ${orderId}
      `;
    }

    if (!orderResult || orderResult.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: `No order found with ID: ${orderId}`,
      });
    }

    const order = orderResult[0];

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      square_order_id: order.square_order_id,
      square_payment_id: order.square_payment_id,
      payment_method: order.payment_method,
      total: parseFloat(order.total || 0),
      created_at: order.created_at,
      updated_at: order.updated_at,
    });

  } catch (error) {
    console.error('[Order Status] Error fetching order:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to fetch order status',
    });
  }
}

