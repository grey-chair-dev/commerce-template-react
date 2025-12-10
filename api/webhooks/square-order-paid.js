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
import { SquareClient, SquareEnvironment } from 'square';
import { sendEmail } from '../utils/email.js';
import { getOrderConfirmationEmail, getOrderStatusUpdateEmail } from '../utils/email-templates.js';

/**
 * Structured logging helper - reduces noise and improves readability
 */
const log = {
  info: (msg, data) => console.log(`[Webhook] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, err) => console.error(`[Webhook] ❌ ${msg}`, err?.message || err || ''),
  warn: (msg) => console.warn(`[Webhook] ⚠️  ${msg}`),
  success: (msg) => console.log(`[Webhook] ✅ ${msg}`),
};

/**
 * Verify Square webhook signature
 * @param {string} signature - The X-Square-Signature header value
 * @param {Buffer|string} body - The raw request body (Buffer or string)
 * @param {string} signatureKey - The Square webhook signature key
 * @param {string} notificationUrl - The full notification URL (required by Square)
 */
function verifySquareSignature(signature, body, signatureKey, notificationUrl) {
  if (!signature || !signatureKey || !notificationUrl) {
    return false;
  }

  // Square sends signature in format: sha256=BASE64_HASH or just BASE64_HASH
  let expectedSignature = signature.startsWith('sha256=') 
    ? signature.substring(7) 
    : signature;
  
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

  // Compare signatures using constant-time comparison
  if (expectedSignature.length !== calculatedSignature.length) {
    return false;
  }
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'base64'),
      Buffer.from(calculatedSignature, 'base64')
    );
  } catch (error) {
    // Fallback: string comparison if base64 decode fails
    return expectedSignature === calculatedSignature;
  }
}

/**
 * Fetch full order details from Square API
 * This ensures we always have complete data (line items, amounts, fulfillments)
 * even when the webhook payload is sparse
 */
async function fetchFullOrderFromSquare(squareOrderId) {
  try {
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
    
    if (!squareAccessToken) {
      return null;
    }
    
    const squareClient = new SquareClient({
      token: squareAccessToken,
      environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
    
    if (!squareClient.orders) {
      return null;
    }
    
    const ordersApi = squareClient.orders;
    
    // Diagnostic: Log available methods if retrieveOrder doesn't exist
    if (!ordersApi || typeof ordersApi.retrieveOrder !== 'function') {
      const availableMethods = ordersApi ? Object.keys(ordersApi).filter(key => typeof ordersApi[key] === 'function') : [];
      log.warn(`Square Orders API methods available: ${availableMethods.join(', ') || 'none'}`);
      log.warn(`Square client structure: orders=${!!ordersApi}, retrieveOrder=${typeof ordersApi?.retrieveOrder}`);
    }
    
    let orderResponse;
    
    try {
      // Try retrieveOrder method (Square SDK v43+)
      if (ordersApi && typeof ordersApi.retrieveOrder === 'function') {
        try {
          orderResponse = await ordersApi.retrieveOrder({ orderId: squareOrderId });
        } catch (e) {
          // If object format fails, try string format (some SDK versions)
          if (e.message?.includes('orderId') || e.message?.includes('parameter')) {
            try {
              orderResponse = await ordersApi.retrieveOrder(squareOrderId);
            } catch (e2) {
              log.error('Error calling retrieveOrder with string parameter', e2);
              throw e2;
            }
          } else {
            throw e;
          }
        }
      } 
      // Fallback: Try retrieve method (older SDK versions)
      else if (ordersApi && typeof ordersApi.retrieve === 'function') {
        orderResponse = await ordersApi.retrieve({ orderId: squareOrderId });
      }
      // Fallback: Try getOrder method (alternative naming)
      else if (ordersApi && typeof ordersApi.getOrder === 'function') {
        orderResponse = await ordersApi.getOrder({ orderId: squareOrderId });
      }
      // Last resort: Direct HTTP call if SDK methods don't work
      else {
        log.warn('Square Orders API methods not available, attempting direct HTTP call');
        try {
          const squareApiUrl = squareEnvironment === 'production' 
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com';
          
          const response = await fetch(`${squareApiUrl}/v2/orders/${squareOrderId}`, {
            method: 'GET',
            headers: {
              'Square-Version': '2024-01-18',
              'Authorization': `Bearer ${squareAccessToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            log.error(`Direct HTTP call failed: ${response.status} ${response.statusText}`, errorText);
            return null;
          }
          
          const data = await response.json();
          if (data.order) {
            orderResponse = { result: { order: data.order } };
            log.info('✅ Successfully fetched order via direct HTTP call');
          } else {
            log.warn('Direct HTTP call returned no order data');
            return null;
          }
        } catch (httpError) {
          log.error('Direct HTTP call error', httpError);
          return null;
        }
      }
    } catch (methodError) {
      log.error('Error fetching order from Square API', methodError);
      log.error('Error details:', {
        message: methodError.message,
        stack: methodError.stack,
        squareOrderId,
        hasOrdersApi: !!ordersApi,
        ordersApiType: typeof ordersApi,
      });
      return null;
    }
    
    if (orderResponse?.result?.order) {
      return orderResponse.result.order;
    }
    
    return null;
  } catch (fetchError) {
    log.error('Error fetching full order', fetchError);
    return null;
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
      log.warn('Missing order ID in order update');
      return null;
    }
    
    if (!squareOrderId) {
      log.warn('Order ID is null or undefined');
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
    
    // Extract fulfillment state from order fulfillments
    let fulfillmentState = null;
    const fulfillments = orderObject?.fulfillments || [];
    
    if (fulfillments.length > 0) {
      const firstFulfillment = fulfillments[0];
      fulfillmentState = firstFulfillment.state || firstFulfillment.fulfillment_state || 
                        firstFulfillment.fulfillmentState || firstFulfillment.State || null;
      
      if (fulfillmentState) {
        fulfillmentState = fulfillmentState.toUpperCase();
      }
    }
    
    // Map Square fulfillment state to our order status
    let orderStatus = 'New';
    
    if (fulfillmentState) {
      const fulfillmentStatusMap = {
        'PROPOSED': 'In Progress',
        'RESERVED': 'In Progress',
        'PREPARED': 'Ready',
        'COMPLETED': 'Picked Up',
        'CANCELED': 'Canceled',
        'CANCELLED': 'Canceled',
      };
      orderStatus = fulfillmentStatusMap[fulfillmentState] || orderStatus;
    } else {
      const statusMap = {
        'DRAFT': 'New',
        'OPEN': 'In Progress',
        'COMPLETED': 'Completed',
        'CANCELED': 'Canceled',
        'CANCELLED': 'Canceled',
      };
      orderStatus = statusMap[orderState] || 'New';
    }
    
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
      // Customer ID extracted from metadata
    } else if (note) {
      // Parse from note field: "Customer ID: {customer_id} | Order: {order_number}"
      const customerIdMatch = note.match(/Customer ID:\s*([a-f0-9-]+)/i);
      if (customerIdMatch) {
        customerId = customerIdMatch[1];
        // Customer ID extracted from note
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
    // Note: fulfillments already extracted above, reuse it
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
          customerId = customerResult[0].id;
          
          // Update customer info if we have more complete data from order
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
        }
      } catch (error) {
        log.error('Failed to reconcile/create customer via email', error);
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
    
    // Check if webhook payload is sparse (missing critical data)
    const hasLineItems = extractedLineItems.length > 0;
    const hasAmounts = totalAmount > 0;
    const isPayloadSparse = !hasLineItems || !hasAmounts;
    
    if (isPayloadSparse) {
      log.warn(`Sparse payload detected (${extractedLineItems.length} items, $${totalAmount} total) - fetching full order`);
      
      const fullOrder = await fetchFullOrderFromSquare(squareOrderId);
      
      if (fullOrder) {
        orderObject = fullOrder;
        
        // Re-extract all data from full order
        orderState = fullOrder.state || orderState;
        version = fullOrder.version || version;
        
        // Re-extract line items
        const fullLineItems = fullOrder.lineItems || fullOrder.line_items || [];
        extractedLineItems = fullLineItems.map((item, index) => {
          const basePriceMoney = item.basePriceMoney || item.base_price_money || {};
          const basePrice = basePriceMoney.amount ? Number(basePriceMoney.amount) / 100 : 0;
          
          const grossSalesMoney = item.grossSalesMoney || item.gross_sales_money || {};
          const grossSales = grossSalesMoney.amount ? Number(grossSalesMoney.amount) / 100 : 0;
          
          const totalMoney = item.totalMoney || item.total_money || {};
          const total = totalMoney.amount ? Number(totalMoney.amount) / 100 : 0;
          
          return {
            uid: item.uid || `item-${index}`,
            catalog_object_id: item.catalogObjectId || item.catalog_object_id || null,
            catalog_version: item.catalogVersion || item.catalog_version || null,
            name: item.name || 'Unknown Item',
            quantity: item.quantity || '1',
            item_type: item.itemType || item.item_type || 'ITEM',
            base_price: basePrice,
            gross_sales: grossSales,
            total: total,
            variation_name: item.variationName || item.variation_name || null,
          };
        });
        
        // Re-extract amounts
        const fullNetAmounts = fullOrder.netAmounts || fullOrder.net_amounts || {};
        const fullTotalMoney = fullNetAmounts.totalMoney || fullNetAmounts.total_money || {};
        totalAmount = fullTotalMoney.amount ? Number(fullTotalMoney.amount) / 100 : 0;
        
        const fullSubtotalMoney = fullNetAmounts.subtotalMoney || fullNetAmounts.subtotal_money || fullTotalMoney || {};
        subtotalAmount = fullSubtotalMoney.amount ? Number(fullSubtotalMoney.amount) / 100 : 0;
        
        const fullTaxMoney = fullNetAmounts.taxMoney || fullNetAmounts.tax_money || {};
        taxAmount = fullTaxMoney.amount ? Number(fullTaxMoney.amount) / 100 : 0;
        
        const fullShippingMoney = fullNetAmounts.shippingMoney || fullNetAmounts.shipping_money || {};
        shippingAmount = fullShippingMoney.amount ? Number(fullShippingMoney.amount) / 100 : 0;
        
        // Re-extract fulfillments
        const fullFulfillments = fullOrder.fulfillments || [];
        fulfillments = fullFulfillments;
        
        // Re-extract fulfillment state
        if (fullFulfillments.length > 0) {
          const firstFulfillment = fullFulfillments[0];
          fulfillmentState = firstFulfillment.state || firstFulfillment.fulfillmentState || null;
          if (fulfillmentState) {
            fulfillmentState = String(fulfillmentState).toUpperCase();
          }
          
          // Re-map status based on fulfillment state
          if (fulfillmentState) {
            const fulfillmentStatusMap = {
              'PROPOSED': 'In Progress',
              'RESERVED': 'In Progress',
              'PREPARED': 'Ready',
              'COMPLETED': 'Picked Up',
              'CANCELED': 'Canceled',
              'CANCELLED': 'Canceled',
            };
            orderStatus = fulfillmentStatusMap[fulfillmentState] || orderStatus;
          }
        }
        
        // Re-extract pickup details
        const fullPickupFulfillment = fullFulfillments.find(f => f.type === 'PICKUP' || f.fulfillmentType === 'PICKUP');
        if (fullPickupFulfillment) {
          const fullPickupDetailsData = fullPickupFulfillment.pickupDetails || fullPickupFulfillment.pickup_details;
          if (fullPickupDetailsData) {
            const fullRecipient = fullPickupDetailsData.recipient || {};
            pickupDetails = {
              firstName: fullRecipient.displayName?.split(' ')[0] || customerFirstName || '',
              lastName: fullRecipient.displayName?.split(' ').slice(1).join(' ') || customerLastName || '',
              email: fullRecipient.emailAddress || customerEmail || '',
              phone: fullRecipient.phoneNumber || customerPhone || '',
              fulfillmentType: 'PICKUP',
            };
          }
        }
        
        log.success(`Re-extracted from full order: ${extractedLineItems.length} items, $${totalAmount.toFixed(2)}`);
      } else {
        log.warn('Could not fetch full order - using sparse webhook data');
      }
    }
    
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
      const currentStatus = existingOrder[0].status;
      
      // Always update status if we have fulfillment state or if status is different
      // This ensures we sync even if status appears the same but fulfillment changed
      const shouldUpdate = orderStatus !== currentStatus || fulfillmentState !== null;
      
      if (shouldUpdate) {
        log.info(`Status update: "${currentStatus}" → "${orderStatus}" | Order: ${orderId}`);
        
        try {
          const updateResult = await sql`
            UPDATE orders 
            SET 
              status = ${orderStatus},
              updated_at = NOW()
            WHERE id = ${orderId}
            RETURNING id, status, updated_at
          `;
          
          if (updateResult && updateResult.length > 0) {
            log.success(`Order ${orderId} status updated: "${currentStatus}" → "${orderStatus}"`);
            
            // Send status update email if status changed to a notable status
            if (orderStatus !== currentStatus) {
              sendOrderStatusUpdateEmail(sql, orderId, orderStatus, currentStatus).catch(err => {
                log.error('Failed to send status update email', err);
              });
            }
            
            return {
              orderId: orderId,
              action: 'status_updated',
              status: orderStatus,
              fulfillmentState: fulfillmentState || null,
              orderState: orderState,
              previousStatus: currentStatus,
            };
          } else {
            log.error('Update query returned no rows - order may not exist');
          }
        } catch (error) {
          log.error('Error updating order status', error);
          // Continue to full update below
        }
      } else {
        // Status unchanged, updating order data if needed
      }
      
      // Always update order data (amounts, line items) even if status hasn't changed
      // This ensures we sync complete data from Square API when webhook payload was sparse
      try {
        // Neon serverless doesn't support transactions, so we do updates sequentially
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
        
        // Insert new line items
        if (extractedLineItems.length > 0) {
          for (const item of extractedLineItems) {
            // Only process ITEM type (skip modifiers, taxes, etc.)
            if (item.item_type !== 'ITEM') {
              continue;
            }
            
            if (!item.catalog_object_id) {
              // Skipping line item without catalog_object_id
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
              // Stored line item
            } else {
              // Product not found in database, skipping line item
            }
          }
        }
        
        log.success(`Order ${orderId} updated: ${orderStatus} | ${extractedLineItems.length} items | $${totalAmount.toFixed(2)}`);
        
        // Update inventory when order is completed or picked up (if not already updated via payment)
        // Only update if order status changed to Completed/Picked Up and we haven't updated inventory yet
        if ((orderStatus === 'Completed' || orderStatus === 'Picked Up') && extractedLineItems.length > 0) {
          // Check if inventory was already updated (by checking if order has payment_status)
          const orderCheck = await sql`
            SELECT payment_status FROM orders WHERE id = ${orderId}
          `;
          
          // Only update inventory if payment_status is null/empty (order created without payment webhook)
          // or if payment_status is APPROVED/COMPLETED (to ensure inventory is synced)
          const shouldUpdateInventory = !orderCheck || orderCheck.length === 0 || 
                                       !orderCheck[0].payment_status ||
                                       orderCheck[0].payment_status === 'APPROVED' ||
                                       orderCheck[0].payment_status === 'COMPLETED';
          
          if (shouldUpdateInventory) {
            updateInventoryForOrder(sql, orderId).catch(err => {
              log.error('Failed to update inventory after order status change', err);
              // Send Slack alert for inventory sync failure
              import('../utils/slackAlerter.js')
                .then(({ sendSlackAlert }) => {
                  return sendSlackAlert({
                    priority: 'high',
                    errorId: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                    route: '/api/webhooks/square-order-paid',
                    title: 'Inventory Sync Failure',
                    message: `Failed to update inventory after order status change`,
                    context: `Order ${orderId} status changed to ${orderStatus}, but inventory update failed. Product stock counts may be out of sync with Square.`,
                    recommendedAction: [
                      'Check Vercel logs for detailed error message',
                      'Manually verify inventory in Square Dashboard',
                      'Run inventory sync script if needed: npm run square:sync-stock',
                      'Verify products.stock_count matches Square inventory counts'
                    ],
                    fields: {
                      'Order ID': orderId.toString(),
                      'Order Status': orderStatus,
                      'Error': err.message || 'Unknown error'
                    },
                  });
                })
                .catch(alertErr => {
                  console.error('[Square Order Paid] Failed to send Slack alert:', alertErr);
                });
            });
          }
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
        log.error(`Transaction failed for order ${orderId}`, error);
        throw error; // Re-throw to trigger webhook error handling
      }
    } else {
      // Order doesn't exist - fetch full order details from Square API
      // The webhook payload is minimal, so we need to fetch the full order to get line items, amounts, etc.
      log.info(`Order ${squareOrderId} not found - fetching from Square API`);
      
      try {
        // Initialize Square client
        const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
        const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
        
        if (!squareAccessToken) {
          log.warn('SQUARE_ACCESS_TOKEN not configured - creating order with minimal data');
        } else {
          const squareClient = new SquareClient({
            token: squareAccessToken,
            environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
          });
          
          // Fetch full order from Square
          // Square SDK v43 - method may vary by version, try multiple approaches
          let orderResponse;
          try {
            // Check if orders API exists
            if (!squareClient.orders) {
              // Square client orders API not available
              orderResponse = null;
            } else {
              const ordersApi = squareClient.orders;
              
              // Diagnostic: Log available methods if retrieveOrder doesn't exist
              if (!ordersApi || typeof ordersApi.retrieveOrder !== 'function') {
                const availableMethods = ordersApi ? Object.keys(ordersApi).filter(key => typeof ordersApi[key] === 'function') : [];
                log.warn(`Square Orders API methods available: ${availableMethods.join(', ') || 'none'}`);
                log.warn(`Square client structure: orders=${!!ordersApi}, retrieveOrder=${typeof ordersApi?.retrieveOrder}`);
              }
              
              // Try retrieveOrder method (Square SDK v43+)
              if (ordersApi && typeof ordersApi.retrieveOrder === 'function') {
                try {
                  orderResponse = await ordersApi.retrieveOrder({ orderId: squareOrderId });
                } catch (e) {
                  // If object format fails, try string format (some SDK versions)
                  if (e.message?.includes('orderId') || e.message?.includes('parameter')) {
                    try {
                      orderResponse = await ordersApi.retrieveOrder(squareOrderId);
                    } catch (e2) {
                      log.error('Error calling retrieveOrder with string parameter', e2);
                      throw e2;
                    }
                  } else {
                    throw e;
                  }
                }
              } 
              // Fallback: Try retrieve method (older SDK versions)
              else if (ordersApi && typeof ordersApi.retrieve === 'function') {
                orderResponse = await ordersApi.retrieve({ orderId: squareOrderId });
              }
              // Fallback: Try getOrder method (alternative naming)
              else if (ordersApi && typeof ordersApi.getOrder === 'function') {
                orderResponse = await ordersApi.getOrder({ orderId: squareOrderId });
              }
              // Last resort: Direct HTTP call if SDK methods don't work
              else {
                log.warn('Square Orders API methods not available, attempting direct HTTP call');
                try {
                  const squareApiUrl = squareEnvironment === 'production' 
                    ? 'https://connect.squareup.com'
                    : 'https://connect.squareupsandbox.com';
                  
                  const response = await fetch(`${squareApiUrl}/v2/orders/${squareOrderId}`, {
                    method: 'GET',
                    headers: {
                      'Square-Version': '2024-01-18',
                      'Authorization': `Bearer ${squareAccessToken}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    log.error(`Direct HTTP call failed: ${response.status} ${response.statusText}`, errorText);
                    orderResponse = null;
                  } else {
                    const data = await response.json();
                    if (data.order) {
                      orderResponse = { result: { order: data.order } };
                      log.info('✅ Successfully fetched order via direct HTTP call');
                    } else {
                      log.warn('Direct HTTP call returned no order data');
                      orderResponse = null;
                    }
                  }
                } catch (httpError) {
                  log.error('Direct HTTP call error', httpError);
                  orderResponse = null;
                }
              }
            }
          } catch (methodError) {
            log.error('Error fetching order from Square API', methodError);
            orderResponse = null;
          }
          
          if (!orderResponse) {
            log.warn('Could not fetch full order - using sparse webhook data');
          }
          
          if (orderResponse.result && orderResponse.result.order) {
            const fullOrder = orderResponse.result.order;
            // Fetched full order from Square API
            
            // Use full order data instead of minimal webhook payload
            orderObject = fullOrder;
            
            // Re-extract data from full order
            orderState = fullOrder.state || 'DRAFT';
            version = fullOrder.version || 0;
            
            // Re-extract line items, amounts, fulfillments from full order
            const fullLineItems = fullOrder.lineItems || [];
            extractedLineItems = fullLineItems.map((item, index) => {
              const basePriceMoney = item.basePriceMoney || {};
              const basePrice = basePriceMoney.amount ? Number(basePriceMoney.amount) / 100 : 0;
              
              const grossSalesMoney = item.grossSalesMoney || {};
              const grossSales = grossSalesMoney.amount ? Number(grossSalesMoney.amount) / 100 : 0;
              
              const totalMoney = item.totalMoney || {};
              const total = totalMoney.amount ? Number(totalMoney.amount) / 100 : 0;
              
              return {
                uid: item.uid || `item-${index}`,
                catalog_object_id: item.catalogObjectId || null,
                catalog_version: item.catalogVersion || null,
                name: item.name || 'Unknown Item',
                quantity: item.quantity || '1',
                item_type: item.itemType || 'ITEM',
                base_price: basePrice,
                gross_sales: grossSales,
                total: total,
                variation_name: item.variationName || null,
              };
            });
            
            // Re-extract amounts from full order
            const fullNetAmounts = fullOrder.netAmounts || {};
            const fullTotalMoney = fullNetAmounts.totalMoney || {};
            totalAmount = fullTotalMoney.amount ? Number(fullTotalMoney.amount) / 100 : 0;
            
            const fullSubtotalMoney = fullNetAmounts.subtotalMoney || fullTotalMoney || {};
            subtotalAmount = fullSubtotalMoney.amount ? Number(fullSubtotalMoney.amount) / 100 : 0;
            
            const fullTaxMoney = fullNetAmounts.taxMoney || {};
            taxAmount = fullTaxMoney.amount ? Number(fullTaxMoney.amount) / 100 : 0;
            
            const fullShippingMoney = fullNetAmounts.shippingMoney || {};
            shippingAmount = fullShippingMoney.amount ? Number(fullShippingMoney.amount) / 100 : 0;
            
            // Re-extract fulfillments from full order
            const fullFulfillments = fullOrder.fulfillments || [];
            fulfillments = fullFulfillments;
            
            // Re-extract fulfillment state
            if (fullFulfillments.length > 0) {
              const firstFulfillment = fullFulfillments[0];
              fulfillmentState = firstFulfillment.state || firstFulfillment.fulfillmentState || null;
              if (fulfillmentState) {
                fulfillmentState = String(fulfillmentState).toUpperCase();
              }
            }
            
            // Re-map status based on fulfillment state
            if (fulfillmentState) {
              const fulfillmentStatusMap = {
                'PROPOSED': 'processing',
                'RESERVED': 'processing',
                'PREPARED': 'ready for pickup',
                'COMPLETED': 'picked up',
                'CANCELED': 'cancelled',
                'CANCELLED': 'cancelled',
              };
              orderStatus = fulfillmentStatusMap[fulfillmentState] || orderStatus;
            }
            
            // Re-extract pickup details
            const fullPickupFulfillment = fullFulfillments.find(f => f.type === 'PICKUP' || f.fulfillmentType === 'PICKUP');
            if (fullPickupFulfillment) {
              const fullPickupDetailsData = fullPickupFulfillment.pickupDetails || fullPickupFulfillment.pickup_details;
              if (fullPickupDetailsData) {
                const fullRecipient = fullPickupDetailsData.recipient || {};
                pickupDetails = {
                  email: fullRecipient.emailAddress || null,
                  phone: fullRecipient.phoneNumber || null,
                  name: fullRecipient.displayName || null,
                  scheduled_at: fullPickupDetailsData.scheduledAt || null,
                  pickup_at: fullPickupDetailsData.pickupAt || null,
                  prep_time_duration: fullPickupDetailsData.prepTimeDuration || null,
                };
              }
            }
            
            log.success(`Re-extracted from full order: ${extractedLineItems.length} items, $${totalAmount.toFixed(2)}`);
          } else {
            log.warn('Could not fetch full order from Square API - using minimal webhook data');
          }
        }
      } catch (fetchError) {
        log.error('Error fetching full order from Square', fetchError);
        log.warn('Continuing with minimal webhook payload data');
      }
      
      // Generate order number from Square order ID or reference_id
      const orderNumber = orderObject?.referenceId || 
                         orderObject?.reference_id || 
                         `ORD-${squareOrderId.substring(0, 8).toUpperCase()}`;
      
      // Generate order ID (UUID)
      const newOrderId = randomUUID();
      
      try {
        // Neon serverless doesn't support transactions, so we do inserts sequentially
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
        
        log.success(`Created new order ${newOrderId} (${orderNumber}) | $${totalAmount.toFixed(2)}`);
        
        // INSERT individual items into order_items table, linking via order_id
        if (extractedLineItems.length > 0) {
          for (const item of extractedLineItems) {
            // Only process ITEM type (skip modifiers, taxes, etc.)
            if (item.item_type !== 'ITEM') {
              continue;
            }
            
            if (!item.catalog_object_id) {
              // Skipping line item without catalog_object_id
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
              // Stored line item
            } else {
              // Product not found in database, skipping line item
            }
          }
        }
        
        log.success(`Order ${newOrderId} created with ${extractedLineItems.length} items`);
        
        // Send order confirmation email for new orders if payment is already approved
        // Note: For most orders, payment comes later via payment.created webhook
        // But if order is created with payment already approved, send confirmation now
        if (orderStatus === 'In Progress' || orderStatus === 'Confirmed') {
          sendOrderConfirmationEmail(sql, newOrderId).catch(err => {
            log.error('Failed to send confirmation email', err);
          });
        }
        
        return { 
          orderId: newOrderId, 
          action: 'created', 
          status: orderStatus,
          customerId,
          totalAmount,
          lineItemsCount: extractedLineItems.length,
        };
      } catch (error) {
        log.error(`Transaction failed for new order ${squareOrderId}`, error);
        throw error; // Re-throw to trigger webhook error handling
      }
    }
    
  } catch (error) {
    log.error('Error processing order update', error);
    throw error;
  }
}

/**
 * Send order confirmation email when payment is approved
 */
async function sendOrderConfirmationEmail(sql, orderId) {
  try {
    // Fetch order details with customer and items
    const orderResult = await sql`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.subtotal,
        o.tax,
        o.total,
        o.pickup_details,
        o.created_at,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ${orderId}
    `;

    if (!orderResult || orderResult.length === 0) {
      // Order not found, skipping confirmation email
      return;
    }

    const order = orderResult[0];
    
    // Get customer email from order or pickup details
    const customerEmail = order.customer_email || order.pickup_details?.email;
    if (!customerEmail) {
      // No email found for order, skipping confirmation email
      return;
    }

    // Fetch order items
    const itemsResult = await sql`
      SELECT 
        oi.quantity,
        oi.price,
        oi.subtotal,
        p.name,
        p.image_url
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ${orderId}
    `;

    const items = itemsResult.map(item => ({
      name: item.name || 'Unknown Item',
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.image_url,
    }));

    const customerName = order.first_name && order.last_name
      ? `${order.first_name} ${order.last_name}`
      : order.first_name || order.pickup_details?.firstName || customerEmail.split('@')[0];

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const { html, text } = getOrderConfirmationEmail({
      orderNumber: order.order_number,
      customerName,
      customerEmail,
      items,
      subtotal: Number(order.subtotal),
      tax: Number(order.tax),
      total: Number(order.total),
      orderDate,
      pickupDetails: order.pickup_details,
    });

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173';

    await sendEmail({
      to: customerEmail,
      subject: `Order Confirmation - ${order.order_number} - Spiral Groove Records`,
      html,
      text,
      emailType: 'order-confirmation',
      orderNumber: order.order_number,
      orderId: order.id,
      customerName,
      orderUrl: `${baseUrl}/order-confirmation?id=${order.id}`,
    });

    // Order confirmation email sent
  } catch (error) {
    // Don't fail webhook if email fails
    log.error('Failed to send order confirmation email', error);
  }
}

/**
 * Send order status update email (e.g., ready for pickup)
 */
async function sendOrderStatusUpdateEmail(sql, orderId, newStatus, previousStatus) {
  try {
    // Only send emails for specific status changes
    const statusesToEmail = ['Ready', 'Picked Up', 'Completed', 'Canceled', 'Refunded'];
    if (!statusesToEmail.includes(newStatus)) {
      return; // Don't send email for other status changes
    }

    // Fetch order details
    const orderResult = await sql`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.pickup_details,
        c.email as customer_email,
        c.first_name,
        c.last_name
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      WHERE o.id = ${orderId}
    `;

    if (!orderResult || orderResult.length === 0) {
      return;
    }

    const order = orderResult[0];
    const customerEmail = order.customer_email || order.pickup_details?.email;
    if (!customerEmail) {
      return;
    }

    const customerName = order.first_name && order.last_name
      ? `${order.first_name} ${order.last_name}`
      : order.first_name || order.pickup_details?.firstName || customerEmail.split('@')[0];

    const statusMessages = {
      'Ready': 'Your order is ready for pickup! Come by the store during our business hours.',
      'Picked Up': 'Your order has been picked up. Thank you for shopping with us!',
      'Completed': 'Your order has been completed. Thank you for your purchase!',
      'Canceled': 'Your order has been canceled. If you have questions, please contact us.',
      'Refunded': 'Your order has been refunded. The refund will be processed to your original payment method.',
    };

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5173';

    const { html, text } = getOrderStatusUpdateEmail({
      orderNumber: order.order_number,
      customerName,
      status: newStatus,
      statusMessage: statusMessages[newStatus] || `Your order status has been updated to ${newStatus}.`,
      items: [], // Could fetch items if needed
      orderUrl: `${baseUrl}/order-confirmation?id=${order.id}`,
    });

    await sendEmail({
      to: customerEmail,
      subject: `Order ${order.order_number} - ${newStatus} - Spiral Groove Records`,
      html,
      text,
      emailType: 'order-status-update',
      orderNumber: order.order_number,
      orderId: order.id,
      status: newStatus,
      previousStatus,
      customerName,
    });

    // Status update email sent successfully
  } catch (error) {
    // Don't fail webhook if email fails
    log.error('Failed to send status update email', error);
  }
}

/**
 * Update inventory (products.stock_count) after order payment
 * Deducts quantities from products based on order items
 */
async function updateInventoryForOrder(sql, orderId) {
  try {
    // Get all order items for this order
    const orderItems = await sql`
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = ${orderId}
    `;

    if (!orderItems || orderItems.length === 0) {
      log.warn(`No order items found for order ${orderId}, skipping inventory update`);
      return;
    }

    log.info(`Updating inventory for order ${orderId}: ${orderItems.length} items`);

    // Update stock_count for each product
    const updates = [];
    for (const item of orderItems) {
      const productId = item.product_id;
      const quantity = parseInt(item.quantity) || 1;

      try {
        // Deduct quantity from stock_count (ensure it doesn't go below 0)
        const result = await sql`
          UPDATE products
          SET 
            stock_count = GREATEST(0, stock_count - ${quantity}),
            updated_at = NOW()
          WHERE id = ${productId}
          RETURNING id, name, stock_count
        `;

        if (result && result.length > 0) {
          const updated = result[0];
          updates.push({
            productId,
            productName: updated.name,
            quantityDeducted: quantity,
            newStockCount: updated.stock_count,
          });
          log.info(`  ✅ ${updated.name || productId}: -${quantity} → stock_count: ${updated.stock_count}`);
        } else {
          log.warn(`  ⚠️  Product ${productId} not found, skipping inventory update`);
        }
      } catch (itemError) {
        log.error(`  ❌ Failed to update inventory for product ${productId}:`, itemError);
        throw itemError; // Re-throw to trigger error handling
      }
    }

    log.success(`Inventory updated for order ${orderId}: ${updates.length} products updated`);
    return { orderId, updates };
  } catch (error) {
    log.error(`Error updating inventory for order ${orderId}:`, error);
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
    
    // Handle different payload structures:
    // 1. { data: { object: { payment: { id: "...", ... } } } } - nested payment object
    // 2. { data: { object: { id: "...", ... } } } - direct payment object
    const payment = object?.payment || object;
    
    if (!payment || !payment.id) {
      log.warn('Missing payment ID in payment event');
      return null;
    }
    
    const squarePaymentId = payment.id;
    const paymentStatus = payment.status || 'APPROVED';
    const orderId = payment.order_id || null;
    
    // Extract payment amount
    const amountMoney = payment.amount_money || payment.total_money || {};
    const totalAmount = amountMoney.amount ? Number(amountMoney.amount) / 100 : 0; // Convert cents to dollars
    
    log.info(`Processing payment: ${squarePaymentId} | ${paymentStatus} | $${totalAmount.toFixed(2)}`);
    
    // Find order by Square order ID
    if (orderId) {
      const orderResult = await sql`
        SELECT id, status FROM orders WHERE square_order_id = ${orderId}
      `;
      
      if (orderResult.length > 0) {
        const orderId_db = orderResult[0].id;
        const currentStatus = orderResult[0].status;
        
        // Update order with payment info
        // Track payment_status separately from order status (fulfillment status)
        // Order status is determined by fulfillment state, not payment status
        // Payment status only affects order status in specific cases (payment failures)
        
        let newStatus = currentStatus;
        let newPaymentStatus = paymentStatus; // Store payment status separately
        
        // Only update order status based on payment status in specific cases:
        // 1. Payment failed/canceled/voided → Order should be Canceled
        // 2. Payment refunded → Order should be Refunded
        // 3. Payment approved/completed → Order status stays as-is (fulfillment determines status)
        
        if (paymentStatus === 'REFUNDED') {
          // Payment refunded - order is refunded
          newStatus = 'Refunded';
        } else if (paymentStatus === 'CANCELED' || paymentStatus === 'FAILED' || paymentStatus === 'VOIDED') {
          // Payment canceled/failed/voided - order should be canceled
          newStatus = 'Canceled';
        } else if (paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') {
          // Payment approved/completed - order can be processed
          // Only update order status if it's still New
          if (currentStatus === 'New') {
            newStatus = 'In Progress';
          }
          // Otherwise, fulfillment state determines order status
        } else if (paymentStatus === 'PENDING') {
          // Payment pending - order stays in New
          if (currentStatus === 'New') {
            newStatus = 'New';
          }
        }
        // For other payment statuses, keep current order status
        
        await sql`
          UPDATE orders 
          SET 
            status = ${newStatus},
            payment_status = ${newPaymentStatus},
            square_payment_id = ${squarePaymentId},
            payment_method = 'square',
            updated_at = NOW()
          WHERE id = ${orderId_db}
        `;
        
        log.success(`Order ${orderId_db} payment processed: ${paymentStatus} → ${newStatus}`);
        
        // Update inventory when payment is approved/completed
        if (paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') {
          updateInventoryForOrder(sql, orderId_db).catch(err => {
            log.error('Failed to update inventory after payment', err);
            // Send Slack alert for inventory sync failure
            import('../utils/slackAlerter.js')
              .then(({ sendSlackAlert }) => {
                return sendSlackAlert({
                  priority: 'high',
                  errorId: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                  route: '/api/webhooks/square-order-paid',
                  title: 'Inventory Sync Failure',
                  message: `Failed to update inventory after order payment`,
                  context: `Order ${orderId_db} payment was ${paymentStatus}, but inventory update failed. Product stock counts may be out of sync with Square.`,
                  recommendedAction: [
                    'Check Vercel logs for detailed error message',
                    'Manually verify inventory in Square Dashboard',
                    'Run inventory sync script if needed: npm run square:sync-stock',
                    'Verify products.stock_count matches Square inventory counts'
                  ],
                  fields: {
                    'Order ID': orderId_db.toString(),
                    'Payment Status': paymentStatus,
                    'Error': err.message || 'Unknown error'
                  },
                });
              })
              .catch(alertErr => {
                console.error('[Square Order Paid] Failed to send Slack alert:', alertErr);
              });
          });
        }
        
        // Send order confirmation email when payment is approved/completed
        if ((paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') && currentStatus === 'New') {
          sendOrderConfirmationEmail(sql, orderId_db).catch(err => {
            log.error('Failed to send confirmation email', err);
          });
        }
        
        return { orderId: orderId_db, paymentId: squarePaymentId, action: 'payment_processed', status: newStatus };
      } else {
        // Order not found for this payment
        return null;
      }
    } else {
      // Payment has no associated order_id
      return null;
    }
    
  } catch (error) {
    log.error('Error processing payment event', error);
    throw error;
  }
}

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
          log.error('Stream error', error);
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
        log.info('Successfully read raw body stream', {
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
      log.info('Body is already a Buffer');
      return {
        buffer: req.body,
        string: req.body.toString('utf8'),
      };
    }
    
    // Strategy 3: Body is a string (some Vercel configurations)
    if (typeof req.body === 'string') {
      log.info('Body is a string, converting to Buffer');
      const buffer = Buffer.from(req.body, 'utf8');
      return {
        buffer: buffer,
        string: req.body,
      };
    }
    
    // Strategy 4: Stream was already consumed - body was parsed by Vercel
    // This is a CRITICAL security issue - we cannot verify signature
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      log.error('CRITICAL SECURITY ERROR: Cannot read raw request body');
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
    log.error('CRITICAL: Failed to read raw request body stream', error);
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

/**
 * Vercel configuration to disable automatic body parsing
 * This is CRITICAL for webhook signature verification - we need the raw body
 * 
 * Note: This config works for Vercel serverless functions.
 * If this doesn't work in your environment, you may need to:
 * 1. Install and use the 'micro' library: npm install micro
 * 2. Use: import getRawBody from 'micro'; const rawBody = await getRawBody(req);
 */
export const config = {
  api: {
    bodyParser: false, // Disable automatic JSON parsing to get raw body for signature verification
  },
};

/**
 * Main handler function
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // CRITICAL: Get raw body FIRST, before ANY other processing
  // This MUST happen before we touch req.body or do anything else
  // Once the stream is consumed, we cannot get the raw bytes needed for signature verification
  let rawBodyData;
  try {
    rawBodyData = await getRawBody(req);
  } catch (streamError) {
    log.error('Error reading request body stream', streamError);
    return res.status(400).json({ error: 'Failed to read request body' });
  }
  
  if (!rawBodyData || !rawBodyData.buffer || rawBodyData.buffer.length === 0) {
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
      log.error('No request body received');
      return res.status(400).json({ error: 'Missing request body' });
    }
  }
  
  try {
    const signatureKey = process.env.ORDER_WEBHOOK_SIGNATURE_KEY || 
                         process.env.SQUARE_SIGNATURE_KEY || 
                         process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.NEON_DATABASE_URL || 
                        process.env.DATABASE_URL || 
                        process.env.SPR_POSTGRES_URL ||
                        process.env.POSTGRES_URL;
    
    if (!signatureKey) {
      log.error('Webhook signature key not configured');
      return res.status(500).json({ error: 'Webhook signature key not configured' });
    }
    
    if (!databaseUrl) {
      log.error('Database URL not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }
    
    // Parse the raw body to get the payload
    let payload;
    try {
      payload = rawBodyData ? JSON.parse(rawBodyData.string) : req.body;
    } catch (e) {
      log.error('Failed to parse JSON body', e);
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    // Verify webhook signature
    // Square sends signature in x-square-hmacsha256-signature header (preferred)
    // Also check x-square-signature as fallback for older webhook subscriptions
    const signature = req.headers['x-square-hmacsha256-signature'] ||
                     req.headers['x-square-hmac-sha256-signature'] ||
                     req.headers['x-square-signature'];
    
    if (!signature) {
      log.error('Missing webhook signature header');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Missing webhook signature' 
      });
    }
    
    // CRITICAL: Square includes the notification URL in the signature calculation
    // The signature is: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
    const notificationUrl = req.headers['x-forwarded-proto'] && req.headers['host']
      ? `${req.headers['x-forwarded-proto']}://${req.headers['host']}${req.url}`
      : req.url || '/api/webhooks/square-order-paid';
    
    // Log signature verification attempt
    log.info('Attempting signature verification', {
      signatureLength: signature.length,
      signaturePreview: signature.substring(0, 30) + '...',
      bodyBufferLength: rawBodyData.buffer.length,
      signatureKeyLength: signatureKey.length,
      signatureKeySet: !!signatureKey,
      notificationUrl: notificationUrl,
    });
    
    const isValid = verifySquareSignature(signature, rawBodyData.buffer, signatureKey, notificationUrl);
    
    if (!isValid) {
      log.error('Invalid webhook signature - rejecting request', {
        signatureLength: signature.length,
        bodyLength: rawBodyData.buffer.length,
        signatureKeyLength: signatureKey.length,
      });
      
      // Calculate what we got for debugging (first 30 chars only)
      // Square includes URL in signature: HMAC-SHA256(signatureKey, notificationUrl + rawBody)
      const bodyString = rawBodyData.buffer.toString('utf8');
      const signaturePayload = notificationUrl + bodyString;
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(signaturePayload, 'utf8');
      const calculated = hmac.digest('base64');
      const expectedSig = signature.startsWith('sha256=') ? signature.substring(7) : signature;
      
      log.error('Signature mismatch details', {
        expectedLength: expectedSig.length,
        calculatedLength: calculated.length,
        expectedPreview: expectedSig.substring(0, 30) + '...',
        calculatedPreview: calculated.substring(0, 30) + '...',
      });
      
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
    
    // Validate payload structure
    if (!payload || !payload.type || !payload.data) {
      log.error('Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    log.info(`Processing ${payload.type}`);
    
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
        log.warn(`Unhandled webhook type: ${payload.type}`);
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
    
    // Log error with context
    log.error(`Error ID: ${errorId}`, error);
    
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
          context: '🔐 *Webhook Processing Error*: Failed to process Square order payment webhook.',
          recommendedAction: [
            'IMMEDIATE CHECK: Log into the Square Dashboard to find the order ID in the alert',
            'MANUAL FIX: Manually insert that order\'s details into the Neon `orders` and `order_items` tables',
            'CODE REVIEW: Check Vercel logs for the specific error (e.g., SQL syntax error, database connection failure) and push a fix immediately',
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
        // Failed to send Slack alert (non-critical)
        console.error('[Square Order Paid] Failed to send Slack alert:', err);
      });
    
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

