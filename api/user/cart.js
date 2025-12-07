/**
 * Cart Management Endpoint
 * 
 * GET: Fetch user's cart from database
 * POST: Save user's cart to database
 */

import { authenticateRequest } from '../middleware/auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

    if (req.method === 'GET') {
      // Fetch cart items from database
      const cartItems = await sql`
        SELECT 
          c.product_id,
          c.quantity,
          p.name,
          p.price,
          p.image_url,
          p.category,
          p.stock_count
        FROM cart c
        INNER JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ${customerId}
        ORDER BY c.created_at ASC
      `;

      // Transform to match frontend CartItem format
      const formattedItems = cartItems.map(item => ({
        id: item.product_id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        imageUrl: item.image_url,
        category: item.category,
        stockCount: item.stock_count,
      }));

      return res.status(200).json({
        success: true,
        cart: formattedItems,
      });
    }

    if (req.method === 'POST') {
      // Save cart items to database
      const { items } = req.body; // Array of { sku: string, quantity: number }

      if (!Array.isArray(items)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Items must be an array',
        });
      }

      // Delete existing cart items first
      await sql`
        DELETE FROM cart
        WHERE user_id = ${customerId}::text
      `;

      // Insert new cart items
      if (items.length > 0) {
        // Verify products exist and get their details
        const productIds = items.map(item => item.sku);
        const products = await sql`
          SELECT id, name, price, image_url, category, stock_count
          FROM products
          WHERE id = ANY(${productIds})
        `;

        const productMap = new Map(products.map(p => [p.id, p]));

        // Insert valid products only
        for (const item of items) {
          const product = productMap.get(item.sku);
          if (product && item.quantity > 0) {
            await sql`
              INSERT INTO cart (user_id, product_id, quantity, updated_at)
              VALUES (${customerId}::text, ${item.sku}, ${item.quantity}, CURRENT_TIMESTAMP)
              ON CONFLICT (user_id, product_id)
              DO UPDATE SET 
                quantity = ${item.quantity},
                updated_at = CURRENT_TIMESTAMP
            `;
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Cart saved successfully',
      });
    }

    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported`,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    console.error('[Cart API] Error stack:', error.stack);
    console.error('[Cart API] Request method:', req.method);
    console.error('[Cart API] Request body:', JSON.stringify(req.body, null, 2));
    console.error('[Cart API] Customer ID:', customerId);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process cart request',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message,
        stack: error.stack 
      }),
    });
  }
}

