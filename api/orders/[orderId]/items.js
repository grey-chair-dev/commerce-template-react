/**
 * Order Items Endpoint
 * Returns all items for a specific order
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

    // Get order ID from URL
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Order ID is required',
      });
    }

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // First, try to find the order by ID or order_number to get the actual order ID
    let actualOrderId = orderId;
    
    // Check if it's an order_number (starts with "ORD-") or a UUID
    const isOrderNumber = orderId.startsWith('ORD-');
    
    if (isOrderNumber) {
      // Look up the order by order_number to get the actual ID
      const orderLookup = await sql`
        SELECT id FROM orders WHERE order_number = ${orderId}
      `;
      
      if (orderLookup && orderLookup.length > 0) {
        actualOrderId = orderLookup[0].id;
      } else {
        return res.status(404).json({
          error: 'Order not found',
          message: `No order found with order number: ${orderId}`,
        });
      }
    }

    // Fetch order items with product details using the actual order ID
    const itemsResult = await sql`
      SELECT 
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.quantity,
        oi.price,
        oi.subtotal,
        p.name as product_name,
        p.image_url,
        p.category,
        oi.created_at
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${actualOrderId}
      ORDER BY oi.created_at ASC
    `;

    const items = itemsResult.map(item => ({
      id: item.id,
      order_id: item.order_id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: parseFloat(item.price || 0),
      subtotal: parseFloat(item.subtotal || 0),
      image_url: item.image_url,
      category: item.category,
      created_at: item.created_at,
    }));

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(items);

  } catch (error) {
    console.error('[Order Items] Error fetching order items:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to fetch order items',
    });
  }
}

