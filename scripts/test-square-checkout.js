#!/usr/bin/env node

/**
 * Test Square Checkout API Directly
 * 
 * This script tests the Square Orders API and Checkout API to verify
 * authentication and API structure.
 * 
 * Usage:
 *   node scripts/test-square-checkout.js
 */

import { SquareClient, SquareEnvironment } from 'square';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

async function main() {
  const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const locationId = process.env.SQUARE_LOCATION_ID?.trim();

  if (!token || !locationId) {
    console.error('❌ Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID');
    console.error('   Set them in .env.local or environment variables');
    process.exit(1);
  }

  console.log('🔐 Testing Square Authentication...\n');
  console.log('Token preview:', `${token.substring(0, 12)}...${token.substring(token.length - 8)}`);
  console.log('Location ID:', locationId);
  console.log('Environment: Sandbox\n');

  const client = new SquareClient({
    environment: SquareEnvironment.Sandbox,
    token: token, // Try 'token' instead of 'accessToken'
  });

  try {
    // Step 1: Test authentication with Locations API
    console.log('📍 Step 1: Testing authentication with Locations API...');
    // Square SDK v43 uses lowercase property names and 'list' method
    const locationsApi = client.locations;
    const locationsResponse = await locationsApi.list();
    console.log('✅ Authentication successful!');
    if (locationsResponse.result?.locations) {
      console.log(`   Found ${locationsResponse.result.locations.length} location(s)\n`);
    } else {
      console.log('');
    }

    // Step 2: Create a test order using Orders API
    console.log('📦 Step 2: Creating test order with Orders API...');
    const idempotencyKey = randomUUID();
    const testCatalogObjectId = 'WLXUNXMRMXZYZBMT6CMB2G3U'; // From your test script

    const orderRequest = {
      idempotencyKey,
      order: {
        locationId,
        lineItems: [
          {
            quantity: '1',
            catalogObjectId: testCatalogObjectId,
            // Note: basePriceMoney is optional if the catalog object has a price
          },
        ],
        pricingOptions: {
          autoApplyDiscounts: false,
          autoApplyTaxes: true,
        },
        referenceId: `TEST-${Date.now()}`,
      },
    };

    console.log('Order request:', JSON.stringify(orderRequest, null, 2));
    const orderResponse = await client.orders.create(orderRequest);

    if (orderResponse.result.errors && orderResponse.result.errors.length > 0) {
      console.error('❌ Order creation failed:');
      console.error(JSON.stringify(orderResponse.result.errors, null, 2));
      process.exit(1);
    }

    const squareOrder = orderResponse.result.order;
    console.log('✅ Order created successfully!');
    console.log('   Order ID:', squareOrder.id);
    console.log('   Version:', squareOrder.version);
    console.log('   State:', squareOrder.state);
    console.log('');

    // Step 3: Create payment link using Checkout API
    console.log('💳 Step 3: Creating payment link with Checkout API...');
    const checkoutIdempotencyKey = randomUUID();
    const returnUrlSuccess = 'https://example.com/success';
    const returnUrlCancel = 'https://example.com/cancel';

    const paymentLinkRequest = {
      idempotencyKey: checkoutIdempotencyKey,
      paymentLink: {
        orderId: squareOrder.id, // Use the order ID from Step 2
        checkoutOptions: {
          askForShippingAddress: false,
          redirectUrl: returnUrlSuccess,
          merchantSupportEmail: 'test@example.com',
        },
      },
    };

    console.log('Payment link request:', JSON.stringify(paymentLinkRequest, null, 2));
    const checkoutResponse = await client.checkout.paymentLinks.create(paymentLinkRequest);

    if (checkoutResponse.result.errors && checkoutResponse.result.errors.length > 0) {
      console.error('❌ Payment link creation failed:');
      console.error(JSON.stringify(checkoutResponse.result.errors, null, 2));
      process.exit(1);
    }

    const paymentLink = checkoutResponse.result.paymentLink;
    console.log('✅ Payment link created successfully!');
    console.log('   Payment Link ID:', paymentLink.id);
    console.log('   URL:', paymentLink.url);
    console.log('   Version:', paymentLink.version);
    console.log('');

    console.log('🎉 All tests passed! Your Square credentials are working correctly.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.statusCode) {
      console.error('   Status Code:', error.statusCode);
    }
    if (error.errors) {
      console.error('   Errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.body) {
      console.error('   Body:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

main().catch(console.error);

