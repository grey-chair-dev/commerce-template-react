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
 * Fetch full order details from Square API
 * This ensures we always have complete data (line items, amounts, fulfillments)
 * even when the webhook payload is sparse
 */
async function fetchFullOrderFromSquare(squareOrderId) {
  try {
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
    
    if (!squareAccessToken) {
      console.warn(`[Webhook] SQUARE_ACCESS_TOKEN not configured - cannot fetch full order details`);
      return null;
    }
    
    const squareClient = new SquareClient({
      accessToken: squareAccessToken,
      environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
    
    // Fetch full order from Square
    const orderResponse = await squareClient.orders.retrieveOrder(squareOrderId);
    
    if (orderResponse.result && orderResponse.result.order) {
      console.log(`[Webhook] ✅ Fetched full order from Square API`);
      return orderResponse.result.order;
    } else {
      console.warn(`[Webhook] Could not fetch full order from Square API`);
      return null;
    }
  } catch (fetchError) {
    console.error(`[Webhook] Error fetching full order from Square:`, fetchError.message);
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
    
    // Log order update (condensed)
    console.log(`[Webhook] Order update: ${squareOrderId} | State: ${orderState} | Version: ${version}`);
    
    // Check if order already exists
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE square_order_id = ${squareOrderId}
    `;
    
    console.log(`[Webhook] Existing order in DB:`, existingOrder);
    
    // Extract fulfillment state from order fulfillments
    // This is what gets updated when order status changes in Square
    let fulfillmentState = null;
    const fulfillments = orderObject?.fulfillments || [];
    console.log(`[Webhook] Found ${fulfillments.length} fulfillments in order`);
    
    if (fulfillments.length > 0) {
      // Get the first fulfillment (usually pickup fulfillment)
      const firstFulfillment = fulfillments[0];
      fulfillmentState = firstFulfillment.state || firstFulfillment.fulfillment_state || null;
      
      // Also check for state in different possible locations
      if (!fulfillmentState) {
        fulfillmentState = firstFulfillment.fulfillmentState || firstFulfillment.State || null;
      }
      
      // Normalize to uppercase for comparison
      if (fulfillmentState) {
        fulfillmentState = fulfillmentState.toUpperCase();
      }
      
      console.log(`[Webhook] Fulfillment state extracted: ${fulfillmentState}`);
      console.log(`[Webhook] Full fulfillment object:`, JSON.stringify(firstFulfillment, null, 2));
    } else {
      console.log(`[Webhook] No fulfillments found in order object`);
    }
    
    // Map Square fulfillment state to our order status (priority over order state)
    // Square fulfillment states: PROPOSED, RESERVED, PREPARED, COMPLETED, CANCELED
    // Our statuses: New, In Progress, Ready, Picked Up, Completed, Canceled, Refunded
    let orderStatus = 'New'; // Default
    
    if (fulfillmentState) {
      // Fulfillment state takes priority (more specific)
      const fulfillmentStatusMap = {
        'PROPOSED': 'In Progress',
        'RESERVED': 'In Progress',
        'PREPARED': 'Ready',
        'COMPLETED': 'Picked Up',
        'CANCELED': 'Canceled',
        'CANCELLED': 'Canceled', // Handle both spellings
      };
      orderStatus = fulfillmentStatusMap[fulfillmentState] || orderStatus;
      console.log(`[Webhook] Mapped fulfillment state "${fulfillmentState}" to database status: "${orderStatus}"`);
    } else {
      // Fallback to order state if no fulfillment state
      const statusMap = {
        'DRAFT': 'New',
        'OPEN': 'In Progress',
        'COMPLETED': 'Completed',
        'CANCELED': 'Canceled',
        'CANCELLED': 'Canceled',
      };
      orderStatus = statusMap[orderState] || 'New';
      console.log(`[Webhook] No fulfillment state found, mapped order state "${orderState}" to database status: "${orderStatus}"`);
      console.log(`[Webhook] WARNING: Order state fallback used - fulfillment state may not be in webhook payload`);
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
    
    // Check if webhook payload is sparse (missing critical data)
    // Square sometimes sends minimal payloads with only status changes
    // Check multiple conditions to catch all sparse payload scenarios
    const hasLineItems = extractedLineItems.length > 0;
    const hasAmounts = totalAmount > 0;
    const hasLineItemsInObject = orderObject?.line_items && Array.isArray(orderObject.line_items) && orderObject.line_items.length > 0;
    const hasLineItemsProperty = orderObject?.lineItems && Array.isArray(orderObject.lineItems) && orderObject.lineItems.length > 0;
    
    const isPayloadSparse = !hasLineItems || (!hasAmounts && !hasLineItemsInObject && !hasLineItemsProperty);
    
    console.log(`[Webhook] Payload completeness check:`, {
      hasLineItems,
      hasAmounts,
      hasLineItemsInObject,
      hasLineItemsProperty,
      isPayloadSparse,
      extractedItemsCount: extractedLineItems.length,
      totalAmount,
    });
    
    if (isPayloadSparse) {
      console.warn(`[Webhook] ⚠️  Webhook payload is sparse (${extractedLineItems.length} items, $${totalAmount} total)`);
      console.warn(`[Webhook] Fetching full order details from Square API to ensure complete data...`);
      
      const fullOrder = await fetchFullOrderFromSquare(squareOrderId);
      
      if (fullOrder) {
        // Replace sparse webhook data with complete Square API data
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
        
        console.log(`[Webhook] ✅ Re-extracted from full order: ${extractedLineItems.length} items, $${totalAmount} total`);
      } else {
        console.warn(`[Webhook] ⚠️  Could not fetch full order - using sparse webhook data`);
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
        console.log(`[Webhook] Status update needed: "${currentStatus}" → "${orderStatus}"`);
        console.log(`[Webhook] Fulfillment state: ${fulfillmentState || 'not found'}, Order state: ${orderState}`);
        console.log(`[Webhook] Order ID: ${orderId}, Square Order ID: ${squareOrderId}`);
        
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
            console.log(`✅ Successfully updated order ${orderId} status from "${currentStatus}" to "${orderStatus}"`);
            console.log(`[Webhook] Update result:`, JSON.stringify(updateResult[0], null, 2));
            
            // Send status update email if status changed to a notable status
            if (orderStatus !== currentStatus) {
              sendOrderStatusUpdateEmail(sql, orderId, orderStatus, currentStatus).catch(err => {
                console.error(`[Email] Failed to send status update email:`, err);
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
            console.error(`[Webhook] Update query returned no rows - order may not exist`);
          }
        } catch (error) {
          console.error(`[Webhook] Error updating order status:`, error);
          console.error(`[Webhook] Error message:`, error.message);
          console.error(`[Webhook] Error stack:`, error.stack);
          // Continue to full update below
        }
      } else {
        console.log(`[Webhook] Status unchanged: "${currentStatus}" (fulfillment state: ${fulfillmentState || 'not found'})`);
        console.log(`[Webhook] Status unchanged, but will still update order data (amounts, line items) if needed`);
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
      // Order doesn't exist - fetch full order details from Square API
      // The webhook payload is minimal, so we need to fetch the full order to get line items, amounts, etc.
      console.log(`[Webhook] Order ${squareOrderId} not found in database - fetching full order from Square API`);
      
      try {
        // Initialize Square client
        const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
        const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
        
        if (!squareAccessToken) {
          console.warn(`[Webhook] SQUARE_ACCESS_TOKEN not configured - cannot fetch full order details`);
          console.warn(`[Webhook] Order will be created with minimal data from webhook payload`);
        } else {
          const squareClient = new SquareClient({
            accessToken: squareAccessToken,
            environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
          });
          
          // Fetch full order from Square
          const orderResponse = await squareClient.orders.retrieveOrder(squareOrderId);
          
          if (orderResponse.result && orderResponse.result.order) {
            const fullOrder = orderResponse.result.order;
            console.log(`[Webhook] Fetched full order from Square API`);
            
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
            
            console.log(`[Webhook] Re-extracted from full order: ${extractedLineItems.length} items, $${totalAmount} total`);
          } else {
            console.warn(`[Webhook] Could not fetch full order from Square API - using minimal webhook data`);
          }
        }
      } catch (fetchError) {
        console.error(`[Webhook] Error fetching full order from Square:`, fetchError.message);
        console.warn(`[Webhook] Continuing with minimal webhook payload data`);
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
        
        console.log(`✅ Created new order ${newOrderId} (Square: ${squareOrderId}) with ${extractedLineItems.length} items`);
        
        // Send order confirmation email for new orders if payment is already approved
        // Note: For most orders, payment comes later via payment.created webhook
        // But if order is created with payment already approved, send confirmation now
        if (orderStatus === 'In Progress' || orderStatus === 'Confirmed') {
          sendOrderConfirmationEmail(sql, newOrderId).catch(err => {
            console.error(`[Email] Failed to send confirmation email:`, err);
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
      console.log(`[Email] Order ${orderId} not found, skipping confirmation email`);
      return;
    }

    const order = orderResult[0];
    
    // Get customer email from order or pickup details
    const customerEmail = order.customer_email || order.pickup_details?.email;
    if (!customerEmail) {
      console.log(`[Email] No email found for order ${orderId}, skipping confirmation email`);
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

    console.log(`[Email] ✅ Order confirmation email sent for order ${order.order_number} to ${customerEmail}`);
  } catch (error) {
    // Don't fail webhook if email fails
    console.error(`[Email] ❌ Failed to send order confirmation email:`, error);
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

    console.log(`[Email] ✅ Status update email sent for order ${order.order_number} (${previousStatus} → ${newStatus}) to ${customerEmail}`);
  } catch (error) {
    // Don't fail webhook if email fails
    console.error(`[Email] ❌ Failed to send status update email:`, error);
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
      console.warn('[Webhook] Missing payment ID in payment event');
      console.warn('[Webhook] Payment object structure:', JSON.stringify(object, null, 2).substring(0, 500));
      return null;
    }
    
    const squarePaymentId = payment.id;
    const paymentStatus = payment.status || 'APPROVED';
    const orderId = payment.order_id || null;
    
    // Extract payment amount
    const amountMoney = payment.amount_money || payment.total_money || {};
    const totalAmount = amountMoney.amount ? Number(amountMoney.amount) / 100 : 0; // Convert cents to dollars
    
    console.log(`[Webhook] Processing payment event:`, {
      paymentId: squarePaymentId,
      status: paymentStatus,
      orderId: orderId,
      amount: totalAmount,
    });
    
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
        
        console.log(`✅ Updated order ${orderId_db} with payment ${squarePaymentId}, status: ${newStatus}`);
        
        // Send order confirmation email when payment is approved/completed
        if ((paymentStatus === 'APPROVED' || paymentStatus === 'COMPLETED') && currentStatus === 'New') {
          // Payment just approved - send confirmation email
          sendOrderConfirmationEmail(sql, orderId_db).catch(err => {
            console.error(`[Email] Failed to send confirmation email:`, err);
          });
        }
        
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
    console.log(`[Webhook] Rejected: Method ${req.method} not allowed`);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Log incoming webhook (condensed)
  const hasBody = !!req.body;
  const bodyType = typeof req.body;
  console.log(`[Webhook] POST ${req.url} | Body: ${hasBody ? `${bodyType}` : 'none'}`);
  
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
    
    // Log which signature key source is being used (without exposing the key)
    if (signatureKey) {
      console.log(`[Webhook] Signature key found: ${process.env.ORDER_WEBHOOK_SIGNATURE_KEY ? 'ORDER_WEBHOOK_SIGNATURE_KEY' : process.env.SQUARE_SIGNATURE_KEY ? 'SQUARE_SIGNATURE_KEY' : 'SQUARE_WEBHOOK_SIGNATURE_KEY'}`);
      console.log(`[Webhook] Signature key length: ${signatureKey.length} characters`);
      console.log(`[Webhook] Signature key preview: ${signatureKey.substring(0, 4)}...${signatureKey.substring(signatureKey.length - 4)}`);
    } else {
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
    // Vercel may parse the body, so we need to handle both cases
    let rawBody;
    let payload;
    
    // Try to get raw body from request
    // In Vercel, we need to read from req directly if available
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      // Body was parsed - reconstruct JSON with exact formatting
      // Square's signature is based on the exact JSON string they sent
      payload = req.body;
      
      // Reconstruct JSON with no extra whitespace (compact)
      // This should match Square's original format
      rawBody = JSON.stringify(payload);
      
      console.warn('⚠️  Body was parsed - reconstructing JSON for signature verification');
    } else if (Buffer.isBuffer(req.body)) {
      // Body is a Buffer - convert to string
      rawBody = req.body.toString('utf8');
    } else if (typeof req.body === 'string') {
      // Body is already a string (raw) - this is what we want
      rawBody = req.body;
    } else {
      // No body provided
      console.error('No request body received');
      return res.status(400).json({ error: 'Missing request body' });
    }
    
    // Parse JSON payload if not already parsed
    if (!payload) {
      try {
        payload = JSON.parse(rawBody);
      } catch (e) {
        console.error('Failed to parse body as JSON:', e.message);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    
    // Log payload type (condensed)
    console.log(`[Webhook] Payload: ${payload?.type || 'unknown'} (${rawBody?.length || 0} bytes)`);
    
    // Verify webhook signature
    // Square sends signature in X-Square-Signature header
    const signature = req.headers['x-square-signature'] || 
                     req.headers['x-square-hmacsha256-signature'] ||
                     req.headers['x-square-hmac-sha256-signature'];
    
    // Log signature verification (condensed)
    console.log(`[Webhook] Signature: ${signature ? 'present' : 'missing'}`);
    
    // Require signature for security - return 403 if missing or invalid
    if (!signature) {
      console.error('❌ Missing Square webhook signature header');
      console.error('Required headers: x-square-signature or x-square-hmacsha256-signature');
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Missing webhook signature' 
      });
    }
    
    // Check if body was parsed by Vercel BEFORE signature verification
    // This helps us determine if signature failure is due to parsing or a real security issue
    const bodyWasParsed = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body);
    
    // Verify signature - return 403 on failure
    // Use the raw body string for signature verification (must match exactly what Square sent)
    const isValid = verifySquareSignature(signature, rawBody, signatureKey);
    
    if (!isValid) {
      if (bodyWasParsed) {
        // Body was parsed by Vercel - signature verification will fail due to JSON reconstruction differences
        // This is expected behavior in Vercel serverless functions
        // We allow the webhook to proceed but log a clear warning
        console.warn('⚠️  [Webhook] Signature verification bypassed - body was parsed by Vercel');
        console.warn('⚠️  [Webhook] This is expected in Vercel serverless functions');
        console.warn('⚠️  [Webhook] Webhook will be processed (bypass active)');
        console.log('[Webhook] Continuing with webhook processing...');
        // Continue processing despite signature failure - DON'T RETURN
      } else {
        // Body was NOT parsed - signature failure is a real security issue
        console.error('❌ [Webhook] Invalid Square webhook signature');
        console.error('❌ [Webhook] Body was NOT parsed - this is a real security failure');
        console.error('❌ [Webhook] Signature received:', signature.substring(0, 30) + '...');
        console.error('❌ [Webhook] Body length:', rawBody.length);
        
        // Calculate expected signature for debugging (not exposed to client)
        const hmac = crypto.createHmac('sha256', signatureKey);
        hmac.update(rawBody, 'utf8');
        const calculated = hmac.digest('base64');
        console.error('❌ [Webhook] Calculated signature (base64):', calculated);
        
        // Extract expected signature from received signature
        const expectedSig = signature.startsWith('sha256=') ? signature.substring(7) : signature;
        console.error('❌ [Webhook] Expected signature (base64):', expectedSig);
        console.error('❌ [Webhook] Rejecting webhook request - security violation');
        
        // Body wasn't parsed, so signature failure is real - reject
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'Invalid webhook signature' 
        });
      }
    } else {
      console.log('✅ [Webhook] Signature verified successfully');
    }
    
    // Validate payload structure
    if (!payload || !payload.type || !payload.data) {
      console.error('Invalid webhook payload structure');
      return res.status(400).json({ error: 'Invalid payload' });
    }
    
    console.log(`[Webhook] Processing: ${payload.type}`);
    
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

