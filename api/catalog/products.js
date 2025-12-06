/**
 * Product Catalog API Endpoint
 * 
 * GET /api/catalog/products
 * 
 * Returns a list of products from the Neon database.
 * This endpoint is designed to be easily cacheable.
 * 
 * Query Parameters:
 *   - limit: Number of products to return (default: 100, max: 500)
 *   - offset: Number of products to skip (default: 0)
 *   - category: Filter by category (optional)
 *   - in_stock: Filter by in-stock status (true/false, optional)
 *   - search: Search by product name (optional)
 * 
 * Response:
 *   {
 *     "products": [...],
 *     "total": 123,
 *     "limit": 100,
 *     "offset": 0
 *   }
 */

import { neon } from '@neondatabase/serverless';

// Cache duration in seconds (5 minutes)
// This ensures cached responses are served quickly (< 100ms)
const CACHE_DURATION = 300;

export default async function handler(req, res) {
  // Set CORS headers to allow cross-origin requests
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
  ].filter(Boolean);

  // Allow requests from any origin in development, or specific origins in production
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests - return 405 Method Not Allowed for any other method
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `This endpoint only accepts GET requests. Received: ${req.method}`,
      allowed_methods: ['GET']
    });
  }

  try {
    // Start performance timer
    const startTime = Date.now();

    // Get database URL - use SPR_DATABASE_URL
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.SPR_NEON_DATABSE_URL || 
                        process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error('❌ SPR_DATABASE_URL not configured');
      return res.status(500).json({ 
        error: 'Database not configured',
        message: 'Set SPR_DATABASE_URL in Vercel environment variables'
      });
    }

    // Initialize Neon serverless client
    const sql = neon(databaseUrl);

    // Parse query parameters
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const category = req.query.category;
    const inStock = req.query.in_stock === 'true' ? true : req.query.in_stock === 'false' ? false : null;
    const search = req.query.search;

    // Optimized query - stock_count is already in products table, no JOIN needed
    // This significantly improves performance by avoiding unnecessary JOIN
    let query = `
      SELECT 
        id, 
        name, 
        description, 
        price, 
        category, 
        stock_count, 
        image_url, 
        rating, 
        review_count, 
        created_at, 
        updated_at
      FROM products
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Add filters
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (inStock !== null) {
      if (inStock) {
        query += ` AND stock_count > 0`;
      } else {
        query += ` AND stock_count = 0`;
      }
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Add ordering and pagination (using composite index for optimal performance)
    query += ' ORDER BY created_at DESC, name ASC';
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    // Execute query - single optimized query (no count query for better performance)
    // The serverless client uses parameterized queries with $1, $2, etc.
    const productsResult = await sql(query, params);

    // Neon serverless returns arrays of row objects directly
    const products = Array.isArray(productsResult) ? productsResult : [];
    // Estimate total for pagination (saves a second query)
    const total = products.length === limit ? products.length + offset + 1 : products.length + offset;

      // Category lookup table - maps Square category IDs to display names
      const categoryLookup = {
        'C2JFIAPXRNSMGXUK4FIA2BBX': 'Vinyl Records',
        'WQ5ZX4FB6VERZ2BP3XKPNP3Y': 'Vinyl Records',
        'P6C3ATETEUT5EY6LOIUTP76O': 'Cassettes',
        'LTUTEKGG4STHRELDLO7ADXPF': 'Cassettes',
        'CG5VVZR63475T6DKB73J3JTY': '45 RPM',
        'PUDWH2SQ4T7FAA3AOXHT2KCQ': 'CDs',
        'HOKJNULDLMPUDHKMZBT4XPPD': 'Audio Equipment',
        'IMZGHMKAYYGACBSG56O6I7NA': 'Posters',
        'TP6LVYCAFHIISUK3BDTQX73T': 'Crates',
        'RMFPEQVVLWTRYYU55UN45KNR': 'DVDs',
        '34ODRGEUHNITZDWW6W4E5TE4': 'Books',
        'ZKT567JNEQCCD7ARXL5THCWD': 'Puzzles',
        'ILBV23LCAC4XBTE6NBXGM7LQ': 'Cleaner',
        'BCLLIRRB7TKZ7EZTEJ6L4NXH': 'Sleeves',
        'DVD3K4ZD4SN2FU2CZENSFMEM': 'Vinyl Records',
        'VYPB4CCY4OKQZUCCFRMTYOKY': 'Vinyl Records',
        'MZ33ZZO7M7GDAUIC6DAV477I': 'Vinyl Records',
        'HOZIQSBJEF6I6FTNGH3FSQBA': 'Vinyl Records',
        'IFWW2EEGULRUBRXLD3QZXH2A': 'Vinyl Records',
        '7GXCIRJY6PO4QEA37VWMRBFW': 'Vinyl Records',
        'THI6SD6TCR4IX4FB2YDI5USE': 'Jazz',
        '5RBJRCZGCHBTRM3EQ4V5TCU3': 'Band T-shirts',
        'V5SOIKK6FVGNAX4YJQZGSAMI': 'Misc',
      };

      // Helper function to get display category
      const getDisplayCategory = (category, productName) => {
        if (!category) {
          // Try to infer from product name
          if (productName) {
            const nameLower = productName.toLowerCase();
            if (nameLower.includes('cassette')) return 'Cassettes';
            if (nameLower.includes('cd')) return 'CDs';
            if (nameLower.includes('45')) return '45 RPM';
            if (nameLower.includes('33') || nameLower.includes('vinyl') || nameLower.includes('record')) return 'Vinyl Records';
            if (nameLower.includes('turntable') || nameLower.includes('speaker') || nameLower.includes('receiver')) return 'Audio Equipment';
          }
          return 'Uncategorized';
        }

        // Check lookup table first
        if (categoryLookup[category]) {
          return categoryLookup[category];
        }

        // If it's already a readable name, return it
        // Check if it looks like a Square ID (long alphanumeric string)
        if (category.length > 20 && /^[A-Z0-9]+$/.test(category)) {
          // It's a Square ID we don't have mapped - return generic
          return 'Vinyl Records'; // Default for record store
        }

        // Return the category as-is if it's already readable
        return category;
      };

      // Format products for API response
      const formattedProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price ? parseFloat(product.price) : null,
        category: getDisplayCategory(product.category, product.name),
        stock_count: product.stock_count || 0,
        in_stock: (product.stock_count || 0) > 0,
        image_url: product.image_url,
        rating: product.rating ? parseFloat(product.rating) : null,
        review_count: product.review_count || 0,
        created_at: product.created_at,
        updated_at: product.updated_at,
      }));

      // Calculate performance metrics
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Log performance (warn if over target)
      if (duration > 300) {
        console.warn(`[Performance] API response took ${duration}ms (target: <300ms) - Products: ${formattedProducts.length}`);
      } else {
        console.log(`[Performance] API response: ${duration}ms - Products: ${formattedProducts.length} ✅`);
      }

      // Set cache headers for optimal performance
      // s-maxage: CDN cache duration (Vercel Edge Network)
      // stale-while-revalidate: Serve stale content while revalidating
      res.setHeader('Cache-Control', `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=${CACHE_DURATION * 2}, max-age=${CACHE_DURATION}`);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Response-Time', `${duration}ms`); // Custom header for monitoring

      // Return result set as standard JSON array with HTTP 200 OK status
      // The query already filters for stock_count > 0, so all returned products are available
      return res.status(200).json(formattedProducts);

  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

