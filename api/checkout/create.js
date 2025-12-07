/**
 * Checkout Create Endpoint
 * 
 * Simplified Square-hosted Checkout Flow:
 * 1. Create Square Order (Orders API)
 * 2. Create Square Checkout (Checkout API) - automatically includes Apple Pay, Google Pay
 * 3. Return checkout_page_url for immediate redirect
 * 
 * This endpoint handles POST requests containing:
 * - items: Array of { sku, quantity }
 * - shipping_details: Address and delivery method
 * - totals: Subtotal, shipping, tax, total
 * - customer_id: Optional authenticated user ID
 * 
 * Returns: { url: checkout_page_url, square_order_id: "..." }
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '../middleware/auth.js';

export default async function handler(req, res) {
  // Set CORS headers - must be set before any response
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://commerce-template-react.vercel.app',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);
  
  // Check if origin is allowed (exact match or localhost variations)
  const isAllowedOrigin = origin && (
    allowedOrigins.includes(origin) ||
    (origin.startsWith('http://localhost:') && origin.includes('localhost')) ||
    (origin.startsWith('https://localhost:') && origin.includes('localhost'))
  );
  
  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // For development, allow localhost origins
    if (origin.includes('localhost')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // Required for cookies
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // Handle preflight OPTIONS request - must return early before any async operations
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
    // Trim whitespace to handle any trailing newlines or spaces
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
    const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();

    if (!squareAccessToken || !squareLocationId) {
      console.error('❌ Square credentials not configured');
      return res.status(500).json({
        error: 'Square not configured',
        message: 'Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in Vercel environment variables',
      });
    }

    // Log token info for debugging (first/last few chars only for security)
    console.log('[Checkout] Square credentials loaded:', {
      hasToken: !!squareAccessToken,
      tokenLength: squareAccessToken?.length,
      tokenPreview: squareAccessToken ? `${squareAccessToken.substring(0, 12)}...${squareAccessToken.substring(squareAccessToken.length - 8)}` : 'missing',
      environment: squareEnvironment,
      locationId: squareLocationId,
    });

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
    // CRITICAL FIX: Always use HTTP for localhost to prevent Error -107
    const baseUrl = (() => {
      // Check environment variables first
      if (process.env.VERCEL_URL) {
        console.log('[Checkout] Using VERCEL_URL:', process.env.VERCEL_URL);
        return `https://${process.env.VERCEL_URL}`;
      }
      
      if (process.env.NEXT_PUBLIC_SITE_URL) {
        console.log('[Checkout] Using NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
        // If it's localhost, force HTTP
        if (process.env.NEXT_PUBLIC_SITE_URL.includes('localhost')) {
          return process.env.NEXT_PUBLIC_SITE_URL.replace('https://', 'http://');
        }
        return process.env.NEXT_PUBLIC_SITE_URL;
      }
      
      // For local development, ALWAYS use HTTP (same port as request)
      const host = req.headers.host || 'localhost:3000';
      console.log('[Checkout] Detected host:', host);
      
      // If host contains localhost or 127.0.0.1, force HTTP (keep same port)
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        // Extract port from host (e.g., "localhost:3000" -> "3000")
        const port = host.includes(':') ? host.split(':')[1] : '3000';
        const httpUrl = `http://localhost:${port}`;
        console.log('[Checkout] Localhost detected - forcing HTTP:', httpUrl);
        return httpUrl;
      }
      
      // Production: use HTTPS
      return `https://${host}`;
    })();
    
    console.log('[Checkout] Final baseUrl:', baseUrl);

    // Phase 2.4: Authenticate request using middleware (optional for guest checkout)
    // Note: Authentication is optional - we support both authenticated and guest checkout
    let authenticatedCustomerId = null;
    let authenticatedEmail = null;
    
    // Call middleware with required=false to allow guest checkout
    // Wrap in try-catch to handle errors gracefully
    try {
      const authResult = await authenticateRequest(req, res, false);
      if (authResult.success) {
        // User is authenticated - use their customer_id
        authenticatedCustomerId = authResult.customerId;
        authenticatedEmail = authResult.email;
        console.log('[Checkout] Authenticated user:', {
          customerId: authenticatedCustomerId,
          email: authenticatedEmail,
        });
      } else {
        // User is not authenticated - guest checkout
        // Don't return error, just proceed with guest checkout
        console.log('[Checkout] Guest checkout (no authentication)');
      }
    } catch (authError) {
      // If authentication fails, continue as guest checkout
      console.log('[Checkout] Authentication error, continuing as guest:', authError.message);
      authenticatedCustomerId = null;
      authenticatedEmail = null;
    }

    // Parse request body
    const payload = req.body;

    // Validate payload structure
    if (!payload || !payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Payload must include items array with at least one item',
      });
    }

    // Validate customer_details (required for pickup orders)
    if (!payload.customer_details || !payload.customer_details.email || !payload.customer_details.firstName) {
      return res.status(400).json({
        error: 'Invalid payload',
        message: 'Payload must include customer_details with email and firstName',
      });
    }

    // Note: shipping_details is not required for pickup-only orders
    // Pickup orders only need customer_details (name, email, phone)

    // Initialize Neon client
    const sql = neon(databaseUrl);

    // Initialize Square client
    // Note: Square SDK v43 uses 'token' parameter (not 'accessToken')
    const squareClient = new SquareClient({
      token: squareAccessToken,
      environment: squareEnvironment === 'production' 
        ? SquareEnvironment.Production 
        : SquareEnvironment.Sandbox,
    });

    // Verify API access (Square SDK v43 uses lowercase property names)
    if (!squareClient.orders) {
      console.error('[Checkout] Square client does not have orders API');
      return res.status(500).json({
        error: 'Square SDK configuration error',
        message: 'Orders API not available on Square client',
      });
    }

    // Test authentication with a simple API call before proceeding
    try {
      const locationsApi = squareClient.locations;
      // Square SDK v43 uses 'list' method, not 'listLocations'
      const testResponse = await locationsApi.list();
      console.log('[Checkout] Square authentication test passed');
    } catch (authError) {
      console.error('[Checkout] Square authentication test failed:', {
        statusCode: authError.statusCode,
        message: authError.message,
        errors: authError.errors,
      });
      return res.status(500).json({
        error: 'Square authentication failed',
        message: 'Invalid or expired Square access token. Please check SQUARE_ACCESS_TOKEN in Vercel environment variables.',
        details: authError.errors?.[0]?.detail || 'Authentication error',
      });
    }

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

    // Build Square order line items from payload
    // Payload contains: { sku, quantity } for each item
    // SKU is the product.id (which is square_variation_id in our database)
    const lineItems = payload.items.map(item => {
      const product = productMap.get(item.sku);
      if (!product) {
        throw new Error(`Product not found for SKU: ${item.sku}`);
      }

      return {
        quantity: item.quantity.toString(),
        catalogObjectId: item.sku, // Square catalog variation ID
        catalogVersion: undefined, // Use latest catalog version
      };
    });

    // Create order in database first to get orderId for return URLs
    // For pickup orders: shipping_address is NULL, pickup_details contains customer info
    // Use authenticated customer_id if available, otherwise fall back to payload (for backward compatibility)
    const customerIdForOrder = authenticatedCustomerId || payload.customer_id || null;
    
    // Generate UUID for order ID (Task 3.7: ID-based retrieval)
    const orderId = randomUUID();
    
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
        pickup_details,
        square_order_id,
        created_at,
        updated_at
      ) VALUES (
        ${orderId},
        ${orderNumber},
        ${customerIdForOrder},
        'pending',
        ${payload.totals.subtotal},
        0, -- Shipping is always 0 for pickup
        ${payload.totals.tax},
        ${payload.totals.total},
        'pickup',
        NULL, -- No shipping address for pickup
        ${JSON.stringify(payload.customer_details)}, -- Store pickup customer details
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
    // orderId was already generated above as UUID
    // orderNumber was already declared above, just use order.order_number when needed

    // Update customer information if authenticated and details are provided
    // This saves phone number, first name, and last name to the customer's account for future checkouts
    if (authenticatedCustomerId) {
      try {
        const phone = payload.customer_details.phone?.trim() || null;
        const firstName = payload.customer_details.firstName?.trim() || null;
        const lastName = payload.customer_details.lastName?.trim() || null;
        
        // Update customer record with provided information
        // Use COALESCE to only update fields that have values, keeping existing values otherwise
        await sql`
          UPDATE customers
          SET 
            phone = COALESCE(${phone}, phone),
            first_name = COALESCE(${firstName}, first_name),
            last_name = COALESCE(${lastName}, last_name),
            updated_at = NOW()
          WHERE id = ${authenticatedCustomerId}
        `;
        
        console.log('[Checkout] Saved customer information to account:', {
          customerId: authenticatedCustomerId,
          phone: phone ? 'updated' : 'unchanged',
          firstName: firstName ? 'updated' : 'unchanged',
          lastName: lastName ? 'updated' : 'unchanged',
        });
      } catch (updateError) {
        // Log error but don't fail checkout if customer update fails
        console.error('[Checkout] Failed to update customer information:', updateError);
      }
    }

    // ============================================
    // STEP 1: Create Square Order (Orders API)
    // ============================================
    // This formalizes the order in Square's system
    // Returns square_order_id which is required for Step 2
    // Note: Square SDK v43 uses lowercase property names (orders, not ordersApi)
    // Similar to how catalog and inventory are accessed: squareClient.catalog, squareClient.inventory
    const ordersApi = squareClient.orders;
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
        // Add fulfillments block for PICKUP order
        // Square requires fulfillments to specify this is a pickup order
        fulfillments: [
          {
            type: 'PICKUP',
            pickupDetails: {
              recipient: {
                displayName: `${payload.customer_details.firstName} ${payload.customer_details.lastName}`,
                emailAddress: payload.customer_details.email,
                phoneNumber: payload.customer_details.phone || undefined,
              },
              scheduleType: 'ASAP', // Pickup as soon as possible
              // Note: pickupAt is optional - Square will use the order's locationId
            },
          },
        ],
        // Add customer information for order reconciliation
        // Include authenticated customer_id in metadata/note for Square order tracking
        metadata: {
          ...(authenticatedCustomerId && {
            customer_id: authenticatedCustomerId,
            authenticated: 'true',
          }),
          ...(authenticatedEmail && {
            customer_email: authenticatedEmail,
          }),
          order_source: authenticatedCustomerId ? 'authenticated' : 'guest',
        },
        // Add note field for additional customer tracking (Square supports this)
        note: authenticatedCustomerId 
          ? `Customer ID: ${authenticatedCustomerId} | Order: ${orderNumber}`
          : `Guest Order: ${orderNumber}`,
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
      // Square SDK v43 uses 'create' method, not 'createOrder'
      const squareResponse = await ordersApi.create(squareOrderRequest);
      
      // Log response structure for debugging (handle BigInt values)
      const safeStringify = (obj) => {
        return JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        , 2);
      };
      
      // Handle different response structures from Square SDK
      // Based on actual API response, it can be:
      // 1. { result: { order: {...}, errors: [...] } } - standard SDK structure
      // 2. The order object directly (what we're seeing)
      
      let orderData = null;
      let errors = null;
      
      if (squareResponse?.result) {
        // Standard SDK structure: { result: { order: {...}, errors: [...] } }
        if (squareResponse.result.errors && squareResponse.result.errors.length > 0) {
          errors = squareResponse.result.errors;
        }
        orderData = squareResponse.result.order;
      } else if (squareResponse?.order && squareResponse.order.id) {
        // Response has order property: { order: {...} }
        orderData = squareResponse.order;
        if (squareResponse.errors) {
          errors = squareResponse.errors;
        }
      } else if (squareResponse?.id && squareResponse?.location_id) {
        // The response IS the order object itself (what you showed me)
        orderData = squareResponse;
      } else {
        // Check for errors at top level
        if (squareResponse?.errors && Array.isArray(squareResponse.errors)) {
          errors = squareResponse.errors;
        }
        
        console.error('[Checkout] Unexpected Square API response structure:', {
          responseKeys: squareResponse && typeof squareResponse === 'object' ? Object.keys(squareResponse) : 'not an object',
          hasId: !!squareResponse?.id,
          hasOrder: !!squareResponse?.order,
          hasResult: !!squareResponse?.result,
          responsePreview: safeStringify(squareResponse).substring(0, 500),
        });
        throw new Error('Invalid response from Square Orders API - unexpected structure');
      }
      
      // Check for errors
      if (errors && errors.length > 0) {
        const errorMessages = errors.map(e => e.detail || e.code || e.message).join(', ');
        throw new Error(`Square API errors: ${errorMessages}`);
      }
      
      // Validate order data
      if (!orderData || !orderData.id) {
        console.error('[Checkout] Square API response missing order data:', {
          hasOrderData: !!orderData,
          orderDataKeys: orderData ? Object.keys(orderData) : [],
        });
        throw new Error('Invalid response from Square Orders API - missing order data');
      }

      squareOrder = orderData;
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

    // ============================================
    // STEP 2: Create Square Checkout (Checkout API)
    // ============================================
    // This generates the hosted checkout page URL
    // The page automatically includes Apple Pay, Google Pay, and other digital wallets
    // No additional configuration needed for digital wallet support
    let checkoutPageUrl = null;
    
    // Verify squareOrder has an ID before proceeding
    if (!squareOrder || !squareOrder.id) {
      console.error('[Checkout] Cannot create payment link - missing Square order ID:', {
        hasSquareOrder: !!squareOrder,
        squareOrderId: squareOrder?.id,
        squareOrderKeys: squareOrder ? Object.keys(squareOrder) : [],
      });
    }
    
    if (squareOrder && squareOrder.id) {
      try {
        // Define return URLs for Square redirect
        // Success URL uses orderId (UUID) for secure, ID-based retrieval (Task 3.7)
        // CRITICAL: Force HTTP for localhost to prevent Error -107
        let returnUrlSuccess = `${baseUrl}/order-confirmation?id=${orderId}`;
        // Safety check: Ensure HTTP for localhost (even if baseUrl somehow has HTTPS)
        if (returnUrlSuccess.includes('localhost') || returnUrlSuccess.includes('127.0.0.1')) {
          returnUrlSuccess = returnUrlSuccess.replace('https://', 'http://');
        }
        
        // Cancel URL redirects back to cart
        let returnUrlCancel = `${baseUrl}/cart`;
        // Safety check: Ensure HTTP for localhost
        if (returnUrlCancel.includes('localhost') || returnUrlCancel.includes('127.0.0.1')) {
          returnUrlCancel = returnUrlCancel.replace('https://', 'http://');
        }

        // Generate unique idempotency key for checkout
        const checkoutIdempotencyKey = `${idempotencyKey}-checkout`;

        // Use Checkout API to create payment link
        // Square Checkout API - CreatePaymentLink endpoint (references the Square Order ID)
        // Note: The Square-hosted checkout page automatically includes:
        // - Apple Pay
        // - Google Pay
        // - Other digital wallets
        // No additional configuration needed for digital wallet support
        // Note: Square SDK v43 uses paymentLinks.create() method
        const paymentLinksApi = squareClient.checkout.paymentLinks;

        // Create payment link request with order reference
        // According to Square API docs: https://developer.squareup.com/reference/square/checkout-api/create-payment-link
        // The API expects: { idempotency_key, order, checkout_options, ... }
        // The SDK expects an Order object, but we must exclude ALL read-only/calculated fields
        // Read-only fields include: id, net_amounts, net_amount_due_money, total_*_money, created_at, updated_at, version, state, source
        // Line items also have read-only fields: gross_sales_money, total_tax_money, total_discount_money, total_money, variation_total_price_money, etc.
        // We'll create a minimal order object with only the writable fields needed to reference the order
        
        // Helper function to clean line items (remove read-only fields)
        const cleanLineItem = (item) => {
          const {
            uid: _uid,
            gross_sales_money: _grossSalesMoney,
            grossSalesMoney: _grossSalesMoneyCamel,
            total_tax_money: _totalTaxMoney,
            totalTaxMoney: _totalTaxMoneyCamel,
            total_discount_money: _totalDiscountMoney,
            totalDiscountMoney: _totalDiscountMoneyCamel,
            total_money: _totalMoney,
            totalMoney: _totalMoneyCamel,
            variation_total_price_money: _variationTotalPriceMoney,
            variationTotalPriceMoney: _variationTotalPriceMoneyCamel,
            total_service_charge_money: _totalServiceChargeMoney,
            totalServiceChargeMoney: _totalServiceChargeMoneyCamel,
            applied_taxes: _appliedTaxes,
            appliedTaxes: _appliedTaxesCamel,
            ...writableFields
          } = item;
          return writableFields;
        };
        
        // Helper function to clean tax objects (remove read-only fields)
        // Note: If catalog_object_id is present, we must remove percentage and type (they're mutually exclusive)
        const cleanTax = (tax) => {
          const {
            uid: _uid,
            applied_money: _appliedMoney,
            appliedMoney: _appliedMoneyCamel,
            auto_applied: _autoApplied,
            autoApplied: _autoAppliedCamel,
            ...writableFields
          } = tax;
          
          // If catalog_object_id is present, remove percentage and type (they're mutually exclusive with catalog_object_id)
          if (writableFields.catalog_object_id || writableFields.catalogObjectId) {
            const { 
              percentage: _percentage, 
              type: _type,
              ...taxWithoutCatalogFields 
            } = writableFields;
            return taxWithoutCatalogFields;
          }
          
          return writableFields;
        };
        
        // Clean the order object (remove read-only fields)
        const { 
          id: _orderId,
          net_amounts: _netAmounts,
          netAmounts: _netAmountsCamel,
          net_amount_due_money: _netAmountDueMoney,
          netAmountDueMoney: _netAmountDueMoneyCamel,
          total_tax_money: _totalTaxMoney,
          totalTaxMoney: _totalTaxMoneyCamel,
          total_discount_money: _totalDiscountMoney,
          totalDiscountMoney: _totalDiscountMoneyCamel,
          total_tip_money: _totalTipMoney,
          totalTipMoney: _totalTipMoneyCamel,
          total_money: _totalMoney,
          totalMoney: _totalMoneyCamel,
          total_service_charge_money: _totalServiceChargeMoney,
          totalServiceChargeMoney: _totalServiceChargeMoneyCamel,
          total_card_surcharge_money: _totalCardSurchargeMoney,
          totalCardSurchargeMoney: _totalCardSurchargeMoneyCamel,
          created_at: _createdAt,
          createdAt: _createdAtCamel,
          updated_at: _updatedAt,
          updatedAt: _updatedAtCamel,
          version: _version,
          state: _state,
          source: _source,
          line_items: lineItems,
          lineItems: lineItemsCamel,
          taxes: taxes,
          ...orderWritableFields 
        } = squareOrder;
        
        // Clean line items and taxes arrays
        const cleanedLineItems = (lineItems || lineItemsCamel || []).map(cleanLineItem);
        const cleanedTaxes = (taxes || []).map(cleanTax);
        
        // Reconstruct order object with cleaned arrays
        const cleanedOrder = {
          ...orderWritableFields,
          lineItems: cleanedLineItems,
          taxes: cleanedTaxes.length > 0 ? cleanedTaxes : undefined,
        };
        
        const paymentLinkRequest = {
          idempotencyKey: checkoutIdempotencyKey,
          order: cleanedOrder, // Order object with only writable fields (read-only fields removed)
          checkoutOptions: {
            askForShippingAddress: false, // Pickup orders don't need shipping address
            redirectUrl: returnUrlSuccess.replace('https://', 'http://'), // Force HTTP for localhost (fixes Error -107)
            // Note: Square handles cancel redirects automatically - if user cancels, they're redirected back
            // The cancel URL (returnUrlCancel) is handled by Square's checkout page behavior
            merchantSupportEmail: payload.customer_details.email,
            prePopulateBuyerEmail: payload.customer_details.email,
            // No prePopulateShippingAddress for pickup orders
          },
        };

        console.log('[Checkout] Payment link request structure:', {
          hasIdempotencyKey: !!paymentLinkRequest.idempotencyKey,
          hasOrder: !!paymentLinkRequest.order,
          originalOrderId: squareOrder?.id,
          orderHasId: !!paymentLinkRequest.order?.id, // Should be false (removed)
          orderType: typeof paymentLinkRequest.order,
          isOrderObject: paymentLinkRequest.order && typeof paymentLinkRequest.order === 'object',
          requestKeys: Object.keys(paymentLinkRequest),
        });
        
        // Verify order object is set (it should NOT have an 'id' field)
        if (!paymentLinkRequest.order) {
          console.error('[Checkout] Payment link request missing order object:', {
            hasOrder: !!paymentLinkRequest.order,
            squareOrderId: squareOrder?.id,
          });
          throw new Error('Cannot create payment link - Square order object is missing');
        }

        console.log('[Checkout] Creating Square payment link:', {
          orderId: squareOrder.id,
          returnUrlSuccess,
          returnUrlCancel,
          baseUrl,
          isLocalhost: baseUrl.includes('localhost'),
          protocol: baseUrl.startsWith('http://') ? 'HTTP' : 'HTTPS',
        });

        const checkoutResponse = await paymentLinksApi.create(paymentLinkRequest);

        // Handle different response structures (similar to orders API)
        let paymentLinkData = null;
        let checkoutErrors = null;

        console.log('[Checkout] Payment link response structure:', {
          hasResponse: !!checkoutResponse,
          hasResult: !!checkoutResponse?.result,
          responseKeys: checkoutResponse && typeof checkoutResponse === 'object' ? Object.keys(checkoutResponse) : 'not an object',
          resultKeys: checkoutResponse?.result && typeof checkoutResponse.result === 'object' ? Object.keys(checkoutResponse.result) : 'no result',
        });

        if (checkoutResponse?.result) {
          // Standard SDK structure: { result: { paymentLink: {...}, errors: [...] } }
          if (checkoutResponse.result.errors && checkoutResponse.result.errors.length > 0) {
            checkoutErrors = checkoutResponse.result.errors;
          }
          paymentLinkData = checkoutResponse.result.paymentLink;
        } else if (checkoutResponse?.paymentLink) {
          // Direct structure: { paymentLink: {...} }
          paymentLinkData = checkoutResponse.paymentLink;
          if (checkoutResponse.errors) {
            checkoutErrors = checkoutResponse.errors;
          }
        } else if (checkoutResponse?.id && checkoutResponse?.url) {
          // The response IS the payment link object itself
          paymentLinkData = checkoutResponse;
        } else {
          console.error('[Checkout] Unexpected payment link response structure:', {
            response: JSON.stringify(checkoutResponse, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            , 2).substring(0, 1000),
          });
          throw new Error('Invalid response from Square Checkout API - unexpected structure');
        }

        // Check for errors
        if (checkoutErrors && checkoutErrors.length > 0) {
          const errorMessages = checkoutErrors.map(e => e.detail || e.code || e.message).join(', ');
          throw new Error(`Square Checkout API errors: ${errorMessages}`);
        }

        // Extract checkout page URL from payment link response
        // Payment link response contains 'url' field with the checkout page URL
        checkoutPageUrl = paymentLinkData?.url || paymentLinkData?.checkoutPageUrl;

        if (!checkoutPageUrl) {
          console.error('[Checkout] Payment link created but missing URL:', {
            paymentLinkId: paymentLinkData?.id,
            paymentLinkKeys: paymentLinkData ? Object.keys(paymentLinkData) : [],
            paymentLinkData: JSON.stringify(paymentLinkData, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            , 2).substring(0, 500),
          });
          throw new Error('Payment link created but missing checkout URL');
        }

        console.log('[Checkout] Square payment link created:', {
          paymentLinkId: paymentLinkData?.id,
          checkoutPageUrl,
        });

      } catch (checkoutError) {
        console.error('[Checkout] Square checkout creation failed:', {
          error: checkoutError.message,
          stack: checkoutError.stack,
          statusCode: checkoutError.statusCode,
          errors: checkoutError.errors,
          body: checkoutError.body,
        });
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
    // Success URL uses orderId (UUID) for secure, ID-based retrieval (Task 3.7)
    // CRITICAL: Force HTTP for localhost to prevent Error -107
    let returnUrlSuccess = `${baseUrl}/order-confirmation?id=${orderId}`;
    // Safety check: Ensure HTTP for localhost (even if baseUrl somehow has HTTPS)
    if (returnUrlSuccess.includes('localhost') || returnUrlSuccess.includes('127.0.0.1')) {
      returnUrlSuccess = returnUrlSuccess.replace('https://', 'http://');
    }
    
    // Cancel URL redirects back to cart
    let returnUrlCancel = `${baseUrl}/cart`;
    // Safety check: Ensure HTTP for localhost
    if (returnUrlCancel.includes('localhost') || returnUrlCancel.includes('127.0.0.1')) {
      returnUrlCancel = returnUrlCancel.replace('https://', 'http://');
    }

    // Validate that we have a checkout URL before responding
    if (!checkoutPageUrl || !squareOrder?.id) {
      console.error('[Checkout] Missing checkout URL or Square order ID');
      return res.status(500).json({
        error: 'Checkout creation failed',
        message: 'Failed to create Square checkout. Please try again.',
      });
    }

    // Response format for Square-hosted checkout (Task 3.7)
    // Returns the Neon Order ID (UUID) for secure order retrieval
    const response = {
      url: checkoutPageUrl, // Square-hosted checkout page URL (includes Apple Pay, Google Pay automatically)
      order_id: orderId, // Neon Order ID (UUID) - for secure order retrieval
      order_number: orderNumber, // User-friendly order number (for display)
      square_order_id: squareOrder.id, // Square Order ID for tracking
    };

    console.log('[Checkout] Order and checkout created successfully:', {
      orderId,
      orderNumber: order.order_number,
      squareOrderId: squareOrder.id,
      checkoutUrl: checkoutPageUrl,
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

