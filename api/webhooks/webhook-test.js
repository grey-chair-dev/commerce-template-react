/**
 * Simple webhook test endpoint
 * 
 * This endpoint logs ALL requests to help debug webhook issues
 * Use this to verify Square is actually sending webhooks
 */

export default async function handler(req, res) {
  // Log everything
  const timestamp = new Date().toISOString();
  console.log(`[Webhook Test] ========== REQUEST RECEIVED ==========`);
  console.log(`[Webhook Test] Timestamp: ${timestamp}`);
  console.log(`[Webhook Test] Method: ${req.method}`);
  console.log(`[Webhook Test] URL: ${req.url}`);
  console.log(`[Webhook Test] Headers:`, JSON.stringify(req.headers, null, 2));
  console.log(`[Webhook Test] Body type: ${typeof req.body}`);
  console.log(`[Webhook Test] Body:`, JSON.stringify(req.body, null, 2));
  
  // Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Return success for any request
  return res.status(200).json({
    received: true,
    timestamp,
    method: req.method,
    url: req.url,
    hasBody: !!req.body,
    bodyType: typeof req.body,
    message: 'Webhook test endpoint - check logs for full details',
  });
}

