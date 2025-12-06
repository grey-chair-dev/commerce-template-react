/**
 * Checkout Create Endpoint
 * Receives checkout payload from client and processes order creation
 * Creates order in Square Orders API and Neon database
 * Returns Square order details and return URLs
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://commerce-template-react.vercel.app',
  ];
  
  if (origin && allowedOrigins.some(allowed => origin.includes(allowed.split('://')[1]))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed',
      message: `This endpoint only accepts POST requests. Received: ${req.method}`,
    });
  }

  try {
    // Get Square credentials
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase();
    const squareLocationId = process.env.SQUARE_LOCATION_ID;

    if (!squareAccessToken || !squareLocationId) {
      console.error('❌ Square credentials not configured');
      return res.status(500).json({
        error: 'Square not configured',
        message: 'Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in Vercel environment variables',
      });
    }

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

    // Get base URL for return URLs
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL || 
        (req.headers.host ? `https://${req.headers.host}` : 'http://localhost:5173');

    // Parse request body
    const payload = req.body;

    // Validate payload structure
    if (!payload || !payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Payload must include items array with at least one item',
      });
    }

    if (!payload.shipping_details || !payload.shipping_details.address) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Payload must include shipping_details with address',
      });
    }

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // Initialize Square client
    const squareClient = new SquareClient({
      token: squareAccessToken,
      environment: squareEnvironment === 'production' 
        ? SquareEnvironment.Production 
        : SquareEnvironment.Sandbox,
    });

    // Generate globally unique idempotency key to prevent duplicate orders
    // Format: timestamp-uuid to ensure uniqueness across retries
    const idempotencyKey = `${Date.now()}-${randomUUID()}`;
    
    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Fetch product details from database to get Square variation IDs
    // The SKU in the payload is the product.id (which is square_variation_id)
    const skus = payload.items.map(item => item.sku);
    const productDetails = await sql`
      SELECT id, name, price 
      FROM products 
      WHERE id = ANY(${skus})
    `;

    // Create a map of SKU to product details
    const productMap = new Map();
    productDetails.forEach(product => {
      productMap.set(product.id, product);
    });

    // Build Square order line items
    // Note: SKU in payload is the square_variation_id (product.id)
    const lineItems = payload.items.map(item => {
      const product = productMap.get(item.sku);
      if (!product) {
        throw new Error(`Product not found for SKU: ${item.sku}`);
      }

      // Convert price to cents (Square uses cents)
      const priceInCents = Math.round(parseFloat(product.price || 0) * 100);

      return {
        quantity: item.quantity.toString(),
        catalogObjectId: item.sku, // This is the Square variation ID
        catalogVersion: undefined, // Use latest version
        // Alternative: Use base_price_money if catalog_object_id doesn't work
        // basePriceMoney: {
        //   amount: priceInCents,
        //   currency: 'USD',
        // },
      };
    });

    // Create order in database first to get orderId for return URLs
    const orderResult = await sql`
      INSERT INTO orders (
        id,
        order_number,
        customer_id,
        status,
        subtotal,
        shipping,
        tax,
        total,
        shipping_method,
        shipping_address,
        square_order_id,
        created_at,
        updated_at
      ) VALUES (
        ${orderNumber},
        ${orderNumber},
        ${payload.customer_id || null},
        'pending',
        ${payload.totals.subtotal},
        ${payload.totals.shipping},
        ${payload.totals.tax},
        ${payload.totals.total},
        ${payload.shipping_details.deliveryMethod},
        ${JSON.stringify(payload.shipping_details.address)},
        null,
        NOW(),
        NOW()
      )
      RETURNING id, order_number, status, total, square_order_id
    `;

    if (!orderResult || orderResult.length === 0) {
      throw new Error('Failed to create order in database');
    }

    const order = orderResult[0];
    const orderId = order.id;

    // Create Square order using Orders API
    const ordersApi = squareClient.ordersApi;
    const squareOrderRequest = {
      idempotencyKey: idempotencyKey,
      order: {
        locationId: squareLocationId,
        lineItems: lineItems,
        // Add pricing information
        pricingOptions: {
          autoApplyDiscounts: false,
          autoApplyTaxes: true,
        },
        // Add reference ID for tracking
        referenceId: orderNumber,
        // Add customer information if available
        ...(payload.customer_id && {
          metadata: {
            customer_id: payload.customer_id,
          },
        }),
      },
    };

    console.log('[Checkout] Creating Square order:', {
      idempotencyKey,
      locationId: squareLocationId,
      lineItemsCount: lineItems.length,
      orderNumber,
    });

    let squareOrder;
    try {
      const squareResponse = await ordersApi.createOrder(squareOrderRequest);
      
      if (squareResponse.result.errors && squareResponse.result.errors.length > 0) {
        const errors = squareResponse.result.errors.map(e => e.detail || e.code).join(', ');
        throw new Error(`Square API errors: ${errors}`);
      }

      squareOrder = squareResponse.result.order;
      console.log('[Checkout] Square order created:', {
        squareOrderId: squareOrder?.id,
        version: squareOrder?.version,
      });

      // Update database order with Square order ID
      await sql`
        UPDATE orders 
        SET square_order_id = ${squareOrder.id}, status = 'confirmed'
        WHERE id = ${orderId}
      `;
    } catch (squareError) {
      console.error('[Checkout] Square order creation failed:', squareError);
      // Continue with database order creation even if Square fails
      // This allows for manual reconciliation
      console.warn('[Checkout] Continuing with database order creation despite Square error');
    }

    // Create Square Checkout if order was created successfully
    let checkoutPageUrl = null;
    if (squareOrder && squareOrder.id) {
      try {
        // Define return URLs for Square redirect
        // Success URL includes the Neon database order ID as query parameter
        const returnUrlSuccess = `${baseUrl}/order-confirmation?id=${orderId}`;
        // Cancel URL redirects back to cart
        const returnUrlCancel = `${baseUrl}/cart`;

        // Generate unique idempotency key for checkout
        const checkoutIdempotencyKey = `${idempotencyKey}-checkout`;

        // Use Checkout API to create payment link
        // Square Checkout API - CreateCheckout endpoint
        const checkoutApi = squareClient.checkoutApi;

        const checkoutRequest = {
          idempotencyKey: checkoutIdempotencyKey,
          checkout: {
            orderId: squareOrder.id, // Reference the Square Order ID from previous step
            askForShippingAddress: payload.shipping_details.deliveryMethod === 'delivery',
            redirectUrl: returnUrlSuccess,
            merchantSupportEmail: payload.shipping_details.address.email,
            prePopulateBuyerEmail: payload.shipping_details.address.email,
            prePopulateShippingAddress: payload.shipping_details.deliveryMethod === 'delivery' ? {
              addressLine1: payload.shipping_details.address.street,
              city: payload.shipping_details.address.city,
              state: payload.shipping_details.address.state,
              postalCode: payload.shipping_details.address.zipCode,
              country: payload.shipping_details.address.country || 'US',
            } : undefined,
          },
        };

        console.log('[Checkout] Creating Square checkout:', {
          orderId: squareOrder.id,
          returnUrlSuccess,
          returnUrlCancel,
        });

        const checkoutResponse = await checkoutApi.createCheckout(checkoutRequest);

        if (checkoutResponse.result.errors && checkoutResponse.result.errors.length > 0) {
          const errors = checkoutResponse.result.errors.map(e => e.detail || e.code).join(', ');
          throw new Error(`Square Checkout API errors: ${errors}`);
        }

        const checkout = checkoutResponse.result.checkout;
        // Extract checkout page URL - may be in different fields depending on API version
        checkoutPageUrl = checkout?.checkoutPageUrl || checkout?.url || checkout?.paymentLink?.url;

        console.log('[Checkout] Square checkout created:', {
          checkoutId: checkout?.id,
          checkoutPageUrl,
        });

      } catch (checkoutError) {
        console.error('[Checkout] Square checkout creation failed:', checkoutError);
        // Continue without checkout URL - order is still created
        // Client can handle payment through alternative means
        console.warn('[Checkout] Continuing without checkout URL');
      }
    }

    // Create order items
    for (const item of payload.items) {
      // Get product price from database
      const productResult = await sql`
        SELECT price FROM products WHERE id = ${item.sku}
      `;

      if (productResult && productResult.length > 0) {
        const productPrice = parseFloat(productResult[0].price || 0);
        const itemSubtotal = productPrice * item.quantity;

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
            ${item.sku},
            ${item.quantity},
            ${productPrice},
            ${itemSubtotal},
            NOW()
          )
        `;
      }
    }

    // Define return URLs for Square redirect (if not already defined in checkout creation)
    // Success URL includes the Neon database order ID as query parameter
    const returnUrlSuccess = `${baseUrl}/order-confirmation?id=${orderId}`;
    // Cancel URL redirects back to cart
    const returnUrlCancel = `${baseUrl}/cart`;

    // Prepare response with order details, return URLs, and checkout page URL
    const response = {
      success: true,
      order: {
        id: orderId,
        order_number: order.order_number,
        status: order.status,
        total: parseFloat(order.total),
        square_order_id: order.square_order_id || squareOrder?.id || null,
      },
      square_order: squareOrder ? {
        id: squareOrder.id,
        version: squareOrder.version,
        state: squareOrder.state,
        total_money: squareOrder.totalMoney,
      } : null,
      idempotency_key: idempotencyKey,
      checkout_page_url: checkoutPageUrl, // Square checkout page URL for payment
      return_urls: {
        success: returnUrlSuccess,
        cancel: returnUrlCancel,
      },
      // Include payload for Square API integration
      checkout_data: {
        ...payload,
        return_url_success: returnUrlSuccess,
        return_url_cancel: returnUrlCancel,
      },
    };

    console.log('[Checkout] Order created:', {
      orderId,
      orderNumber: order.order_number,
      total: order.total,
      squareOrderId: squareOrder?.id || order.square_order_id,
      checkoutPageUrl,
      idempotencyKey,
    });

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(response);

  } catch (error) {
    console.error('[Checkout] Error creating order:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to create order',
    });
  }
}

