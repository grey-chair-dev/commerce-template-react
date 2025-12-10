/**
 * Square Inventory Webhook Handler
 * 
 * This Vercel serverless function handles Square webhook events for inventory updates.
 * It verifies the webhook signature and updates the Neon database accordingly.
 * 
 * Webhook URL: https://your-domain.vercel.app/api/webhooks/square-inventory
 * 
 * To configure in Square Dashboard:
 * 1. Go to Developer Dashboard > Webhooks
 * 2. Add webhook URL
 * 3. Subscribe to: inventory.count.updated
 * 4. Set signature key in Vercel environment variables
 */

import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;

/**
 * Verify Square webhook signature
 * @param {string} signature - The X-Square-Signature header value
 * @param {Buffer|string} body - The raw request body (Buffer or string)
 * @param {string} signatureKey - The Square webhook signature key
 * @param {string} notificationUrl - The full notification URL (required by Square)
 * @returns {boolean} - True if signature is valid
 */
function verifySquareSignature(signature, body, signatureKey, notificationUrl) {
  if (!signature || !signatureKey || !notificationUrl) {
    return false;
  }

  // Square sends signature in format: sha256=BASE64_HASH or just BASE64_HASH
  // The signature is base64 encoded, not hex
  // Note: Base64 strings can end with '=' for padding, so we need to check for 'sha256=' prefix
  let expectedSignature;
  if (signature.startsWith('sha256=')) {
    // Format: sha256=base64hash
    expectedSignature = signature.substring(7); // Remove 'sha256=' prefix
  } else {
    // Format: base64hash (may include = padding)
    expectedSignature = signature;
  }
  
  if (!expectedSignature) {
    return false;
  }

  // CRITICAL: Square includes the notification URL in the signature calculation
  // The signature is: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
  // We must concatenate the URL and body in the exact order Square expects
  
  // Convert body to string if it's a Buffer (for concatenation)
  const bodyString = Buffer.isBuffer(body) ? body.toString('utf8') : body;
  
  // Concatenate URL and body (in this exact order)
  const signaturePayload = notificationUrl + bodyString;
  
  // Calculate HMAC SHA256
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(signaturePayload, 'utf8');
  const calculatedSignature = hmac.digest('base64');
  
  // Log for debugging
  const bodyType = Buffer.isBuffer(body) ? 'Buffer' : typeof body;
  const bodyLength = Buffer.isBuffer(body) ? body.length : (typeof body === 'string' ? body.length : 0);

  // Compare signatures using constant-time comparison
  // Both should be base64 strings
  if (expectedSignature.length !== calculatedSignature.length) {
    console.error('Signature length mismatch:', {
      expected: expectedSignature.length,
      calculated: calculatedSignature.length,
      expectedPreview: expectedSignature.substring(0, 20),
      calculatedPreview: calculatedSignature.substring(0, 20),
      bodyType: bodyType,
      bodyLength: bodyLength,
      signatureKeyLength: signatureKey.length,
    });
    return false;
  }
  
  // Log signature details for debugging (first 20 chars only for security)
  console.log('[Webhook] Signature verification details:', {
    expectedLength: expectedSignature.length,
    calculatedLength: calculatedSignature.length,
    expectedPreview: expectedSignature.substring(0, 20) + '...',
    calculatedPreview: calculatedSignature.substring(0, 20) + '...',
    bodyType: bodyType,
    bodyLength: bodyLength,
  });
  
  try {
    // Compare base64 strings
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  } catch (error) {
    console.error('Signature comparison error:', error.message);
    // Fallback: try string comparison if base64 decode fails
    try {
      return expectedSignature === calculatedSignature;
    } catch (e) {
      return false;
    }
  }
}

/**
 * Process inventory count update event
 */
/**
 * Extract square_variation_id and new_count from inventory.count.updated webhook payload
 * 
 * Square webhook payload structure:
 * {
 *   "type": "inventory.count.updated",
 *   "data": {
 *     "type": "inventory_counts",
 *     "object": {
 *       "catalog_object_id": "VARIATION_ID",  // This is the square_variation_id
 *       "quantity": "123",                    // This is the new_count
 *       "state": "CUSTOM",
 *       ...
 *     }
 *     OR
 *     "object": {
 *       "inventory_counts": [{
 *         "catalog_object_id": "VARIATION_ID",
 *         "quantity": "123",
 *         ...
 *       }]
 *     }
 *   }
 * }
 */
function extractInventoryData(event) {
  const data = event.data;
  const object = data.object;
  
  let square_variation_id = null;
  let new_count = null;
  let state = 'CUSTOM';
  
  // Handle inventory_counts array structure
  if (object.inventory_counts && Array.isArray(object.inventory_counts) && object.inventory_counts.length > 0) {
    const inventoryCount = object.inventory_counts[0]; // Use first count
    square_variation_id = inventoryCount.catalog_object_id;
    new_count = inventoryCount.quantity;
    state = inventoryCount.state || 'CUSTOM';
  } 
  // Handle direct object structure
  else if (object.catalog_object_id) {
    square_variation_id = object.catalog_object_id;
    new_count = object.quantity || '0';
    state = object.state || 'CUSTOM';
  }
  
  return {
    square_variation_id,
    new_count,
    state,
  };
}

async function processInventoryCountUpdate(pool, event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Extract square_variation_id and new_count from webhook payload
    const { square_variation_id, new_count, state } = extractInventoryData(event);
    
    // Validate extracted data
    if (!square_variation_id) {
      console.warn('❌ Missing square_variation_id (catalog_object_id) in inventory count update');
      console.warn('Event data structure:', JSON.stringify(event.data, null, 2));
      await client.query('ROLLBACK');
      return null;
    }
    
    if (new_count === null || new_count === undefined) {
      console.warn(`❌ Missing new_count (quantity) for variation ${square_variation_id}`);
      await client.query('ROLLBACK');
      return null;
    }
    
    // Convert new_count to number (Square sends it as a string)
    let new_count_num = 0;
    if (new_count !== null && new_count !== undefined) {
      new_count_num = typeof new_count === 'string' ? parseInt(new_count, 10) : Number(new_count);
      if (isNaN(new_count_num)) {
        console.warn(`❌ Invalid new_count for ${square_variation_id}: ${new_count}`);
        await client.query('ROLLBACK');
        return null;
      }
    }
    
    console.log(`📦 Extracted inventory data:`, {
      square_variation_id,
      new_count: new_count_num,
      state,
    });
    
    // Get current stock_count from products table
    // Note: square_variation_id is used as the product id in our schema
    const currentProduct = await client.query(
      'SELECT stock_count FROM products WHERE id = $1',
      [square_variation_id]
    );
    
    if (currentProduct.rows.length === 0) {
      console.warn(`⚠️  Product not found in database: ${square_variation_id}`);
      console.warn(`   This product may not have been synced from Square yet.`);
      console.warn(`   Run 'npm run square:fetch' to sync products from Square.`);
      console.warn(`   Or this may be a test product that doesn't exist in your Square catalog.`);
      await client.query('ROLLBACK');
      return null;
    }
    
    const currentStock = currentProduct.rows[0].stock_count || 0;
    const quantityChange = new_count_num - currentStock;
    
    // Execute single, optimized SQL UPDATE query directly on the products table
    // This updates stock_count atomically with the new_count from Square
    const updateResult = await client.query(`
      UPDATE products 
      SET stock_count = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, stock_count, updated_at
    `, [new_count_num, square_variation_id]);
    
    if (updateResult.rows.length === 0) {
      console.error(`❌ Failed to update product ${square_variation_id} - product not found`);
      await client.query('ROLLBACK');
      return null;
    }
    
    const updatedProduct = updateResult.rows[0];
    console.log(`✅ Database updated: ${updatedProduct.name || square_variation_id} → stock_count: ${updatedProduct.stock_count}`);
    
    // Update products cache to reflect the new stock count
    // This ensures the frontend sees the updated inventory immediately
    // Use a savepoint so cache update failures don't abort the main transaction
    try {
      await client.query('SAVEPOINT cache_update');
      
      const cacheKey = 'square:products:spiralgroove';
      const cacheResult = await client.query(`
        SELECT value FROM product_cache WHERE key = $1
      `, [cacheKey]);
      
      if (cacheResult.rows.length > 0) {
        const cacheValue = cacheResult.rows[0].value;
        if (cacheValue && cacheValue.products && Array.isArray(cacheValue.products)) {
          // Update the product in the cache array
          const updatedProducts = cacheValue.products.map((product) => {
            if (product.id === square_variation_id) {
              return {
                ...product,
                stockCount: new_count_num,
              };
            }
            return product;
          });
          
          // Create updated cache value
          const updatedCacheValue = {
            ...cacheValue,
            products: updatedProducts,
            timestamp: new Date().toISOString(),
            count: updatedProducts.length,
          };
          
          // Update the cache
          await client.query(`
            UPDATE product_cache
            SET 
              value = $1::jsonb,
              updated_at = NOW()
            WHERE key = $2
          `, [JSON.stringify(updatedCacheValue), cacheKey]);
          
          console.log(`✅ Products cache updated for ${square_variation_id}: stockCount → ${new_count_num}`);
        } else {
          console.warn(`⚠️  Cache structure unexpected, skipping cache update`);
        }
      } else {
        console.warn(`⚠️  Cache not found for key ${cacheKey}, skipping cache update`);
      }
      
      await client.query('RELEASE SAVEPOINT cache_update');
    } catch (cacheError) {
      // Rollback to savepoint to continue with main transaction
      try {
        await client.query('ROLLBACK TO SAVEPOINT cache_update');
      } catch (rollbackError) {
        // If savepoint doesn't exist, the transaction might already be aborted
        // This is okay - we'll handle it in the outer error handler
        console.warn(`⚠️  Could not rollback to savepoint: ${rollbackError.message}`);
      }
      // Log but don't fail the transaction if cache update fails
      // The product update already succeeded, so this is just a cache miss
      console.warn(`⚠️  Failed to update products cache: ${cacheError.message}`);
      console.warn(`   This is non-critical - product inventory was updated successfully`);
    }
    
    // Create inventory record for audit trail
    // Store the actual quantity_change value for accurate audit trail
    // NOTE: We temporarily disable the trigger to prevent double-counting since we already
    // updated stock_count directly above to the exact value from Square.
    if (quantityChange !== 0) {
      const reason = quantityChange > 0 ? 'restock' : 'sale';
      const notes = `Square webhook: ${state} state. Previous: ${currentStock}, New: ${new_count_num} (change: ${quantityChange > 0 ? '+' : ''}${quantityChange})`;
      
      // Temporarily disable the trigger to prevent it from modifying stock_count
      // (we already updated it directly above to the exact value from Square)
      await client.query('ALTER TABLE inventory DISABLE TRIGGER update_stock_from_inventory');
      
      try {
        // Insert with the actual quantity_change value for accurate audit trail
        await client.query(`
          INSERT INTO inventory (product_id, quantity_change, reason, notes, created_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [square_variation_id, quantityChange, reason, notes]);
      } finally {
        // Re-enable the trigger after insert
        await client.query('ALTER TABLE inventory ENABLE TRIGGER update_stock_from_inventory');
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ Updated inventory for ${square_variation_id}: ${currentStock} → ${new_count_num} (change: ${quantityChange})`);
    
    return {
      square_variation_id,
      previousStock: currentStock,
      new_count: new_count_num,
      change: quantityChange,
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing inventory update:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main handler function
 * Vercel serverless functions receive req and res objects
 */
/**
 * Read raw body from request stream manually
 * CRITICAL: This MUST read the raw bytes BEFORE any parsing happens
 * Uses event-based stream reading (req.on('data')) which is more reliable in Vercel
 */
async function getRawBody(req) {
  try {
    // Strategy 1: Try to read from stream using event-based approach
    // This is the most reliable method for Vercel serverless functions
    if (req.readable && !req.readableEnded) {
      const rawBodyBuffer = await new Promise((resolve, reject) => {
        const chunks = [];
        let hasData = false;
        
        // Read data chunks as they arrive
        req.on('data', (chunk) => {
          hasData = true;
          // Preserve chunk as Buffer to maintain exact bytes
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        
        // When stream ends, concatenate all chunks
        req.on('end', () => {
          if (hasData) {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          } else {
            resolve(null);
          }
        });
        
        // Handle stream errors
        req.on('error', (error) => {
          console.error('[Webhook] Stream error:', error.message);
          reject(error);
        });
        
        // Timeout protection (10 seconds)
        const timeout = setTimeout(() => {
          if (!hasData) {
            req.removeAllListeners();
            resolve(null);
          }
        }, 10000);
        
        // Clear timeout if we get data
        req.once('data', () => {
          clearTimeout(timeout);
        });
      });
      
      if (rawBodyBuffer && rawBodyBuffer.length > 0) {
        console.log('[Webhook] Successfully read raw body stream:', {
          bufferLength: rawBodyBuffer.length,
          bufferType: rawBodyBuffer.constructor.name,
        });
        
        return {
          buffer: rawBodyBuffer,
          string: rawBodyBuffer.toString('utf8'),
        };
      }
    }
    
    // Strategy 2: Body is already a Buffer (bodyParser: false worked)
    if (Buffer.isBuffer(req.body)) {
      console.log('[Webhook] Body is already a Buffer');
      return {
        buffer: req.body,
        string: req.body.toString('utf8'),
      };
    }
    
    // Strategy 3: Body is a string (some Vercel configurations)
    if (typeof req.body === 'string') {
      console.log('[Webhook] Body is a string, converting to Buffer');
      const buffer = Buffer.from(req.body, 'utf8');
      return {
        buffer: buffer,
        string: req.body,
      };
    }
    
    // Strategy 4: Stream was already consumed - body was parsed by Vercel
    // This is a CRITICAL security issue - we cannot verify signature
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      console.error('❌ CRITICAL SECURITY ERROR: Cannot read raw request body');
      console.error('❌ Stream was already consumed - body was parsed by Vercel');
      console.error('❌ This prevents secure signature verification');
      console.error('❌ Possible causes:');
      console.error('   1. bodyParser: false not working in Vercel');
      console.error('   2. Middleware or framework parsed body before handler');
      console.error('   3. Request stream already consumed');
      
      // In production, we MUST reject requests without raw body
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
        return null;
      }
      
      // Development fallback (INSECURE - only for testing)
      console.warn('⚠️  DEVELOPMENT MODE: Attempting to reconstruct body from parsed object');
      console.warn('⚠️  This will NOT work for signature verification - signatures will fail');
      const reconstructed = JSON.stringify(req.body, null, 0);
      return {
        buffer: Buffer.from(reconstructed, 'utf8'),
        string: reconstructed,
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ CRITICAL: Failed to read raw request body stream:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ This prevents secure signature verification');
    
    // In production, we MUST reject requests without raw body
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
      return null;
    }
    
    // Development fallback (INSECURE - only for testing)
    console.warn('⚠️  DEVELOPMENT MODE: Attempting fallback');
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      const reconstructed = JSON.stringify(req.body, null, 0);
      return {
        buffer: Buffer.from(reconstructed, 'utf8'),
        string: reconstructed,
      };
    }
    
    return null;
  }
}

// Vercel configuration to disable automatic body parsing
// This is CRITICAL for webhook signature verification - we need the raw body
export const config = {
  api: {
    bodyParser: false, // Disable automatic JSON parsing to get raw body for signature verification
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // CRITICAL: Get raw body FIRST, before ANY other processing
  // This MUST happen before we touch req.body or do anything else
  // Once the stream is consumed, we cannot get the raw bytes needed for signature verification
  const rawBodyData = await getRawBody(req);
  
  try {
    // Get environment variables
    // Use inventory-specific signature key (different from order webhook)
    const signatureKey = process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY || 
                         process.env.SQUARE_SIGNATURE_KEY || 
                         process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                        process.env.DATABASE_URL || 
                        process.env.SPR_POSTGRES_URL ||
                        process.env.POSTGRES_URL;
    
    // Log environment variable status (without exposing secrets)
    console.log('Environment check:', {
      hasSignatureKey: !!signatureKey,
      hasDatabaseUrl: !!databaseUrl,
      signatureKeyLength: signatureKey ? signatureKey.length : 0,
      databaseUrlPrefix: databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'missing',
      hasRawBody: !!rawBodyData,
      rawBodyLength: rawBodyData ? rawBodyData.buffer.length : 0,
    });
    
    if (!signatureKey) {
      console.error('❌ Inventory webhook signature key not configured');
      console.error('Set INVENTORY_WEBHOOK_SIGNATURE_KEY in Vercel environment variables');
      console.error('This should be the signature key from the inventory webhook subscription in Square Dashboard');
      return res.status(500).json({ 
        error: 'Webhook signature key not configured',
        message: 'Set INVENTORY_WEBHOOK_SIGNATURE_KEY in Vercel environment variables',
      });
    }
    
    if (!databaseUrl) {
      console.error('❌ Database URL not configured');
      console.error('Set SPR_NEON_DATABSE_URL, DATABASE_URL, or SPR_POSTGRES_URL in Vercel environment variables');
      return res.status(500).json({ 
        error: 'Database not configured',
        message: 'Set SPR_NEON_DATABSE_URL in Vercel environment variables',
      });
    }
    
    if (!rawBodyData || !rawBodyData.buffer) {
      // CRITICAL: Cannot get raw body - signature verification cannot proceed securely
      console.error('❌ CRITICAL SECURITY ERROR: Cannot read raw request body');
      console.error('❌ This prevents secure signature verification');
      
      // In production, we MUST reject requests without raw body
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'Cannot read raw request body for signature verification. This is a security issue.',
        });
      }
      
      // Development fallback (INSECURE - only for testing)
      console.warn('⚠️  DEVELOPMENT MODE: Cannot verify signature - raw body unavailable');
      console.warn('⚠️  DO NOT USE IN PRODUCTION');
      
      if (!req.body || (req.body && typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        console.error('No request body received');
        return res.status(400).json({ error: 'Missing request body' });
      }
    }
    
    // Parse the raw body to get the payload
    let payload;
    try {
      payload = rawBodyData ? JSON.parse(rawBodyData.string) : req.body;
    } catch (e) {
      console.error('Failed to parse body as JSON:', e.message);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    console.log('Body received:', {
      bodyType: typeof req.body,
      bodyLength: rawBodyData ? rawBodyData.buffer.length : 0,
      hasPayload: !!payload,
      payloadType: payload?.type || 'unknown',
    });
    
    // Verify webhook signature
    // Square sends signature in x-square-hmacsha256-signature header (preferred)
    // Also check x-square-signature as fallback for older webhook subscriptions
    const signature = req.headers['x-square-hmacsha256-signature'] ||
                     req.headers['x-square-hmac-sha256-signature'] ||
                     req.headers['x-square-signature'];
    
    // Log all headers for debugging
    const allHeaders = Object.keys(req.headers);
    const squareHeaders = allHeaders.filter(h => 
      h.toLowerCase().includes('square') || 
      h.toLowerCase().includes('signature')
    );
    
    console.log('Signature verification:', {
      hasSignature: !!signature,
      signatureHeader: signature ? signature.substring(0, 50) + '...' : 'none',
      signatureLength: signature ? signature.length : 0,
      allSquareHeaders: squareHeaders.map(h => ({ 
        name: h, 
        value: req.headers[h]?.substring(0, 50) + '...',
        length: req.headers[h]?.length || 0
      })),
      signatureKeyLength: signatureKey ? signatureKey.length : 0,
    });
    
    // Require signature for security - return 403 if missing or invalid
    if (!signature) {
      console.error('❌ Missing Square webhook signature header');
      console.error('Required headers: x-square-signature or x-square-hmacsha256-signature');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Missing webhook signature' 
      });
    }
    
    // Verify signature - return 403 on failure
    // CRITICAL: Square includes the notification URL in the signature calculation
    // The signature is: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
    const notificationUrl = req.headers['x-forwarded-proto'] && req.headers['host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['host']}${req.url}`
      : req.url || '/api/webhooks/square-inventory';
    
    console.log('[Webhook] Attempting signature verification', {
      signatureLength: signature.length,
      signaturePreview: signature.substring(0, 30) + '...',
      bodyBufferLength: rawBodyData.buffer.length,
      signatureKeyLength: signatureKey.length,
      signatureKeySet: !!signatureKey,
      notificationUrl: notificationUrl,
    });
    
    const isValid = verifySquareSignature(signature, rawBodyData.buffer, signatureKey, notificationUrl);
    if (!isValid) {
      console.error('❌ Invalid Square webhook signature');
      console.error('Signature received:', signature);
      console.error('Body length:', rawBodyData.buffer.length);
      console.error('Body preview:', rawBodyData.string.substring(0, 300));
      
      // Calculate expected signature for debugging (not exposed to client)
      // Square includes URL in signature: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
      const bodyString = rawBodyData.buffer.toString('utf8');
      const signaturePayload = notificationUrl + bodyString;
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(signaturePayload, 'utf8');
      const calculated = hmac.digest('base64');
      console.error('Calculated signature (base64):', calculated);
      
      // Extract expected signature from received signature
      const expectedSig = signature.startsWith('sha256=') ? signature.substring(7) : signature;
      console.error('Expected signature (base64):', expectedSig);
      
      console.error('Signature mismatch details:', {
        expectedLength: expectedSig.length,
        calculatedLength: calculated.length,
        expectedPreview: expectedSig.substring(0, 30) + '...',
        calculatedPreview: calculated.substring(0, 30) + '...',
        bodyType: Buffer.isBuffer(rawBodyData.buffer) ? 'Buffer' : typeof rawBodyData.buffer,
        signatureKeyLength: signatureKey.length,
      });
      
      // In production, we MUST reject invalid signatures
      if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
        console.error('❌ PRODUCTION: Rejecting request with invalid signature');
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Invalid webhook signature' 
        });
      }
      
      // Development mode: Still reject but with more context
      console.error('❌ Signature verification failed');
      console.error('❌ This indicates the signature key may be incorrect or the request was tampered with');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Invalid webhook signature',
        // Include diagnostic info in development only
        ...(process.env.NODE_ENV !== 'production' && {
          debug: {
            signatureLength: signature.length,
            bodyLength: rawBodyData.buffer.length,
            signatureKeyLength: signatureKey.length,
            expectedLength: expectedSig.length,
            calculatedLength: calculated.length,
          }
        })
      });
    }
    
    console.log('✅ Signature verified successfully');
    
    // Square webhook structure: { type, merchant_id, event_id, created_at, data: { type, id, object } }
    if (!payload || !payload.type || !payload.data) {
      console.error('Invalid webhook payload structure');
      console.error('Payload keys:', payload ? Object.keys(payload) : 'null');
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    console.log(`📦 Received Square webhook: ${payload.type}`);
    
    // Initialize database connection
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    });
    
    let results = [];
    
    // Handle different event types
    switch (payload.type) {
      case 'inventory.count.updated':
        const result = await processInventoryCountUpdate(pool, payload);
        if (result) {
          results.push(result);
        }
        break;
        
      case 'inventory.count.created':
        // Similar to updated, but for new counts
        const createResult = await processInventoryCountUpdate(pool, payload);
        if (createResult) {
          results.push(createResult);
        }
        break;
        
      default:
        console.log(`⚠️  Unhandled webhook type: ${payload.type}`);
        // Return 200 to acknowledge receipt even if we don't handle it
    }
    
    await pool.end();
    
    // Return success response
    return res.status(200).json({
      success: true,
      event_type: payload.type,
      processed: results.length,
      results: results,
    });
    
  } catch (error) {
    // Generate unique error ID for Slack alerts and log correlation
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const route = '/api/webhooks/square-inventory';
    
    // Log error with context for Slack alerts
    console.error(`[${route}] Error ID: ${errorId}`, {
      error: error.message,
      stack: error.stack,
      timestamp,
      route,
      statusCode: 500,
      errorId,
      name: error.name,
      code: error.code,
    });
    
    // Send alert to Slack (non-blocking - don't wait for response)
    // Use centralized Slack alerting service
    import('../utils/slackAlerter.js')
      .then(({ sendSlackAlert }) => {
        return sendSlackAlert({
          priority: 'critical',
          errorId,
          route,
          title: 'Critical Webhook Error',
          message: error.message || 'Internal server error',
          context: '🔐 *Webhook Processing Error*: Failed to process Square inventory webhook.',
          recommendedAction: [
            'IDENTIFY SKU: Use the Square webhook payload in the Vercel logs to find the SKU that triggered the failure',
            'MANUAL FIX: Log into Neon and manually update the `stock_count` for that one SKU to match Square',
            'CODE REVIEW: Review the Vercel function logic for the specific error (e.g., failed database connection, invalid payload data)',
          ],
          fields: {
            'Status Code': '500',
            'Error Type': error.name || 'Error',
          },
          links: {
            'View Vercel Logs': `https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${process.env.VERCEL_PROJECT_NAME || 'commerce-template-react'}/logs?query=${encodeURIComponent(errorId)}`,
            'Square Dashboard': 'https://developer.squareup.com/apps',
          },
      });
      })
      .catch(err => {
        console.error('[Square Inventory] Failed to send Slack alert:', err);
      });
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Internal server error';
    let statusCode = 500;
    
    // Check for common errors
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
      errorMessage = 'Database connection failed. Check SPR_NEON_DATABSE_URL in Vercel environment variables.';
    } else if (error.message?.includes('ENOTFOUND')) {
      errorMessage = 'Database host not found. Check your database URL.';
    } else if (error.message?.includes('authentication')) {
      errorMessage = 'Database authentication failed. Check your database credentials.';
    }
    
    return res.status(statusCode).json({
      error: 'Internal server error',
      message: errorMessage,
      errorId, // Include error ID in response for debugging
      timestamp,
      route,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

