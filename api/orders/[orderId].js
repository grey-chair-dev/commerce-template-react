/**
 * Order Details Endpoint (RESTful)
 * 
 * GET /api/orders/[orderId] - Get order details including items
 * 
 * Supports:
 * - Lookup by UUID or order_number
 * - Authenticated users (verifies ownership)
 * - Guest access (for order confirmation pages)
 * - Returns complete order data with items and customer info
 */

import { neon } from '@neondatabase/serverless';
import { authenticateRequest } from '../middleware/auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

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

    // Get order ID from URL path (RESTful pattern: /api/orders/[orderId])
    // Vercel provides it as req.query.orderId for dynamic routes
    // Also support query parameter for backward compatibility
    const orderId = req.query.orderId || req.query.id;

    if (!orderId) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Order ID is required. Use /api/orders/{orderId}',
      });
    }

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // Security check: Try to authenticate the user (optional - allows guest access)
    // If authenticated, verify the order belongs to the user
    let authenticatedCustomerId = null;
    try {
      const authResult = await authenticateRequest(req, res, false); // false = not required
      if (authResult.success && authResult.customerId) {
        authenticatedCustomerId = authResult.customerId;
      }
    } catch (authError) {
      // Authentication failed, but we allow guest access
      console.log('[Orders] Guest access (no authentication):', authError.message);
    }

    // Fetch order with customer details using JOIN
    // Try by ID first, then by order_number
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
      WHERE o.id = ${orderId}
    `;

    // If not found by ID, try by order_number
    if (!orderResult || orderResult.length === 0) {
      orderResult = await sql`
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
        WHERE o.order_number = ${orderId}
      `;
    }

    if (!orderResult || orderResult.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: `No order found with ID: ${orderId}`,
      });
    }

    const order = orderResult[0];

    // Security check: If user is authenticated, verify they own this order
    if (authenticatedCustomerId) {
      if (order.customer_id !== authenticatedCustomerId) {
        console.warn('[Orders] Unauthorized access attempt:', {
          authenticatedCustomerId,
          orderCustomerId: order.customer_id,
          orderId: order.id,
        });
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to view this order.',
        });
      }
    }
    // If not authenticated, allow access (guest checkout scenario)

    // Fetch order items with product details using JOIN
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
      try {
        pickupDetails = typeof order.pickup_details === 'string' 
          ? JSON.parse(order.pickup_details)
          : order.pickup_details;
      } catch (e) {
        console.error('[Orders] Error parsing pickup_details:', e);
      }
    }

    // Parse shipping_address if it exists
    let shippingAddress = null;
    if (order.shipping_address) {
      try {
        shippingAddress = typeof order.shipping_address === 'string' 
          ? JSON.parse(order.shipping_address)
          : order.shipping_address;
      } catch (e) {
        console.error('[Orders] Error parsing shipping_address:', e);
      }
    }

    // Determine customer name (from customers table or pickup_details)
    const customerName = {
      first: order.customer_first_name || pickupDetails?.firstName || '',
      last: order.customer_last_name || pickupDetails?.lastName || '',
      full: `${order.customer_first_name || pickupDetails?.firstName || ''} ${order.customer_last_name || pickupDetails?.lastName || ''}`.trim(),
    };

    // Determine pickup status based on order status and creation time
    const pickupStatus = (() => {
      if (order.status === 'confirmed' || order.status === 'paid' || order.status === 'OPEN') {
        const orderAge = Date.now() - new Date(order.created_at).getTime();
        const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        
        if (orderAge < twoHours) {
          return {
            status: 'processing',
            message: 'Processing - will be ready within 2 hours',
          };
        } else {
          return {
            status: 'ready',
            message: 'Ready for Pickup Now',
          };
        }
      }
      return {
        status: 'pending',
        message: 'Order is being processed',
      };
    })();

    // Format response
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      // Order identification
      id: order.id,
      order_number: order.order_number,
      square_order_id: order.square_order_id,
      square_payment_id: order.square_payment_id,
      
      // Customer information (from customers table or pickup_details)
      customer: {
        id: order.customer_id,
        name: customerName,
        email: order.customer_email || pickupDetails?.email || '',
        phone: order.customer_phone || pickupDetails?.phone || '',
      },
      
      // Order status and totals
      status: order.status,
      subtotal: parseFloat(order.subtotal || 0),
      shipping: parseFloat(order.shipping || 0),
      tax: parseFloat(order.tax || 0),
      total: parseFloat(order.total || 0),
      
      // Shipping/Pickup information
      shipping_method: order.shipping_method,
      shipping_address: shippingAddress,
      pickup_details: pickupDetails,
      pickup_status: pickupStatus,
      
      // Order items (from order_items table JOIN with products)
      items: Array.isArray(itemsResult) && itemsResult.length > 0
        ? itemsResult.map(item => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product_name || 'Product',
            quantity: parseInt(item.quantity || 0, 10),
            price: parseFloat(item.price || 0),
            subtotal: parseFloat(item.subtotal || 0),
            image_url: item.image_url || '',
            category: item.category || '',
          }))
        : [],
      
      // Payment information
      payment_method: order.payment_method,
      created_at: order.created_at,
      updated_at: order.updated_at,
    });

  } catch (error) {
    console.error('[Orders] Error fetching order:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to fetch order details',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}
