/**
 * Admin Orders API Endpoint
 * 
 * GET /api/admin/orders - Fetch unfulfilled orders
 * PUT /api/admin/orders/:orderId/status - Update order status
 * 
 * Password-protected endpoint for internal staff
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
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

// Statuses that indicate an order is unfulfilled (show in dashboard)
const UNFULFILLED_STATUSES = ['pending', 'processing', 'confirmed', 'paid', 'ready for pickup'];

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
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
  
  // Debug logging
  console.log('[Admin] Password check:', {
    hasPlainPassword: !!ADMIN_PASSWORD,
    plainPasswordLength: ADMIN_PASSWORD?.length || 0,
    plainPasswordValue: ADMIN_PASSWORD ? `"${ADMIN_PASSWORD}"` : 'not set',
    hasHashedPassword: !!ADMIN_PASSWORD_HASH,
    providedLength: providedPassword.length,
    providedValue: `"${providedPassword}"`,
    passwordsMatch: ADMIN_PASSWORD === providedPassword,
    allEnvVars: Object.keys(process.env).filter(k => k.includes('ADMIN')),
  });
  
  // Check password (support both plain text and hashed)
  let passwordValid = false;
  if (ADMIN_PASSWORD) {
    // Compare with trimmed values
    const trimmedProvided = providedPassword.trim();
    const trimmedStored = ADMIN_PASSWORD.trim();
    if (trimmedProvided === trimmedStored) {
      passwordValid = true;
      console.log('[Admin] Password matched (plain text)');
    } else {
      console.log('[Admin] Password mismatch:', {
        provided: `"${trimmedProvided}"`,
        stored: `"${trimmedStored}"`,
        providedChars: trimmedProvided.split('').map(c => c.charCodeAt(0)),
        storedChars: trimmedStored.split('').map(c => c.charCodeAt(0)),
      });
    }
  } else if (ADMIN_PASSWORD_HASH) {
    try {
      passwordValid = await bcrypt.compare(providedPassword, ADMIN_PASSWORD_HASH);
      console.log('[Admin] Password check result (bcrypt):', passwordValid);
    } catch (err) {
      console.error('[Admin] Password comparison error:', err);
    }
  } else {
    console.error('[Admin] No password configured! Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH');
    console.error('[Admin] Available env vars:', Object.keys(process.env).filter(k => k.includes('ADMIN')));
  }

  if (!passwordValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin password',
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

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // GET - Fetch unfulfilled orders
    if (req.method === 'GET') {
      const ordersResult = await sql`
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
          o.pickup_details,
          o.created_at,
          o.updated_at,
          c.first_name as customer_first_name,
          c.last_name as customer_last_name,
          c.email as customer_email,
          c.phone as customer_phone,
          COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status = ANY(${UNFULFILLED_STATUSES})
        GROUP BY o.id, o.order_number, o.customer_id, o.status, o.subtotal, 
                 o.shipping, o.tax, o.total, o.shipping_method, o.pickup_details,
                 o.created_at, o.updated_at, c.first_name, c.last_name, c.email, c.phone
        ORDER BY o.created_at DESC
      `;

      // Format orders
      const orders = ordersResult.map(order => {
        let pickupDetails = null;
        if (order.pickup_details) {
          pickupDetails = typeof order.pickup_details === 'string'
            ? JSON.parse(order.pickup_details)
            : order.pickup_details;
        }

        return {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
          subtotal: parseFloat(order.subtotal),
          shipping: parseFloat(order.shipping || 0),
          tax: parseFloat(order.tax || 0),
          total: parseFloat(order.total),
          shippingMethod: order.shipping_method,
          itemCount: parseInt(order.item_count || 0),
          customer: {
            firstName: order.customer_first_name || pickupDetails?.firstName || '',
            lastName: order.customer_last_name || pickupDetails?.lastName || '',
            email: order.customer_email || pickupDetails?.email || '',
            phone: order.customer_phone || pickupDetails?.phone || '',
          },
          pickupDetails,
          createdAt: order.created_at,
          updatedAt: order.updated_at,
        };
      });

      return res.status(200).json({
        success: true,
        orders,
        count: orders.length,
      });
    }

    // PUT - Update order status
    if (req.method === 'PUT') {
      const orderId = req.query.orderId;
      const { status } = req.body;

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

      // Validate status
      const validStatuses = ['pending', 'processing', 'confirmed', 'paid', 'ready for pickup', 'shipped', 'delivered', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
      }

      // Update order status
      const updateResult = await sql`
        UPDATE orders
        SET status = ${status.toLowerCase()},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${orderId} OR order_number = ${orderId}
        RETURNING id, order_number, status, updated_at
      `;

      if (!updateResult || updateResult.length === 0) {
        return res.status(404).json({
          error: 'Order not found',
          message: `No order found with ID: ${orderId}`,
        });
      }

      const updatedOrder = updateResult[0];

      return res.status(200).json({
        success: true,
        order: {
          id: updatedOrder.id,
          orderNumber: updatedOrder.order_number,
          status: updatedOrder.status,
          updatedAt: updatedOrder.updated_at,
        },
      });
    }

    // Method not allowed
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts GET and PUT requests. Received: ${req.method}`,
    });
  } catch (error) {
    console.error('[Admin Orders] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while processing your request.',
    });
  }
}

