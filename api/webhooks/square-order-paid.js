/**
 * Square Order/Payment Webhook Handler
 * 
 * This Vercel serverless function handles Square webhook events for orders and payments.
 * It verifies the webhook signature and updates the Neon database accordingly.
 * 
 * Webhook URL: https://your-domain.vercel.app/api/webhooks/square-order-paid
 * 
 * Events handled:
 * - order.updated
 * - payment.created
 * - payment.updated
 */

import crypto from 'crypto';
import pg from 'pg';
const { Pool } = pg;

/**
 * Verify Square webhook signature
 */
function verifySquareSignature(signature, body, signatureKey) {
  if (!signature || !signatureKey) {
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

  // Calculate HMAC SHA256
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(body, 'utf8');
  const calculatedSignature = hmac.digest('base64');

  // Compare signatures using constant-time comparison
  // Both should be base64 strings
  if (expectedSignature.length !== calculatedSignature.length) {
    console.error('Signature length mismatch:', {
      expected: expectedSignature.length,
      calculated: calculatedSignature.length,
      expectedPreview: expectedSignature.substring(0, 20),
      calculatedPreview: calculatedSignature.substring(0, 20),
    });
    return false;
  }
  
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
 * Process order.updated event
 */
async function processOrderUpdate(pool, event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const data = event.data;
    
    // Square webhook structure for order.updated:
    // data.id = order ID
    // data.object.order_updated = order object with details
    // OR data.object = order object directly (depending on API version)
    
    let squareOrderId;
    let orderObject;
    let orderState = 'DRAFT';
    let version = 0;
    
    // Try different structures
    if (data.id) {
      // Structure: { data: { id: "order_id", object: { order_updated: {...} } } }
      squareOrderId = data.id;
      orderObject = data.object?.order_updated || data.object;
    } else if (data.object?.id) {
      // Structure: { data: { object: { id: "order_id", ... } } }
      squareOrderId = data.object.id;
      orderObject = data.object;
    } else if (data.object?.order_updated) {
      // Structure: { data: { object: { order_updated: { id: "order_id", ... } } } }
      orderObject = data.object.order_updated;
      squareOrderId = orderObject.id;
    } else {
      console.warn('Missing order ID in order update');
      console.warn('Data structure:', JSON.stringify(data, null, 2));
      await client.query('ROLLBACK');
      return null;
    }
    
    if (!squareOrderId) {
      console.warn('Order ID is null or undefined');
      console.warn('Data structure:', JSON.stringify(data, null, 2));
      await client.query('ROLLBACK');
      return null;
    }
    
    // Extract order state and version from order object
    if (orderObject) {
      orderState = orderObject.state || orderObject.order_state || 'DRAFT';
      version = orderObject.version || 0;
    }
    
    // Check if order already exists
    const existingOrder = await client.query(
      'SELECT id, status FROM orders WHERE square_order_id = $1',
      [squareOrderId]
    );
    
    // Map Square order state to our order status
    const statusMap = {
      'DRAFT': 'pending',
      'OPEN': 'confirmed',
      'COMPLETED': 'confirmed',
      'CANCELED': 'cancelled',
    };
    const orderStatus = statusMap[orderState] || 'pending';
    
    // Extract order totals from orderObject
    const netAmounts = orderObject?.net_amounts || {};
    const totalMoney = netAmounts.total_money || {};
    const totalAmount = totalMoney.amount ? Number(totalMoney.amount) / 100 : 0; // Convert cents to dollars
    
    if (existingOrder.rows.length > 0) {
      // Update existing order
      const orderId = existingOrder.rows[0].id;
      
      await client.query(`
        UPDATE orders 
        SET 
          status = $1,
          total = $2,
          square_order_id = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [orderStatus, totalAmount, squareOrderId, orderId]);
      
      console.log(`✅ Updated order ${orderId} (Square: ${squareOrderId}) to status: ${orderStatus}`);
      
      await client.query('COMMIT');
      return { orderId, action: 'updated', status: orderStatus };
    } else {
      // Order doesn't exist yet - might be created elsewhere or we'll create it on payment
      console.log(`ℹ️  Order ${squareOrderId} not found in database, skipping update`);
      await client.query('ROLLBACK');
      return null;
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing order update:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Process payment.created or payment.updated event
 */
async function processPaymentEvent(pool, event) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const data = event.data;
    const object = data.object;
    
    if (!object || !object.id) {
      console.warn('Missing payment ID in payment event');
      await client.query('ROLLBACK');
      return null;
    }
    
    const squarePaymentId = object.id;
    const paymentStatus = object.status || 'APPROVED';
    const orderId = object.order_id || null;
    
    // Extract payment amount
    const amountMoney = object.amount_money || {};
    const totalAmount = amountMoney.amount ? Number(amountMoney.amount) / 100 : 0; // Convert cents to dollars
    
    // Find order by Square order ID
    if (orderId) {
      const orderResult = await client.query(
        'SELECT id, status FROM orders WHERE square_order_id = $1',
        [orderId]
      );
      
      if (orderResult.rows.length > 0) {
        const orderId_db = orderResult.rows[0].id;
        const currentStatus = orderResult.rows[0].status;
        
        // Update order with payment info
        let newStatus = currentStatus;
        if (paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') {
          newStatus = 'confirmed';
        } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELED') {
          newStatus = 'cancelled';
        }
        
        await client.query(`
          UPDATE orders 
          SET 
            status = $1,
            square_payment_id = $2,
            payment_method = 'square',
            updated_at = NOW()
          WHERE id = $3
        `, [newStatus, squarePaymentId, orderId_db]);
        
        console.log(`✅ Updated order ${orderId_db} with payment ${squarePaymentId}, status: ${newStatus}`);
        
        await client.query('COMMIT');
        return { orderId: orderId_db, paymentId: squarePaymentId, action: 'payment_processed', status: newStatus };
      } else {
        console.log(`ℹ️  Order ${orderId} not found in database for payment ${squarePaymentId}`);
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      console.log(`ℹ️  Payment ${squarePaymentId} has no associated order_id`);
      await client.query('ROLLBACK');
      return null;
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing payment event:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main handler function
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get environment variables
    // Use order-specific signature key (different from inventory webhook)
    const signatureKey = process.env.ORDER_WEBHOOK_SIGNATURE_KEY || 
                         process.env.SQUARE_SIGNATURE_KEY || 
                         process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    
    const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                        process.env.DATABASE_URL || 
                        process.env.SPR_POSTGRES_URL ||
                        process.env.POSTGRES_URL;
    
    if (!signatureKey) {
      console.error('Order webhook signature key not configured');
      console.error('Set ORDER_WEBHOOK_SIGNATURE_KEY in Vercel environment variables');
      console.error('This should be the signature key from the order webhook subscription in Square Dashboard');
      return res.status(500).json({ error: 'Webhook signature key not configured' });
    }
    
    if (!databaseUrl) {
      console.error('Database URL not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    // Get raw body for signature verification
    // With bodyParser: false in vercel.json, req.body should be a Buffer or string
    let rawBody;
    let payload;
    
    // With bodyParser: false, Vercel provides the raw body
    if (Buffer.isBuffer(req.body)) {
      // Body is a Buffer - convert to string
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      // Body is already a string (raw) - this is what we want
      rawBody = req.body;
    } else if (req.body && typeof req.body === 'object') {
      // Body was parsed (fallback) - reconstruct JSON
      payload = req.body;
      rawBody = JSON.stringify(payload, null, 0);
      console.warn('⚠️  Body was parsed despite bodyParser: false - signature verification may fail');
    } else {
      // No body provided
      console.error('No request body received');
      return res.status(400).json({ error: 'Missing request body' });
    }
    
    // Parse JSON payload
    if (!payload) {
      try {
        payload = JSON.parse(rawBody);
      } catch (e) {
        console.error('Failed to parse body as JSON:', e.message);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    
    console.log('Body received:', {
      bodyType: typeof req.body,
      bodyLength: rawBody?.length || 0,
      hasPayload: !!payload,
      payloadType: payload?.type || 'unknown',
    });
    
    // Verify webhook signature
    // Square sends signature in X-Square-Signature header
    const signature = req.headers['x-square-signature'] || 
                     req.headers['x-square-hmacsha256-signature'] ||
                     req.headers['x-square-hmac-sha256-signature'];
    
    console.log('Signature verification:', {
      hasSignature: !!signature,
      signaturePrefix: signature ? signature.substring(0, 30) + '...' : 'none',
      relevantHeaders: Object.keys(req.headers).filter(h => 
        h.toLowerCase().includes('square') || 
        h.toLowerCase().includes('signature') ||
        h.toLowerCase().startsWith('x-')
      ),
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
    const isValid = verifySquareSignature(signature, rawBody, signatureKey);
    if (!isValid) {
      console.error('❌ Invalid Square webhook signature');
      console.error('Signature received:', signature);
      console.error('Body length:', rawBody.length);
      console.error('Body preview:', rawBody.substring(0, 300));
      
      // Calculate expected signature for debugging (not exposed to client)
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(rawBody, 'utf8');
      const calculated = hmac.digest('base64');
      console.error('Calculated signature (base64):', calculated);
      
      // Extract expected signature from received signature
      const expectedSig = signature.startsWith('sha256=') ? signature.substring(7) : signature;
      console.error('Expected signature (base64):', expectedSig);
      
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Invalid webhook signature' 
      });
    }
    
    console.log('✅ Signature verified successfully');
    
    // Validate payload structure
    if (!payload || !payload.type || !payload.data) {
      console.error('Invalid webhook payload structure');
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
      case 'order.updated':
        const orderResult = await processOrderUpdate(pool, payload);
        if (orderResult) {
          results.push(orderResult);
        }
        break;
        
      case 'payment.created':
      case 'payment.updated':
        const paymentResult = await processPaymentEvent(pool, payload);
        if (paymentResult) {
          results.push(paymentResult);
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
    console.error('Webhook handler error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
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
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

