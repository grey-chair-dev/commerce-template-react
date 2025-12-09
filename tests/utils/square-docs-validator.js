/**
 * Square Documentation Validator
 * 
 * Utilities to validate API responses and webhook payloads against Square's official API documentation.
 * 
 * References:
 * - Square API Reference: https://developer.squareup.com/reference/square
 * - Square API Explorer: https://developer.squareup.com/docs/build-basics/using-rest-apis
 */

/**
 * Validate that a payment response matches Square's Payment API structure
 * Reference: https://developer.squareup.com/reference/square/payments-api/create-payment
 */
export function validatePaymentResponse(payment) {
  const errors = [];

  // Required fields per Square Payment API docs
  if (!payment.id) errors.push('Missing payment.id');
  if (!payment.status) errors.push('Missing payment.status');
  if (!payment.amount_money && !payment.amountMoney) {
    errors.push('Missing payment.amount_money or payment.amountMoney');
  }

  // Validate status is a valid Square payment status
  const validStatuses = ['PENDING', 'APPROVED', 'COMPLETED', 'CANCELED', 'FAILED', 'VOIDED'];
  if (payment.status && !validStatuses.includes(payment.status)) {
    errors.push(`Invalid payment.status: ${payment.status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate amount_money structure
  const amountMoney = payment.amount_money || payment.amountMoney;
  if (amountMoney) {
    if (typeof amountMoney.amount !== 'number' && typeof amountMoney.amount !== 'bigint') {
      errors.push('payment.amount_money.amount must be a number or BigInt');
    }
    if (amountMoney.currency !== 'USD' && amountMoney.currency !== 'CAD' && amountMoney.currency !== 'GBP') {
      errors.push(`Invalid currency: ${amountMoney.currency}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that an order response matches Square's Order API structure
 * Reference: https://developer.squareup.com/reference/square/orders-api/create-order
 */
export function validateOrderResponse(order) {
  const errors = [];

  // Required fields per Square Order API docs
  if (!order.id) errors.push('Missing order.id');
  if (!order.location_id && !order.locationId) {
    errors.push('Missing order.location_id or order.locationId');
  }
  if (order.state === undefined && order.order_state === undefined) {
    errors.push('Missing order.state or order.order_state');
  }

  // Validate state is a valid Square order state
  const validStates = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELED'];
  const state = order.state || order.order_state;
  if (state && !validStates.includes(state)) {
    errors.push(`Invalid order.state: ${state}. Must be one of: ${validStates.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that a catalog item has custom attributes
 * Reference: https://developer.squareup.com/reference/square/catalog-api/catalog-object
 */
export function validateCustomAttributes(catalogObject, requiredAttributes = []) {
  const errors = [];
  const itemData = catalogObject.item_data || catalogObject.itemData || {};
  const customAttributes = itemData.custom_attribute_values || 
                           itemData.custom_attributes ||
                           catalogObject.custom_attribute_values ||
                           [];

  // Check for required custom attributes
  for (const requiredAttr of requiredAttributes) {
    const found = customAttributes.find(attr => {
      const name = attr.name || attr.key || attr.custom_attribute_definition_name || '';
      return name.toLowerCase().includes(requiredAttr.toLowerCase());
    });

    if (!found) {
      errors.push(`Missing required custom attribute: ${requiredAttr}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    foundAttributes: customAttributes.map(attr => ({
      name: attr.name || attr.key || attr.custom_attribute_definition_name,
      value: attr.value || attr.string_value || attr.number_value,
      type: attr.type,
    })),
  };
}

/**
 * Validate webhook payload structure matches Square's webhook event format
 * Reference: https://developer.squareup.com/docs/webhooks/using-webhooks
 */
export function validateWebhookPayload(payload) {
  const errors = [];

  if (!payload.type) errors.push('Missing webhook payload.type');
  if (!payload.data) errors.push('Missing webhook payload.data');
  if (!payload.event_id && !payload.eventId) {
    errors.push('Missing webhook payload.event_id or payload.eventId');
  }

  // Validate event type is a known Square webhook type
  const validTypes = [
    'order.updated',
    'payment.created',
    'payment.updated',
    'refund.updated',
    'inventory.count.updated',
    'catalog.version.updated',
  ];
  if (payload.type && !validTypes.includes(payload.type)) {
    errors.push(`Unknown webhook type: ${payload.type}. Valid types: ${validTypes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate inventory count structure
 * Reference: https://developer.squareup.com/reference/square/inventory-api/retrieve-inventory-count
 */
export function validateInventoryCount(count) {
  const errors = [];

  if (!count.catalog_object_id && !count.catalogObjectId) {
    errors.push('Missing inventory count catalog_object_id');
  }
  if (count.quantity === undefined && count.quantity === null) {
    errors.push('Missing inventory count quantity');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

