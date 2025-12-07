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
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

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
async function processOrderUpdate(sql, event) {
  try {
    
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
      return null;
    }
    
    if (!squareOrderId) {
      console.warn('Order ID is null or undefined');
      console.warn('Data structure:', JSON.stringify(data, null, 2));
      return null;
    }
    
    // Extract order state and version from order object
    if (orderObject) {
      orderState = orderObject.state || orderObject.order_state || 'DRAFT';
      version = orderObject.version || 0;
    }
    
    // Check if order already exists
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE square_order_id = ${squareOrderId}
    `;
    
    // Map Square order state to our order status
    const statusMap = {
      'DRAFT': 'pending',
      'OPEN': 'confirmed',
      'COMPLETED': 'confirmed',
      'CANCELED': 'cancelled',
    };
    const orderStatus = statusMap[orderState] || 'pending';
    
    // ============================================
    // DATA EXTRACTION: Extract all required data from webhook payload
    // ============================================
    
    // 1. Extract square_order_id (already done above)
    // squareOrderId is extracted at lines 89-106
    
    // 2. Extract total_amount from order totals
    const netAmounts = orderObject?.net_amounts || {};
    const totalMoney = netAmounts.total_money || {};
    const totalAmount = totalMoney.amount ? Number(totalMoney.amount) / 100 : 0; // Convert cents to dollars
    
    // Also extract subtotal, tax, shipping for completeness
    const subtotalMoney = netAmounts.total_money || totalMoney || {};
    const subtotalAmount = subtotalMoney.amount ? Number(subtotalMoney.amount) / 100 : 0;
    const taxMoney = netAmounts.tax_money || {};
    const taxAmount = taxMoney.amount ? Number(taxMoney.amount) / 100 : 0;
    const shippingMoney = netAmounts.shipping_money || {};
    const shippingAmount = shippingMoney.amount ? Number(shippingMoney.amount) / 100 : 0;
    
    // 3. Extract customer_id from Square order metadata
    // We store customer_id in metadata.note or metadata.customer_id during checkout
    let customerId = null;
    const metadata = orderObject?.metadata || {};
    const note = orderObject?.note || '';
    
    // Try to extract from metadata first
    if (metadata.customer_id) {
      customerId = metadata.customer_id;
      console.log(`[Webhook] Extracted customer_id from metadata: ${customerId}`);
    } else if (note) {
      // Parse from note field: "Customer ID: {customer_id} | Order: {order_number}"
      const customerIdMatch = note.match(/Customer ID:\s*([a-f0-9-]+)/i);
      if (customerIdMatch) {
        customerId = customerIdMatch[1];
        console.log(`[Webhook] Extracted customer_id from note: ${customerId}`);
      }
    }
    
    // 4. Customer Reconciliation: Extract email and reconcile customer_id
    // If Square's payload only contains email (Guest Checkout), perform Neon lookup
    // If no match found, create new customer record for guest orders
    let customerEmail = null;
    let customerFirstName = null;
    let customerLastName = null;
    let customerPhone = null;
    
    // Extract email and customer details from fulfillments (pickup) or shipping address
    const fulfillments = orderObject?.fulfillments || [];
    const pickupFulfillment = fulfillments.find(f => f.type === 'PICKUP' || f.fulfillment_type === 'PICKUP');
    
    if (pickupFulfillment) {
      const pickupDetailsData = pickupFulfillment.pickup_details || pickupFulfillment.pickupDetails;
      const recipient = pickupDetailsData?.recipient || {};
      customerEmail = recipient.emailAddress || null;
      const displayName = recipient.displayName || '';
      if (displayName) {
        const nameParts = displayName.split(' ');
        customerFirstName = nameParts[0] || null;
        customerLastName = nameParts.slice(1).join(' ') || null;
      }
      customerPhone = recipient.phoneNumber || null;
    }
    
    // Try shipping address if no pickup email
    if (!customerEmail && orderObject?.shipping_address) {
      const shippingAddr = orderObject.shipping_address;
      // Email might be in different fields depending on Square API version
      customerEmail = shippingAddr.email || 
                     shippingAddr.email_address || 
                     shippingAddr.recipient?.emailAddress || 
                     null;
      if (shippingAddr.recipient) {
        const displayName = shippingAddr.recipient.displayName || '';
        if (displayName) {
          const nameParts = displayName.split(' ');
          customerFirstName = nameParts[0] || null;
          customerLastName = nameParts.slice(1).join(' ') || null;
        }
        customerPhone = shippingAddr.recipient.phoneNumber || null;
      }
    }
    
    // Reconcile customer_id via email if we have it and haven't found customer_id yet
    if (!customerId && customerEmail) {
      try {
        const normalizedEmail = customerEmail.toLowerCase().trim();
        const customerResult = await sql`
          SELECT id, email, first_name, last_name FROM customers 
          WHERE email = ${normalizedEmail}
        `;
        
        if (customerResult && customerResult.length > 0) {
          // Found registered user - use their customer_id
          customerId = customerResult[0].id;
          console.log(`[Webhook] Reconciled customer_id via email ${normalizedEmail}: ${customerId}`);
          
          // Update customer info if we have more complete data from order
          // Only update fields that are missing or if we have new data
          const needsUpdate = 
            (customerFirstName && !customerResult[0].first_name) ||
            (customerLastName && !customerResult[0].last_name) ||
            (customerPhone);
          
          if (needsUpdate) {
            await sql`
              UPDATE customers 
              SET 
                first_name = COALESCE(${customerFirstName || null}, first_name),
                last_name = COALESCE(${customerLastName || null}, last_name),
                phone = COALESCE(${customerPhone || null}, phone),
                updated_at = NOW()
              WHERE id = ${customerId}
            `;
            console.log(`[Webhook] Updated customer ${customerId} with additional info from order`);
          }
        } else {
          // No match found - create new customer record for guest order
          const newCustomerId = randomUUID();
          await sql`
            INSERT INTO customers (
              id,
              email,
              first_name,
              last_name,
              phone,
              created_at,
              updated_at
            ) VALUES (
              ${newCustomerId},
              ${normalizedEmail},
              ${customerFirstName || null},
              ${customerLastName || null},
              ${customerPhone || null},
              NOW(),
              NOW()
            )
          `;
          customerId = newCustomerId;
          console.log(`[Webhook] Created new customer record for guest order: ${customerId} (${normalizedEmail})`);
        }
      } catch (error) {
        console.error(`[Webhook] Failed to reconcile/create customer via email: ${error.message}`);
        // Continue without customer_id - order will be stored as guest
      }
    }
    
    // 5. Extract detailed line_items data
    const lineItems = orderObject?.line_items || [];
    const extractedLineItems = lineItems.map((item, index) => {
      // Extract item details
      const basePriceMoney = item.base_price_money || {};
      const basePrice = basePriceMoney.amount ? Number(basePriceMoney.amount) / 100 : 0;
      
      const grossSalesMoney = item.gross_sales_money || {};
      const grossSales = grossSalesMoney.amount ? Number(grossSalesMoney.amount) / 100 : 0;
      
      const totalMoney = item.total_money || {};
      const total = totalMoney.amount ? Number(totalMoney.amount) / 100 : 0;
      
      return {
        uid: item.uid || `item-${index}`,
        catalog_object_id: item.catalog_object_id || item.catalogObjectId || null,
        catalog_version: item.catalog_version || item.catalogVersion || null,
        name: item.name || 'Unknown Item',
        quantity: item.quantity || '1',
        item_type: item.item_type || item.itemType || 'ITEM',
        base_price: basePrice,
        gross_sales: grossSales,
        total: total,
        variation_name: item.variation_name || item.variationName || null,
      };
    });
    
    console.log(`[Webhook] Extracted ${extractedLineItems.length} line items from order ${squareOrderId}`);
    
    // 3.7 Extract pickup details from fulfillments (for pickup orders)
    // Log required pickup details: customer name, email, fulfillment type
    let pickupDetails = null;
    if (pickupFulfillment) {
      const pickupDetailsData = pickupFulfillment.pickup_details || pickupFulfillment.pickupDetails;
      const recipient = pickupDetailsData?.recipient || {};
      if (recipient.displayName || recipient.emailAddress) {
        pickupDetails = {
          firstName: recipient.displayName?.split(' ')[0] || customerFirstName || '',
          lastName: recipient.displayName?.split(' ').slice(1).join(' ') || customerLastName || '',
          email: recipient.emailAddress || customerEmail || '',
          phone: recipient.phoneNumber || customerPhone || '',
          fulfillmentType: 'PICKUP', // Required: fulfillment type
        };
      } else if (customerEmail) {
        // Fallback: use extracted customer data if fulfillment doesn't have recipient
        pickupDetails = {
          firstName: customerFirstName || '',
          lastName: customerLastName || '',
          email: customerEmail || '',
          phone: customerPhone || '',
          fulfillmentType: 'PICKUP',
        };
      }
    } else if (customerEmail) {
      // For shipping orders, still log customer details but with SHIPPING type
      pickupDetails = {
        firstName: customerFirstName || '',
        lastName: customerLastName || '',
        email: customerEmail || '',
        phone: customerPhone || '',
        fulfillmentType: 'SHIPPING',
      };
    }
    
    // 6. Database Transaction: Insert/Update order and order_items atomically
    // Use transaction to ensure data consistency
    if (existingOrder.length > 0) {
      // Update existing order with extracted data using transaction
      const orderId = existingOrder[0].id;
      
      try {
        // Use transaction to update order and order_items atomically
        await sql.begin(async (sql) => {
          // Update order record
          if (customerId && pickupDetails) {
            await sql`
              UPDATE orders 
              SET 
                status = ${orderStatus},
                subtotal = ${subtotalAmount},
                tax = ${taxAmount},
                shipping = ${shippingAmount},
                total = ${totalAmount},
                customer_id = ${customerId},
                square_order_id = ${squareOrderId},
                pickup_details = ${JSON.stringify(pickupDetails)},
                updated_at = NOW()
              WHERE id = ${orderId}
            `;
          } else if (customerId) {
            await sql`
              UPDATE orders 
              SET 
                status = ${orderStatus},
                subtotal = ${subtotalAmount},
                tax = ${taxAmount},
                shipping = ${shippingAmount},
                total = ${totalAmount},
                customer_id = ${customerId},
                square_order_id = ${squareOrderId},
                updated_at = NOW()
              WHERE id = ${orderId}
            `;
          } else if (pickupDetails) {
            await sql`
              UPDATE orders 
              SET 
                status = ${orderStatus},
                subtotal = ${subtotalAmount},
                tax = ${taxAmount},
                shipping = ${shippingAmount},
                total = ${totalAmount},
                square_order_id = ${squareOrderId},
                pickup_details = ${JSON.stringify(pickupDetails)},
                updated_at = NOW()
              WHERE id = ${orderId}
            `;
          } else {
            await sql`
              UPDATE orders 
              SET 
                status = ${orderStatus},
                subtotal = ${subtotalAmount},
                tax = ${taxAmount},
                shipping = ${shippingAmount},
                total = ${totalAmount},
                square_order_id = ${squareOrderId},
                updated_at = NOW()
              WHERE id = ${orderId}
            `;
          }
          
          // Delete existing order items (in case of updates)
          await sql`
            DELETE FROM order_items WHERE order_id = ${orderId}
          `;
          
          // Insert new line items within the same transaction
          if (extractedLineItems.length > 0) {
            for (const item of extractedLineItems) {
              // Only process ITEM type (skip modifiers, taxes, etc.)
              if (item.item_type !== 'ITEM') {
                continue;
              }
              
              if (!item.catalog_object_id) {
                console.warn(`[Webhook] Skipping line item without catalog_object_id: ${item.name}`);
                continue;
              }
              
              // Check if product exists in our database
              const productResult = await sql`
                SELECT id FROM products WHERE id = ${item.catalog_object_id}
              `;
              
              if (productResult && productResult.length > 0) {
                await sql`
                  INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    price,
                    subtotal,
                    created_at
                  ) VALUES (
                    ${orderId},
                    ${item.catalog_object_id},
                    ${parseInt(item.quantity) || 1},
                    ${item.base_price},
                    ${item.total},
                    NOW()
                  )
                `;
                console.log(`[Webhook] Stored line item: ${item.name} (${item.quantity}x)`);
              } else {
                console.warn(`[Webhook] Product ${item.catalog_object_id} not found in database, skipping line item`);
              }
            }
          }
        });
        
        console.log(`✅ Updated order ${orderId} (Square: ${squareOrderId}) to status: ${orderStatus}`);
        console.log(`   Customer ID: ${customerId || 'N/A'}`);
        console.log(`   Total: $${totalAmount}`);
        console.log(`   Line Items: ${extractedLineItems.length}`);
        if (pickupDetails) {
          console.log(`   Pickup Details: ${pickupDetails.firstName} ${pickupDetails.lastName} (${pickupDetails.email})`);
        }
        
        return { 
          orderId, 
          action: 'updated', 
          status: orderStatus,
          customerId,
          totalAmount,
          lineItemsCount: extractedLineItems.length,
        };
      } catch (error) {
        console.error(`[Webhook] Transaction failed for order ${orderId}:`, error.message);
        throw error; // Re-throw to trigger webhook error handling
      }
    } else {
      // Order doesn't exist - create new order with transaction
      // Generate order number from Square order ID or reference_id
      const orderNumber = orderObject?.reference_id || 
                         orderObject?.referenceId || 
                         `ORD-${squareOrderId.substring(0, 8).toUpperCase()}`;
      
      // Generate order ID (UUID)
      const newOrderId = randomUUID();
      
      try {
        // Use transaction to insert order and order_items atomically
        await sql.begin(async (sql) => {
          // 3.7 Pickup Details: Log required pickup details in JSONB column
          // Store: customer name, email, fulfillment type
          // pickupDetails already extracted above with all required fields
          const pickupDetailsForOrder = pickupDetails || null;
          
          // INSERT main record into orders table
          await sql`
            INSERT INTO orders (
              id,
              order_number,
              customer_id,
              status,
              subtotal,
              tax,
              shipping,
              total,
              shipping_method,
              pickup_details,
              square_order_id,
              created_at,
              updated_at
            ) VALUES (
              ${newOrderId},
              ${orderNumber},
              ${customerId || null},
              ${orderStatus},
              ${subtotalAmount},
              ${taxAmount},
              ${shippingAmount},
              ${totalAmount},
              ${pickupFulfillment ? 'pickup' : 'delivery'},
              ${JSON.stringify(pickupDetailsForOrder)},
              ${squareOrderId},
              NOW(),
              NOW()
            )
          `;
          
          console.log(`[Webhook] Created new order ${newOrderId} (Square: ${squareOrderId})`);
          console.log(`   Order Number: ${orderNumber}`);
          console.log(`   Customer ID: ${customerId || 'N/A'}`);
          console.log(`   Total: $${totalAmount}`);
          console.log(`   Pickup Details: ${JSON.stringify(pickupDetailsForOrder)}`);
          
          // INSERT individual items into order_items table, linking via order_id
          if (extractedLineItems.length > 0) {
            for (const item of extractedLineItems) {
              // Only process ITEM type (skip modifiers, taxes, etc.)
              if (item.item_type !== 'ITEM') {
                continue;
              }
              
              if (!item.catalog_object_id) {
                console.warn(`[Webhook] Skipping line item without catalog_object_id: ${item.name}`);
                continue;
              }
              
              // Check if product exists in our database
              const productResult = await sql`
                SELECT id FROM products WHERE id = ${item.catalog_object_id}
              `;
              
              if (productResult && productResult.length > 0) {
                await sql`
                  INSERT INTO order_items (
                    order_id,
                    product_id,
                    quantity,
                    price,
                    subtotal,
                    created_at
                  ) VALUES (
                    ${newOrderId},
                    ${item.catalog_object_id},
                    ${parseInt(item.quantity) || 1},
                    ${item.base_price},
                    ${item.total},
                    NOW()
                  )
                `;
                console.log(`[Webhook] Stored line item: ${item.name} (${item.quantity}x)`);
              } else {
                console.warn(`[Webhook] Product ${item.catalog_object_id} not found in database, skipping line item`);
              }
            }
          }
        });
        
        console.log(`✅ Created new order ${newOrderId} (Square: ${squareOrderId}) with ${extractedLineItems.length} items`);
        
        return { 
          orderId: newOrderId, 
          action: 'created', 
          status: orderStatus,
          customerId,
          totalAmount,
          lineItemsCount: extractedLineItems.length,
        };
      } catch (error) {
        console.error(`[Webhook] Transaction failed for new order ${squareOrderId}:`, error.message);
        throw error; // Re-throw to trigger webhook error handling
      }
    }
    
  } catch (error) {
    console.error('Error processing order update:', error);
    throw error;
  }
}

/**
 * Process payment.created or payment.updated event
 */
async function processPaymentEvent(sql, event) {
  try {
    
    const data = event.data;
    const object = data.object;
    
    if (!object || !object.id) {
      console.warn('Missing payment ID in payment event');
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
      const orderResult = await sql`
        SELECT id, status FROM orders WHERE square_order_id = ${orderId}
      `;
      
      if (orderResult.length > 0) {
        const orderId_db = orderResult[0].id;
        const currentStatus = orderResult[0].status;
        
        // Update order with payment info
        let newStatus = currentStatus;
        if (paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') {
          newStatus = 'confirmed';
        } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELED') {
          newStatus = 'cancelled';
        }
        
        await sql`
          UPDATE orders 
          SET 
            status = ${newStatus},
            square_payment_id = ${squarePaymentId},
            payment_method = 'square',
            updated_at = NOW()
          WHERE id = ${orderId_db}
        `;
        
        console.log(`✅ Updated order ${orderId_db} with payment ${squarePaymentId}, status: ${newStatus}`);
        
        return { orderId: orderId_db, paymentId: squarePaymentId, action: 'payment_processed', status: newStatus };
      } else {
        console.log(`ℹ️  Order ${orderId} not found in database for payment ${squarePaymentId}`);
        return null;
      }
    } else {
      console.log(`ℹ️  Payment ${squarePaymentId} has no associated order_id`);
      return null;
    }
    
  } catch (error) {
    console.error('Error processing payment event:', error);
    throw error;
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
    
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.NEON_DATABASE_URL || 
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
    
    // Initialize Neon database client
    const sql = neon(databaseUrl);
    
    let results = [];
    
    // Handle different event types
    switch (payload.type) {
      case 'order.updated':
        const orderResult = await processOrderUpdate(sql, payload);
        if (orderResult) {
          results.push(orderResult);
        }
        break;
        
      case 'payment.created':
      case 'payment.updated':
        const paymentResult = await processPaymentEvent(sql, payload);
        if (paymentResult) {
          results.push(paymentResult);
        }
        break;
        
      default:
        console.log(`⚠️  Unhandled webhook type: ${payload.type}`);
        // Return 200 to acknowledge receipt even if we don't handle it
    }
    
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
    const route = '/api/webhooks/square-order-paid';
    
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
    if (process.env.SLACK_WEBHOOK_URL) {
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      
      fetch(`${baseUrl}/api/webhooks/slack-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route,
          errorId,
          timestamp,
          errorMessage: error.message || 'Internal server error',
          statusCode: 500,
        }),
      }).catch(err => {
        console.error('[Slack Alert] Failed to send alert:', err);
        // Don't throw - we don't want Slack failures to break the error response
      });
    }
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Internal server error';
    let statusCode = 500;
    
    // Check for common errors
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
      errorMessage = 'Database connection failed. Check SPR_DATABASE_URL in Vercel environment variables.';
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

