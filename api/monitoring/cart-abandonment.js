/**
 * Cart Abandonment Rate Monitoring
 * 
 * Tracks cart abandonment rate and alerts if it increases significantly.
 * 
 * Metric: Ratio of Carts Created to Transactions Completed
 * Alert: If abandonment rate increases by 15% within 24 hours
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (daily at 3 AM EST)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/cart-abandonment - Run check and send alerts if needed
 *   GET /api/monitoring/cart-abandonment - Check status without alerts
 */

import { neon } from '@neondatabase/serverless';

// Alert threshold: Alert if abandonment rate increases by 15% (e.g., 60% to 75%)
const ABANDONMENT_RATE_INCREASE_THRESHOLD = 0.15; // 15%

/**
 * Calculate cart abandonment rate for a time period
 */
async function calculateAbandonmentRate(sql, startDate, endDate) {
  try {
    // Count carts started (users who added items to cart or went to checkout)
    // We'll track this via a carts_analytics table or use orders table with status
    // For now, we'll use a simple approach: count distinct sessions/checkouts started
    
    // Count transactions completed (orders with status 'confirmed' or 'paid')
    const completedOrders = await sql`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ${startDate}
        AND created_at < ${endDate}
        AND status IN ('confirmed', 'paid', 'delivered')
    `;
    
    const completedCount = parseInt(completedOrders[0]?.count || 0, 10);
    
    // Count carts started (checkout attempts - orders created but may not be completed)
    // This includes all orders created, regardless of status
    const cartsStarted = await sql`
      SELECT COUNT(*) as count
      FROM orders
      WHERE created_at >= ${startDate}
        AND created_at < ${endDate}
    `;
    
    const startedCount = parseInt(cartsStarted[0]?.count || 0, 10);
    
    // Calculate abandonment rate
    let abandonmentRate = 0;
    if (startedCount > 0) {
      abandonmentRate = (startedCount - completedCount) / startedCount;
    }
    
    return {
      cartsStarted: startedCount,
      transactionsCompleted: completedCount,
      abandonmentRate: abandonmentRate * 100, // Convert to percentage
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('[Cart Abandonment] Error calculating rate:', error);
    throw error;
  }
}

/**
 * Send Slack alert for cart abandonment spike
 */
async function sendSlackAlert(alertData) {
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
    console.warn('[Cart Abandonment] SLACK_WEBHOOK_URL not configured, skipping alert');
    return false;
  }
  
  // Strip quotes if present
  webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
  
  // Get base URL for links
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const message = {
    text: `🚨 Cart Abandonment Rate Spike Detected`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 Cart Abandonment Rate Spike Detected`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Current Rate:*\n${alertData.currentRate.toFixed(1)}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Previous Rate:*\n${alertData.previousRate.toFixed(1)}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Increase:*\n+${alertData.increase.toFixed(1)}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n+15%`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Current Period:*\n${alertData.current.cartsStarted} carts started\n${alertData.current.transactionsCompleted} completed`,
          },
          {
            type: 'mrkdwn',
            text: `*Previous Period:*\n${alertData.previous.cartsStarted} carts started\n${alertData.previous.transactionsCompleted} completed`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⚠️ Alert:*\nCart abandonment rate increased by ${alertData.increase.toFixed(1)}% within 24 hours. This may indicate a critical bug in the checkout flow.`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*📋 Recommended Actions:*\n${alertData.actionableSteps.join('\n')}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🔗 Quick Links:*\n` +
                  `<${baseUrl}/api/monitoring/debug|View Debug Info>\n` +
                  `<${baseUrl}/api/checkout/create|Test Checkout Endpoint>\n` +
                  `<https://vercel.com/dashboard|Vercel Analytics>`
          },
        ],
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
      body: JSON.stringify(message),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Cart Abandonment] Failed to send Slack alert:', error);
    return false;
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
  
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Get database URL
    const databaseUrl = process.env.SPR_DATABASE_URL || 
                       process.env.NEON_DATABASE_URL || 
                       process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      return res.status(500).json({
        error: 'Database URL not configured',
        message: 'Set SPR_DATABASE_URL in environment variables',
      });
    }
    
    const sql = neon(databaseUrl);
    
    // Calculate rates for current 24h period and previous 24h period
    const now = new Date();
    const current24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const previous24hStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    console.log('[Cart Abandonment] Calculating rates...');
    const currentRate = await calculateAbandonmentRate(sql, current24hStart, now);
    const previousRate = await calculateAbandonmentRate(sql, previous24hStart, current24hStart);
    
    // Calculate increase
    const increase = currentRate.abandonmentRate - previousRate.abandonmentRate;
    
    const result = {
      timestamp: new Date().toISOString(),
      current: currentRate,
      previous: previousRate,
      increase: increase,
      threshold: ABANDONMENT_RATE_INCREASE_THRESHOLD * 100, // 15%
      status: increase >= (ABANDONMENT_RATE_INCREASE_THRESHOLD * 100) ? 'spike_detected' : 'normal',
    };
    
    // Send Slack alert if POST request and spike detected
    if (req.method === 'POST' && result.status === 'spike_detected') {
      await sendSlackAlert({
        currentRate: currentRate.abandonmentRate,
        previousRate: previousRate.abandonmentRate,
        increase: increase,
        current: currentRate,
        previous: previousRate,
        actionableSteps: [
          '1. *UX AUDIT:* Immediately try a full end-to-end checkout yourself (from Add to Cart to payment).',
          '2. *REVIEW LOGS:* Check Vercel logs for errors generated immediately after the customer clicks "Complete Order" but before the Square redirect.',
        ],
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Cart Abandonment] Error:', error);
    return res.status(500).json({
      error: 'Cart abandonment check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

