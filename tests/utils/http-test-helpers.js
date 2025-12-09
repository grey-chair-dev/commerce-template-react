/**
 * HTTP Test Helpers
 * 
 * Utilities for making HTTP requests to API endpoints in tests.
 * Used for testing Vercel serverless functions.
 */

/**
 * Make an HTTP request to a local endpoint
 * For Vercel serverless functions, we'll need to import and call the handler directly
 */
export async function makeRequest(handler, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    query = {},
  } = options;

  // Create mock request object (Vercel serverless function format)
  const req = {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    query,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    url: options.url || '/',
  };

  // Create mock response object
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    json: function(data) {
      this.body = data;
      return this;
    },
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    setHeader: function(name, value) {
      this.headers[name] = value;
      return this;
    },
    send: function(data) {
      this.body = data;
      return this;
    },
  };

  // Call the handler
  await handler(req, res);

  return {
    status: res.statusCode,
    headers: res.headers,
    body: res.body,
    json: () => res.body,
  };
}

/**
 * Extract raw body from request for signature verification testing
 */
export function createRawBody(payload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

/**
 * Create a mock Vercel request with raw body (for webhook signature testing)
 */
export function createWebhookRequest(payload, signature = null, signatureKey = null) {
  const rawBody = createRawBody(payload);
  
  // Calculate signature if not provided
  if (!signature && signatureKey) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', signatureKey);
    hmac.update(rawBody, 'utf8');
    signature = hmac.digest('base64');
  }

  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature && { 'x-square-signature': signature }),
    },
    body: rawBody, // Raw body for signature verification
    query: {},
    url: '/api/webhooks/square-order-paid',
  };
}

