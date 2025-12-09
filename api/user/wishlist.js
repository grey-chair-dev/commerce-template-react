/**
 * Wishlist Management Endpoint
 * 
 * GET: Fetch user's wishlist from database
 * POST: Add or remove items from wishlist
 *   - Body: { action: 'add' | 'remove', productId: string }
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
      // Fetch wishlist items from database
      const wishlistItems = await sql`
        SELECT 
          w.product_id,
          p.name,
          p.price,
          p.image_url,
          p.category,
          p.stock_count,
          p.description,
          w.created_at
        FROM wishlist w
        INNER JOIN products p ON w.product_id = p.id
        WHERE w.user_id = ${customerId}
        ORDER BY w.created_at DESC
      `;

      // Transform to match frontend Product format
      const formattedItems = wishlistItems.map(item => ({
        id: item.product_id,
        name: item.name,
        price: parseFloat(item.price),
        imageUrl: item.image_url,
        category: item.category,
        stockCount: item.stock_count,
        description: item.description,
      }));

      return res.status(200).json({
        success: true,
        wishlist: formattedItems,
      });
    }

    if (req.method === 'POST') {
      const { action, productId } = req.body;

      if (!action || !productId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'action and productId are required',
        });
      }

      if (action === 'add') {
        // Verify product exists
        const product = await sql`
          SELECT id FROM products WHERE id = ${productId}
        `;

        if (!product || product.length === 0) {
          return res.status(404).json({
            error: 'Product not found',
            message: `Product with ID ${productId} does not exist`,
          });
        }

        // Add to wishlist (ON CONFLICT does nothing if already exists)
        await sql`
          INSERT INTO wishlist (user_id, product_id, created_at)
          VALUES (${customerId}::text, ${productId}, CURRENT_TIMESTAMP)
          ON CONFLICT (user_id, product_id) DO NOTHING
        `;

        return res.status(200).json({
          success: true,
          message: 'Product added to wishlist',
        });
      }

      if (action === 'remove') {
        // Remove from wishlist
        const result = await sql`
          DELETE FROM wishlist
          WHERE user_id = ${customerId}::text AND product_id = ${productId}
        `;

        return res.status(200).json({
          success: true,
          message: 'Product removed from wishlist',
        });
      }

      return res.status(400).json({
        error: 'Invalid action',
        message: 'action must be "add" or "remove"',
      });
    }

    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported`,
    });
  } catch (error) {
    console.error('[Wishlist API] Error:', error);
    console.error('[Wishlist API] Error stack:', error.stack);
    console.error('[Wishlist API] Request method:', req.method);
    console.error('[Wishlist API] Request body:', JSON.stringify(req.body, null, 2));
    console.error('[Wishlist API] Customer ID:', customerId);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process wishlist request',
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message,
        stack: error.stack 
      }),
    });
  }
}
