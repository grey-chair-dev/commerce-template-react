/**
 * Diagnostic endpoint to check webhook environment variables
 * This helps verify that signature keys are configured correctly
 * 
 * Usage: GET /api/webhooks/check-env
 */

export default async function handler(req, res) {
  // Set CORS headers to allow access from browser
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
    'https://spiralgrooverecords.greychair.io',
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check all possible signature key environment variables
  const envVars = {
    // Inventory webhook keys
    INVENTORY_WEBHOOK_SIGNATURE_KEY: {
      set: !!process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY,
      length: process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY?.length || 0,
      preview: process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY 
        ? process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY.substring(0, 10) + '...' 
        : 'not set',
    },
    
    // Order webhook keys
    ORDER_WEBHOOK_SIGNATURE_KEY: {
      set: !!process.env.ORDER_WEBHOOK_SIGNATURE_KEY,
      length: process.env.ORDER_WEBHOOK_SIGNATURE_KEY?.length || 0,
      preview: process.env.ORDER_WEBHOOK_SIGNATURE_KEY 
        ? process.env.ORDER_WEBHOOK_SIGNATURE_KEY.substring(0, 10) + '...' 
        : 'not set',
    },
    
    // Fallback keys
    SQUARE_SIGNATURE_KEY: {
      set: !!process.env.SQUARE_SIGNATURE_KEY,
      length: process.env.SQUARE_SIGNATURE_KEY?.length || 0,
      preview: process.env.SQUARE_SIGNATURE_KEY 
        ? process.env.SQUARE_SIGNATURE_KEY.substring(0, 10) + '...' 
        : 'not set',
    },
    
    SQUARE_WEBHOOK_SIGNATURE_KEY: {
      set: !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
      length: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.length || 0,
      preview: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY 
        ? process.env.SQUARE_WEBHOOK_SIGNATURE_KEY.substring(0, 10) + '...' 
        : 'not set',
    },
    
    // Database URLs
    SPR_NEON_DATABSE_URL: {
      set: !!process.env.SPR_NEON_DATABSE_URL,
      length: process.env.SPR_NEON_DATABSE_URL?.length || 0,
      preview: process.env.SPR_NEON_DATABSE_URL 
        ? process.env.SPR_NEON_DATABSE_URL.substring(0, 20) + '...' 
        : 'not set',
    },
    
    DATABASE_URL: {
      set: !!process.env.DATABASE_URL,
      length: process.env.DATABASE_URL?.length || 0,
      preview: process.env.DATABASE_URL 
        ? process.env.DATABASE_URL.substring(0, 20) + '...' 
        : 'not set',
    },
    
    SPR_DATABASE_URL: {
      set: !!process.env.SPR_DATABASE_URL,
      length: process.env.SPR_DATABASE_URL?.length || 0,
      preview: process.env.SPR_DATABASE_URL 
        ? process.env.SPR_DATABASE_URL.substring(0, 20) + '...' 
        : 'not set',
    },
  };

  // Determine which keys would be used by each webhook
  const inventoryKey = process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY || 
                      process.env.SQUARE_SIGNATURE_KEY || 
                      process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  
  const orderKey = process.env.ORDER_WEBHOOK_SIGNATURE_KEY || 
                   process.env.SQUARE_SIGNATURE_KEY || 
                   process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  const databaseUrl = process.env.SPR_NEON_DATABSE_URL || 
                      process.env.DATABASE_URL || 
                      process.env.SPR_POSTGRES_URL ||
                      process.env.POSTGRES_URL ||
                      process.env.SPR_DATABASE_URL ||
                      process.env.NEON_DATABASE_URL;

  return res.status(200).json({
    environment: process.env.NODE_ENV || 'development',
    vercelEnv: process.env.VERCEL_ENV || 'not set',
    webhookConfiguration: {
      inventory: {
        signatureKeySet: !!inventoryKey,
        signatureKeyLength: inventoryKey?.length || 0,
        signatureKeySource: process.env.INVENTORY_WEBHOOK_SIGNATURE_KEY 
          ? 'INVENTORY_WEBHOOK_SIGNATURE_KEY' 
          : process.env.SQUARE_SIGNATURE_KEY 
            ? 'SQUARE_SIGNATURE_KEY' 
            : process.env.SQUARE_WEBHOOK_SIGNATURE_KEY 
              ? 'SQUARE_WEBHOOK_SIGNATURE_KEY' 
              : 'NOT SET',
        status: inventoryKey ? '✅ Configured' : '❌ Missing',
      },
      order: {
        signatureKeySet: !!orderKey,
        signatureKeyLength: orderKey?.length || 0,
        signatureKeySource: process.env.ORDER_WEBHOOK_SIGNATURE_KEY 
          ? 'ORDER_WEBHOOK_SIGNATURE_KEY' 
          : process.env.SQUARE_SIGNATURE_KEY 
            ? 'SQUARE_SIGNATURE_KEY' 
            : process.env.SQUARE_WEBHOOK_SIGNATURE_KEY 
              ? 'SQUARE_WEBHOOK_SIGNATURE_KEY' 
              : 'NOT SET',
        status: orderKey ? '✅ Configured' : '❌ Missing',
      },
      database: {
        databaseUrlSet: !!databaseUrl,
        databaseUrlLength: databaseUrl?.length || 0,
        databaseUrlSource: process.env.SPR_NEON_DATABSE_URL 
          ? 'SPR_NEON_DATABSE_URL' 
          : process.env.DATABASE_URL 
            ? 'DATABASE_URL' 
            : process.env.SPR_POSTGRES_URL 
              ? 'SPR_POSTGRES_URL' 
              : process.env.POSTGRES_URL 
                ? 'POSTGRES_URL' 
                : process.env.SPR_DATABASE_URL 
                  ? 'SPR_DATABASE_URL' 
                  : process.env.NEON_DATABASE_URL 
                    ? 'NEON_DATABASE_URL' 
                    : 'NOT SET',
        status: databaseUrl ? '✅ Configured' : '❌ Missing',
      },
    },
    allEnvironmentVariables: envVars,
    recommendations: [
      !inventoryKey && 'Set INVENTORY_WEBHOOK_SIGNATURE_KEY in Vercel environment variables',
      !orderKey && 'Set ORDER_WEBHOOK_SIGNATURE_KEY in Vercel environment variables',
      !databaseUrl && 'Set SPR_NEON_DATABSE_URL or DATABASE_URL in Vercel environment variables',
      inventoryKey && orderKey && inventoryKey === orderKey && '⚠️  Both webhooks are using the same signature key. Each webhook subscription should have its own unique key.',
    ].filter(Boolean),
  });
}
