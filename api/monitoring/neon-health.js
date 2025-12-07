/**
 * Neon Database Health Monitoring Endpoint
 * 
 * Monitors Neon database health metrics:
 * - Connection pool usage
 * - Query latency (specifically SELECT products query)
 * 
 * This endpoint can be called periodically (e.g., via cron or monitoring service)
 * to check database health and send Slack alerts if thresholds are breached.
 * 
 * Usage:
 *   GET /api/monitoring/neon-health - Check current health status
 *   POST /api/monitoring/neon-health - Force a health check and alert if needed
 */

import { neon } from '@neondatabase/serverless';

// Alert thresholds
const CONNECTION_POOL_THRESHOLD = 0.80; // 80%
const QUERY_LATENCY_THRESHOLD_MS = 100; // 100ms

/**
 * Check connection pool usage
 * Note: Neon serverless doesn't expose direct connection pool metrics,
 * but we can estimate based on concurrent queries and connection limits
 */
async function checkConnectionPool(sql) {
  try {
    // Neon serverless uses connection pooling automatically
    // We can check active connections by querying pg_stat_activity
    const result = await sql`
      SELECT 
        count(*) as active_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
        AND state = 'active'
    `;
    
    if (result && result.length > 0) {
      const active = parseInt(result[0].active_connections) || 0;
      const max = parseInt(result[0].max_connections) || 100; // Default Neon limit
      const usage = active / max;
      
      return {
        active,
        max,
        usage,
        percentage: (usage * 100).toFixed(2),
        status: usage > CONNECTION_POOL_THRESHOLD ? 'critical' : 'healthy',
      };
    }
    
    return { error: 'Could not retrieve connection pool metrics' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Check query latency for SELECT products query
 */
async function checkQueryLatency(sql) {
  try {
    const startTime = Date.now();
    
    // Execute the actual products query to measure latency
    // This matches the query used in api/catalog/products.js
    const result = await sql`
      SELECT 
        id, 
        name, 
        price, 
        stock_count,
        category,
        image_url
      FROM products 
      WHERE stock_count > 0
      LIMIT 10
    `;
    
    const latency = Date.now() - startTime;
    
    return {
      latency,
      latencyMs: latency,
      status: latency > QUERY_LATENCY_THRESHOLD_MS ? 'slow' : 'healthy',
      rowsReturned: result?.length || 0,
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get immediate actions based on health data
 */
function getImmediateActions(alertData) {
  const actions = [];
  
  if (alertData.resource === 'Connection Pool' && parseFloat(alertData.currentValue) > 80) {
    actions.push('1. *IMMEDIATE SCALING:* **Increase the compute/connection limit** in the Neon console.');
    actions.push('2. *CODE AUDIT:* Verify every Vercel function correctly closes its database connection after use to free up resources.');
  }
  
  if (alertData.resource === 'Query Latency' && parseFloat(alertData.currentValue) > 100) {
    actions.push('1. *IDENTIFY QUERY:* Use the Neon console to find the exact slow query (e.g., the `SELECT catalog` query).');
    actions.push('2. *OPTIMIZATION:* Add a missing index (e.g., `CREATE INDEX`) on the column used for the `JOIN` or `WHERE` clause (e.g., `product_id`).');
    actions.push('3. *REWRITE:* If indexing doesn\'t help, rewrite the SQL query for efficiency.');
  }
  
  if (actions.length === 0) {
    return '1. *Continue Monitoring*: Daily checks will continue automatically\n2. *Review Logs*: Check Vercel logs for any warnings\n3. *Verify Configuration*: Ensure database settings are optimal';
  }
  
  return actions.join('\n');
}

/**
 * Send Slack alert for Neon health issues
 */
async function sendSlackAlert(alertData) {
  // Get SLACK_WEBHOOK_URL and strip quotes if present
  let webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
  }
  
  // Try to load from .env.local if running locally and variable not found
  if (!webhookUrl && process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const { config } = await import('dotenv');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const result = config({ path: join(__dirname, '../../.env.local') });
      if (result && !result.error) {
        webhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (webhookUrl) {
          webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
          console.log(`[Neon Health] Loaded SLACK_WEBHOOK_URL from .env.local via dotenv`);
        }
      }
    } catch (e) {
      console.error(`[Neon Health] Failed to load dotenv:`, e.message);
    }
  }
  
  if (!webhookUrl) {
    console.warn('[Neon Health] SLACK_WEBHOOK_URL not configured, skipping alert');
    return false;
  }
  
  const priority = alertData.priority === 'high' ? '🔴 HIGH PRIORITY' : '🟡 MEDIUM PRIORITY';
  const emoji = alertData.priority === 'high' ? '🚨' : '⚠️';
  
  // Build actionable steps based on alert type
  let actionableSteps = [];
  if (alertData.actionable && alertData.actionable.length > 0) {
    // Use provided actionable steps from alert data
    actionableSteps = alertData.actionable.map((step, index) => `${index + 1}. *${step}*`);
  } else if (alertData.resource === 'Connection Pool') {
    // Fallback if actionable steps not provided
    actionableSteps = [
      '1. *Check Neon Console*: Review active connections and query patterns',
      '2. *Scale Up*: Consider upgrading your Neon plan to increase connection limits',
      '3. *Optimize Connections*: Review connection pooling settings and close idle connections',
      '4. *Check for Leaks*: Ensure database connections are properly closed after use',
      '5. *Monitor Trends*: Check if this is a spike or sustained increase',
    ];
  } else if (alertData.resource === 'Query Latency') {
    actionableSteps = [
      '1. *Check Query Performance*: Review slow query logs in Neon Console',
      '2. *Add Indexes*: Ensure proper indexes exist on frequently queried columns',
      '3. *Optimize Query*: Review the SELECT products query for optimization opportunities',
      '4. *Check Database Load*: Verify if high connection usage is affecting query speed',
      '5. *Scale Compute*: Consider scaling up Neon compute resources if latency persists',
    ];
  }
  
  const message = {
    text: `${emoji} Neon Database Alert`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} Neon Database Alert`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${priority}`,
          },
          {
            type: 'mrkdwn',
            text: `*Resource:*\n${alertData.resource}`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Value:*\n${alertData.currentValue}`,
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n${alertData.threshold}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Alert:*\n${alertData.message}`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🚨 IMMEDIATE ACTION REQUIRED:*\n${getImmediateActions(alertData)}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🔗 Quick Links:*\n${alertData.resource === 'Connection Pool' 
              ? `<${alertData.links?.console || 'https://console.neon.tech'}|View Connection Pool Metrics>`
              : `<${alertData.links?.console || 'https://console.neon.tech'}|View Query Performance>`}\n<${alertData.links?.metrics || 'http://localhost:3000/api/monitoring/neon-health'}|View Full Health Status>`,
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
    console.error('[Neon Health] Failed to send Slack alert:', error);
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
  
  const databaseUrl = process.env.SPR_DATABASE_URL || 
                     process.env.NEON_DATABASE_URL || 
                     process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    return res.status(500).json({ 
      error: 'Database URL not configured',
      message: 'Set SPR_DATABASE_URL in environment variables',
    });
  }
  
  try {
    const sql = neon(databaseUrl);
    
    // Run health checks
    const [connectionPool, queryLatency] = await Promise.all([
      checkConnectionPool(sql),
      checkQueryLatency(sql),
    ]);
    
    // Get base URL for monitoring endpoint links
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      connectionPool,
      queryLatency,
      overall: 'healthy',
      alerts: [],
    };
    
    // Check for threshold breaches
    if (connectionPool.status === 'critical') {
      healthStatus.overall = 'degraded';
      healthStatus.alerts.push({
        priority: 'high',
        resource: 'Connection Pool',
        currentValue: `${connectionPool.percentage}% (${connectionPool.active}/${connectionPool.max} connections)`,
        threshold: `${(CONNECTION_POOL_THRESHOLD * 100).toFixed(0)}%`,
        message: `Neon Connections at ${connectionPool.percentage}% - Scale Up Required`,
        actionable: [
          'Check Neon Console for active connections and query patterns',
          'Consider upgrading Neon plan to increase connection limits',
          'Review connection pooling settings and close idle connections',
          'Verify database connections are properly closed after use',
        ],
        links: {
          console: 'https://console.neon.tech',
          metrics: `${baseUrl}/api/monitoring/neon-health`,
        },
      });
    }
    
    if (queryLatency.status === 'slow') {
      healthStatus.overall = 'degraded';
      healthStatus.alerts.push({
        priority: 'medium',
        resource: 'Query Latency',
        currentValue: `${queryLatency.latencyMs}ms`,
        threshold: `${QUERY_LATENCY_THRESHOLD_MS}ms`,
        message: `Average Query Time ${queryLatency.latencyMs}ms exceeds threshold (${QUERY_LATENCY_THRESHOLD_MS}ms)`,
        actionable: [
          'Review slow query logs in Neon Console',
          'Ensure proper indexes exist on frequently queried columns',
          'Optimize the SELECT products query for better performance',
          'Check if high connection usage is affecting query speed',
          'Consider scaling up Neon compute resources if latency persists',
        ],
        links: {
          console: 'https://console.neon.tech',
          metrics: `${baseUrl}/api/monitoring/neon-health`,
        },
      });
    }
    
    // Send Slack alerts if any issues detected
    if (req.method === 'POST' && healthStatus.alerts.length > 0) {
      for (const alert of healthStatus.alerts) {
        await sendSlackAlert(alert);
      }
    }
    
    return res.status(200).json(healthStatus);
  } catch (error) {
    console.error('[Neon Health] Error:', error);
    return res.status(500).json({
      error: 'Health check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

