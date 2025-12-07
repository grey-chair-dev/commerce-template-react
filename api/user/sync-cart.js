/**
 * Cart Sync Endpoint
 * 
 * Merges localStorage cart with database cart on login
 * Ensures no items are lost during the merge
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported. Use POST.`,
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

    // Get localStorage cart items from request body
    const { localCartItems } = req.body; // Array of { sku: string, quantity: number }

    if (!Array.isArray(localCartItems)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'localCartItems must be an array',
      });
    }

    // Fetch existing cart from database
    const dbCartItems = await sql`
      SELECT product_id, quantity
      FROM cart
      WHERE user_id = ${customerId}::text
    `;

    // Create maps for easy lookup
    const localCartMap = new Map(
      localCartItems.map(item => [item.sku, item.quantity])
    );
    const dbCartMap = new Map(
      dbCartItems.map(item => [item.product_id, item.quantity])
    );

    // Merge strategy: take maximum quantity for each product
    const mergedCart = new Map();

    // Add all items from localStorage
    for (const [productId, quantity] of localCartMap) {
      mergedCart.set(productId, quantity);
    }

    // Merge with database items (take max quantity)
    for (const [productId, dbQuantity] of dbCartMap) {
      const localQuantity = mergedCart.get(productId) || 0;
      mergedCart.set(productId, Math.max(localQuantity, dbQuantity));
    }

    // Verify products exist and get their details
    const productIds = Array.from(mergedCart.keys());
    if (productIds.length === 0) {
      // Empty cart - clear database cart
      await sql`
        DELETE FROM cart
        WHERE user_id = ${customerId}
      `;

      return res.status(200).json({
        success: true,
        cart: [],
        message: 'Cart synced (empty)',
      });
    }

    const products = await sql`
      SELECT id, name, price, image_url, category, stock_count
      FROM products
      WHERE id = ANY(${productIds})
    `;

    const productMap = new Map(products.map(p => [p.id, p]));

    // Save merged cart to database using transaction
    await sql.begin(async (sql) => {
      // Delete existing cart items
      await sql`
        DELETE FROM cart
        WHERE user_id = ${customerId}::text
      `;

      // Insert merged cart items (only valid products)
      for (const [productId, quantity] of mergedCart) {
        const product = productMap.get(productId);
        if (product && quantity > 0) {
          await sql`
            INSERT INTO cart (user_id, product_id, quantity, updated_at)
            VALUES (${customerId}::text, ${productId}, ${quantity}, CURRENT_TIMESTAMP)
          `;
        }
      }
    });

    // Format response to match frontend CartItem format
    const formattedItems = Array.from(mergedCart.entries())
      .filter(([productId]) => productMap.has(productId))
      .map(([productId, quantity]) => {
        const product = productMap.get(productId);
        return {
          id: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: quantity,
          imageUrl: product.image_url,
          category: product.category,
          stockCount: product.stock_count,
        };
      });

    return res.status(200).json({
      success: true,
      cart: formattedItems,
      message: 'Cart synced successfully',
    });
  } catch (error) {
    console.error('[Cart Sync] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to sync cart',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

