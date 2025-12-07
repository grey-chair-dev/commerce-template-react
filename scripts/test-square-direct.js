#!/usr/bin/env node

/**
 * Direct Square API Test (Simplified version of user's script)
 * 
 * This demonstrates the correct two-step flow:
 * 1. Create Order (Orders API) - returns orderId
 * 2. Create Payment Link (Checkout API) - uses orderId from step 1
 */

import { SquareClient, SquareEnvironment } from 'square';
import { randomUUID } from 'crypto';

async function main() {
  const client = new SquareClient({
    environment: SquareEnvironment.Sandbox,
    accessToken: 'EAAAl1eZhc0_IFPUu1e2aEmPAbSJwDh8xoKJVsqB8YUOubOQM1tZHpFtjcH_TWRu',
  });

  const locationId = 'L78CMEXB9NNAC';
  const catalogObjectId = 'WLXUNXMRMXZYZBMT6CMB2G3U';

  try {
    // STEP 1: Create Order using Orders API
    console.log('Step 1: Creating order...');
    const orderResponse = await client.orders.create({
      idempotencyKey: randomUUID(),
      order: {
        locationId,
        lineItems: [
          {
            quantity: '1',
            catalogObjectId,
            // basePriceMoney is optional if catalog object has a price
          },
        ],
        pricingOptions: {
          autoApplyDiscounts: false,
          autoApplyTaxes: true,
        },
      },
    });

    if (orderResponse.result.errors?.length > 0) {
      console.error('Order creation errors:', orderResponse.result.errors);
      return;
    }

    const orderId = orderResponse.result.order.id;
    console.log('✅ Order created:', orderId);

    // STEP 2: Create Payment Link using Checkout API
    console.log('\nStep 2: Creating payment link...');
    const paymentLinkResponse = await client.checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      paymentLink: {
        orderId, // Use the orderId from Step 1
        checkoutOptions: {
          redirectUrl: 'https://example.com/success',
          merchantSupportEmail: 'test@example.com',
        },
      },
    });

    if (paymentLinkResponse.result.errors?.length > 0) {
      console.error('Payment link creation errors:', paymentLinkResponse.result.errors);
      return;
    }

    const paymentLink = paymentLinkResponse.result.paymentLink;
    console.log('✅ Payment link created:', paymentLink.url);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.statusCode) {
      console.error('Status:', error.statusCode);
    }
    if (error.errors) {
      console.error('Errors:', error.errors);
    }
  }
}

main();

