/**
 * Monitoring Debug Endpoint
 * 
 * Provides debugging information and testing capabilities for monitoring checks.
 * 
 * Usage:
 *   GET /api/monitoring/debug - View debug information
 *   POST /api/monitoring/debug/test-slack - Test Slack webhook
 *   POST /api/monitoring/debug/test-inventory - Test inventory sync check
 *   POST /api/monitoring/debug/test-orders - Test order reconciliation check
 *   POST /api/monitoring/debug/test-neon - Test Neon health check
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';

/**
 * Test Slack webhook directly
 */
async function testSlackWebhook() {
  let webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  // Try to load from .env.local if not found
  if (!webhookUrl) {
    try {
      const { config } = await import('dotenv');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const result = config({ path: join(__dirname, '../../.env.local') });
      if (result && !result.error) {
        webhookUrl = process.env.SLACK_WEBHOOK_URL;
      }
    } catch (e) {
      // dotenv not available
    }
  }
  
  if (!webhookUrl) {
    return {
      success: false,
      error: 'SLACK_WEBHOOK_URL not configured',
      source: 'environment',
    };
  }
  
  // Strip quotes if present
  webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
  
  const testMessage = {
    text: '🧪 Test Alert from Monitoring Debug',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🧪 Test Alert from Monitoring Debug',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test message from the monitoring debug endpoint. If you see this, your Slack webhook is working correctly! ✅',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Timestamp: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMessage),
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Slack webhook test successful',
        webhookUrl: webhookUrl.substring(0, 50) + '...', // Partial URL for security
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        error: `Slack API error: ${response.status}`,
        details: errorText,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.stack,
    };
  }
}

/**
 * Get configuration status
 */
async function getConfigurationStatus() {
  const config = {
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      vercel: !!process.env.VERCEL,
      vercelUrl: process.env.VERCEL_URL || 'not set',
    },
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL ? 'configured' : 'not configured',
      source: process.env.SLACK_WEBHOOK_URL ? 'environment' : 'missing',
    },
    square: {
      accessToken: process.env.SQUARE_ACCESS_TOKEN ? 'configured' : 'not configured',
      locationId: process.env.SQUARE_LOCATION_ID ? 'configured' : 'not configured',
      environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    },
    database: {
      url: process.env.SPR_DATABASE_URL ? 'configured' : 'not configured',
      source: process.env.SPR_DATABASE_URL ? 'SPR_DATABASE_URL' : 
              process.env.NEON_DATABASE_URL ? 'NEON_DATABASE_URL' :
              process.env.DATABASE_URL ? 'DATABASE_URL' : 'none',
    },
  };
  
  // Try to load from .env.local for local dev
  if (!config.slack.webhookUrl || config.slack.webhookUrl === 'not configured') {
    try {
      const { config: dotenvConfig } = await import('dotenv');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const result = dotenvConfig({ path: join(__dirname, '../../.env.local') });
      if (result && !result.error && process.env.SLACK_WEBHOOK_URL) {
        config.slack.webhookUrl = 'configured (from .env.local)';
        config.slack.source = '.env.local';
      }
    } catch (e) {
      // dotenv not available or error
    }
  }
  
  return config;
}

/**
 * Test database connection
 */
async function testDatabaseConnection() {
  const databaseUrl = process.env.SPR_DATABASE_URL || 
                     process.env.NEON_DATABASE_URL || 
                     process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return {
      success: false,
      error: 'Database URL not configured',
    };
  }
  
  try {
    const sql = neon(databaseUrl);
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;
    
    return {
      success: true,
      message: 'Database connection successful',
      details: {
        currentTime: result[0].current_time,
        postgresVersion: result[0].pg_version?.substring(0, 50),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.stack,
    };
  }
}

/**
 * Test Square API connection
 */
async function testSquareConnection() {
  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
  const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
  const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();
  
  if (!squareAccessToken || !squareLocationId) {
    return {
      success: false,
      error: 'Square credentials not configured',
      missing: !squareAccessToken ? 'SQUARE_ACCESS_TOKEN' : 'SQUARE_LOCATION_ID',
    };
  }
  
  try {
    const squareClient = new SquareClient({
      token: squareAccessToken,
      environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
    
    // Test with a simple API call
    const locationsResponse = await squareClient.locations.list();
    
    if (locationsResponse.result && locationsResponse.result.locations) {
      return {
        success: true,
        message: 'Square API connection successful',
        details: {
          environment: squareEnvironment,
          locationsFound: locationsResponse.result.locations.length,
          locationId: squareLocationId,
        },
      };
    } else {
      return {
        success: false,
        error: 'Square API returned unexpected response',
        details: locationsResponse,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.errors || error.stack,
    };
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter(Boolean);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Handle different test actions
    if (req.method === 'POST' && req.body?.action) {
      const { action } = req.body;
      
      switch (action) {
        case 'test-slack':
          const slackResult = await testSlackWebhook();
          return res.status(200).json({
            action: 'test-slack',
            timestamp: new Date().toISOString(),
            ...slackResult,
          });
        
        case 'test-database':
          const dbResult = await testDatabaseConnection();
          return res.status(200).json({
            action: 'test-database',
            timestamp: new Date().toISOString(),
            ...dbResult,
          });
        
        case 'test-square':
          const squareResult = await testSquareConnection();
          return res.status(200).json({
            action: 'test-square',
            timestamp: new Date().toISOString(),
            ...squareResult,
          });
        
        case 'test-inventory':
          // Trigger inventory sync check
          const inventoryResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/inventory-sync-check`,
            { method: 'POST' }
          );
          const inventoryData = await inventoryResponse.json();
          return res.status(200).json({
            action: 'test-inventory',
            timestamp: new Date().toISOString(),
            result: inventoryData,
          });
        
        case 'test-orders':
          // Trigger order reconciliation check
          const ordersResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/order-reconciliation-check`,
            { method: 'POST' }
          );
          const ordersData = await ordersResponse.json();
          return res.status(200).json({
            action: 'test-orders',
            timestamp: new Date().toISOString(),
            result: ordersData,
          });
        
        case 'test-neon':
          // Trigger Neon health check
          const neonResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/neon-health`,
            { method: 'POST' }
          );
          const neonData = await neonResponse.json();
          return res.status(200).json({
            action: 'test-neon',
            timestamp: new Date().toISOString(),
            result: neonData,
          });
        
        case 'test-square-health':
          // Trigger Square health check
          const squareHealthResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/square-health`,
            { method: 'POST' }
          );
          const squareHealthData = await squareHealthResponse.json();
          return res.status(200).json({
            action: 'test-square-health',
            timestamp: new Date().toISOString(),
            result: squareHealthData,
          });
        
        case 'test-esp-health':
          // Trigger ESP health check
          const espHealthResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/esp-health`,
            { method: 'POST' }
          );
          const espHealthData = await espHealthResponse.json();
          return res.status(200).json({
            action: 'test-esp-health',
            timestamp: new Date().toISOString(),
            result: espHealthData,
          });
        
        case 'test-cart-abandonment':
          // Trigger cart abandonment check
          const cartAbandonmentResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/cart-abandonment`,
            { method: 'POST' }
          );
          const cartAbandonmentData = await cartAbandonmentResponse.json();
          return res.status(200).json({
            action: 'test-cart-abandonment',
            timestamp: new Date().toISOString(),
            result: cartAbandonmentData,
          });
        
        case 'test-auth-failure-rate':
          // Trigger auth failure rate check
          const authFailureRateResponse = await fetch(
            `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/monitoring/auth-failure-rate`,
            { method: 'POST' }
          );
          const authFailureRateData = await authFailureRateResponse.json();
          return res.status(200).json({
            action: 'test-auth-failure-rate',
            timestamp: new Date().toISOString(),
            result: authFailureRateData,
          });
        
        default:
          return res.status(400).json({
            error: 'Invalid action',
            availableActions: ['test-slack', 'test-database', 'test-square', 'test-inventory', 'test-orders', 'test-neon', 'test-square-health', 'test-esp-health', 'test-cart-abandonment', 'test-auth-failure-rate'],
          });
      }
    }
    
    // Default: Return debug information
    const config = await getConfigurationStatus();
    const dbTest = await testDatabaseConnection();
    const squareTest = await testSquareConnection();
    
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      configuration: config,
      tests: {
        database: dbTest,
        square: squareTest,
      },
      endpoints: {
        inventorySync: '/api/monitoring/inventory-sync-check',
        orderReconciliation: '/api/monitoring/order-reconciliation-check',
        neonHealth: '/api/monitoring/neon-health',
        squareHealth: '/api/monitoring/square-health',
        espHealth: '/api/monitoring/esp-health',
        cartAbandonment: '/api/monitoring/cart-abandonment',
        authFailureRate: '/api/monitoring/auth-failure-rate',
      },
      usage: {
        get: 'GET /api/monitoring/debug - View this debug information',
        post: 'POST /api/monitoring/debug with body: { "action": "test-slack|test-database|test-square|test-inventory|test-orders|test-neon" }',
      },
    });
  } catch (error) {
    console.error('[Monitoring Debug] Error:', error);
    return res.status(500).json({
      error: 'Debug endpoint error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

