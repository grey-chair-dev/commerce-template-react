/**
 * Test endpoint for Square Order Webhook
 * 
 * This endpoint helps debug webhook issues by:
 * 1. Testing if the endpoint is accessible
 * 2. Showing webhook configuration status
 * 3. Providing a way to manually test webhook processing
 */

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Return webhook configuration status
    const signatureKey = process.env.ORDER_WEBHOOK_SIGNATURE_KEY || 
                         process.env.SQUARE_SIGNATURE_KEY || 
                         process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                        process.env.NEON_DATABASE_URL || 
                        process.env.DATABASE_URL;

    const webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/webhooks/square-order-paid`
      : 'https://your-domain.vercel.app/api/webhooks/square-order-paid';

    return res.status(200).json({
      status: 'ok',
      webhookEndpoint: '/api/webhooks/square-order-paid',
      webhookUrl: webhookUrl,
      configuration: {
        hasSignatureKey: !!signatureKey,
        hasDatabaseUrl: !!databaseUrl,
        signatureKeyLength: signatureKey ? signatureKey.length : 0,
        databaseUrlPrefix: databaseUrl ? databaseUrl.substring(0, 20) + '...' : 'missing',
      },
      instructions: {
        step1: 'Go to Square Developer Dashboard → Webhooks',
        step2: `Add webhook URL: ${webhookUrl}`,
        step3: 'Subscribe to: order.updated, payment.created, payment.updated',
        step4: 'Copy the Webhook Signature Key',
        step5: 'Add to Vercel as ORDER_WEBHOOK_SIGNATURE_KEY',
      },
      troubleshooting: {
        webhookNotFiring: [
          'Check Square Dashboard → Webhooks → verify URL is correct',
          'Check Square Dashboard → Webhooks → verify events are subscribed',
          'Check Vercel logs for incoming requests',
          'Verify webhook URL is publicly accessible (not localhost)',
        ],
        signatureVerificationFailing: [
          'Verify ORDER_WEBHOOK_SIGNATURE_KEY matches Square Dashboard',
          'Check that signature key is from the correct webhook subscription',
          'Ensure signature key has no extra spaces or quotes',
        ],
        databaseNotUpdating: [
          'Check database connection string is correct',
          'Verify order exists in database with correct square_order_id',
          'Check Vercel logs for error messages',
        ],
      },
    });
  }

  // For POST requests, just echo back what was received (for testing)
  if (req.method === 'POST') {
    return res.status(200).json({
      received: true,
      method: req.method,
      headers: Object.keys(req.headers),
      bodyType: typeof req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      message: 'This is a test endpoint. Use /api/webhooks/square-order-paid for actual webhooks.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

