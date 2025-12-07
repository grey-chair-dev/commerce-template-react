/**
 * Order Lookup Endpoint
 * 
 * Allows guests to look up orders by order number and email address
 * Verifies that the email matches the order before returning details
 */

import { neon } from '@neondatabase/serverless';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts POST requests. Received: ${req.method}`,
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

    // Get order number and email from request body
    const { orderNumber, email } = req.body;

    if (!orderNumber || !email) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Both order number and email are required',
      });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.trim().toLowerCase();

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // Fetch order with customer details using JOIN
    // Try by order_number first (most common case)
    let orderResult = await sql`
      SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.status,
        o.subtotal,
        o.shipping,
        o.tax,
        o.total,
        o.shipping_method,
        o.shipping_address,
        o.pickup_details,
        o.square_order_id,
        o.square_payment_id,
        o.payment_method,
        o.created_at,
        o.updated_at,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.email as customer_email,
        c.phone as customer_phone
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.order_number = ${orderNumber.trim()}
    `;

    if (!orderResult || orderResult.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'No order found with this order number. Please check and try again.',
      });
    }

    const order = orderResult[0];

    // Verify email matches
    // Check both customer email (if order has customer_id) and pickup_details email
    let emailMatches = false;

    // Check customer email if order has a customer_id
    if (order.customer_email) {
      if (order.customer_email.toLowerCase() === normalizedEmail) {
        emailMatches = true;
      }
    }

    // Also check pickup_details for guest orders
    if (!emailMatches && order.pickup_details) {
      let pickupDetails = null;
      try {
        pickupDetails = typeof order.pickup_details === 'string' 
          ? JSON.parse(order.pickup_details)
          : order.pickup_details;
        
        if (pickupDetails?.email && pickupDetails.email.toLowerCase() === normalizedEmail) {
          emailMatches = true;
        }
      } catch (parseError) {
        console.error('[Order Lookup] Error parsing pickup_details:', parseError);
      }
    }

    // If email doesn't match, return error (don't reveal if order exists)
    if (!emailMatches) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'No order found with this order number and email combination. Please check and try again.',
      });
    }

    // Fetch order items with product details
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
        p.category
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
      ORDER BY oi.created_at ASC
    `;

    // Parse pickup_details if it exists
    let pickupDetails = null;
    if (order.pickup_details) {
      pickupDetails = typeof order.pickup_details === 'string' 
        ? JSON.parse(order.pickup_details)
        : order.pickup_details;
    }

    // Determine customer name
    const customerName = {
      first: order.customer_first_name || pickupDetails?.firstName || '',
      last: order.customer_last_name || pickupDetails?.lastName || '',
    };

    // Format order items
    const items = itemsResult.map(item => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name || 'Unknown Product',
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
      imageUrl: item.image_url,
      category: item.category,
    }));

    // Return order data
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        subtotal: parseFloat(order.subtotal),
        shipping: parseFloat(order.shipping || 0),
        tax: parseFloat(order.tax || 0),
        total: parseFloat(order.total),
        shippingMethod: order.shipping_method,
        shippingAddress: order.shipping_address,
        pickupDetails,
        customerName: `${customerName.first} ${customerName.last}`.trim() || 'Guest Customer',
        customerEmail: order.customer_email || pickupDetails?.email || normalizedEmail,
        customerPhone: order.customer_phone || pickupDetails?.phone || '',
        items,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (error) {
    console.error('[Order Lookup] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while looking up your order. Please try again later.',
    });
  }
}

