/**
 * Webhook Payload Helpers
 * 
 * Utilities for generating mock Square webhook payloads based on Square's official documentation.
 * 
 * References:
 * - Square Webhooks: https://developer.squareup.com/docs/webhooks/overview
 * - Webhook Event Types: https://developer.squareup.com/docs/webhooks/using-webhooks
 */

/**
 * Generate a mock order.updated webhook payload
 * Based on Square's order.updated event structure
 * Reference: https://developer.squareup.com/reference/square/webhooks/order.updated
 */
export function createOrderUpdatedPayload(orderData = {}) {
  const defaultOrder = {
    id: orderData.id || `order_${Date.now()}`,
    location_id: orderData.locationId || 'L78CMEXB9NNAC',
    state: orderData.state || 'OPEN',
    version: orderData.version || 1,
    created_at: orderData.createdAt || new Date().toISOString(),
    updated_at: orderData.updatedAt || new Date().toISOString(),
    line_items: orderData.lineItems || [],
    fulfillments: orderData.fulfillments || [],
    net_amounts: orderData.netAmounts || {
      total_money: {
        amount: 2500,
        currency: 'USD',
      },
    },
    metadata: orderData.metadata || {},
    note: orderData.note || '',
  };

  return {
    type: 'order.updated',
    event_id: `event_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      type: 'order',
      id: defaultOrder.id,
      object: {
        order_updated: defaultOrder,
      },
    },
  };
}

/**
 * Generate a mock payment.created webhook payload
 * Based on Square's payment.created event structure
 * Reference: https://developer.squareup.com/reference/square/webhooks/payment.created
 */
export function createPaymentCreatedPayload(paymentData = {}) {
  const defaultPayment = {
    id: paymentData.id || `payment_${Date.now()}`,
    status: paymentData.status || 'COMPLETED',
    order_id: paymentData.orderId || null,
    amount_money: paymentData.amountMoney || {
      amount: 2500,
      currency: 'USD',
    },
    created_at: paymentData.createdAt || new Date().toISOString(),
  };

  return {
    type: 'payment.created',
    event_id: `event_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      type: 'payment',
      id: defaultPayment.id,
      object: {
        payment: defaultPayment,
      },
    },
  };
}

/**
 * Generate a mock payment.updated webhook payload
 */
export function createPaymentUpdatedPayload(paymentData = {}) {
  return createPaymentCreatedPayload({ ...paymentData, type: 'payment.updated' });
}

/**
 * Generate a mock refund.updated webhook payload
 * Based on Square's refund event structure
 * Reference: https://developer.squareup.com/reference/square/webhooks/refund.updated
 */
export function createRefundUpdatedPayload(refundData = {}) {
  const defaultRefund = {
    id: refundData.id || `refund_${Date.now()}`,
    status: refundData.status || 'COMPLETED',
    payment_id: refundData.paymentId || `payment_${Date.now()}`,
    amount_money: refundData.amountMoney || {
      amount: 500, // $5.00 partial refund
      currency: 'USD',
    },
    reason: refundData.reason || 'Customer request',
    created_at: refundData.createdAt || new Date().toISOString(),
  };

  return {
    type: 'refund.updated',
    event_id: `event_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      type: 'refund',
      id: defaultRefund.id,
      object: {
        refund: defaultRefund,
      },
    },
  };
}

/**
 * Generate a mock inventory.count.updated webhook payload
 * Based on Square's inventory.count.updated event structure
 * Reference: https://developer.squareup.com/reference/square/webhooks/inventory.count.updated
 */
export function createInventoryCountUpdatedPayload(inventoryData = {}) {
  const defaultCount = {
    catalog_object_id: inventoryData.catalogObjectId || `item_${Date.now()}`,
    catalog_object_type: 'ITEM_VARIATION',
    state: inventoryData.state || 'CUSTOM',
    location_id: inventoryData.locationId || 'L78CMEXB9NNAC',
    quantity: inventoryData.quantity || '10',
    calculated_at: inventoryData.calculatedAt || new Date().toISOString(),
  };

  return {
    type: 'inventory.count.updated',
    event_id: `event_${Date.now()}`,
    created_at: new Date().toISOString(),
    data: {
      type: 'inventory.count',
      id: defaultCount.catalog_object_id,
      object: {
        inventory_count: defaultCount,
      },
    },
  };
}

/**
 * Create a webhook payload with fulfillment details for pickup orders
 * Uses test customer data for consistency
 */
export function createOrderWithFulfillment(orderData = {}) {
  // Import test customer data if available
  let customerName = orderData.customerName || 'Test Customer';
  let customerEmail = orderData.customerEmail || 'test.customer@example.com';
  let customerPhone = orderData.customerPhone || '+15551234567';

  // Try to use test customer data from test-customer utility
  try {
    const { TEST_CUSTOMER_DATA } = require('./test-customer.js');
    customerName = orderData.customerName || `${TEST_CUSTOMER_DATA.givenName} ${TEST_CUSTOMER_DATA.familyName}`;
    customerEmail = orderData.customerEmail || TEST_CUSTOMER_DATA.emailAddress;
    customerPhone = orderData.customerPhone || TEST_CUSTOMER_DATA.phoneNumber;
  } catch (e) {
    // Fall back to defaults if test-customer not available
  }

  const fulfillments = [{
    uid: 'fulfillment_1',
    type: 'PICKUP',
    state: orderData.fulfillmentState || 'PROPOSED',
    pickup_details: {
      recipient: {
        display_name: customerName,
        email_address: customerEmail,
        phone_number: customerPhone,
      },
      schedule_type: 'ASAP',
    },
  }];

  return createOrderUpdatedPayload({
    ...orderData,
    fulfillments,
  });
}

/**
 * Create a webhook payload with line items
 */
export function createOrderWithLineItems(orderData = {}) {
  const lineItems = orderData.lineItems || [{
    uid: 'line_item_1',
    name: 'Test Record',
    quantity: '1',
    catalog_object_id: 'WLXUNXMRMXZYZBMT6CMB2G3U',
    base_price_money: {
      amount: 2500,
      currency: 'USD',
    },
    total_money: {
      amount: 2500,
      currency: 'USD',
    },
  }];

  return createOrderUpdatedPayload({
    ...orderData,
    line_items: lineItems,
  });
}

