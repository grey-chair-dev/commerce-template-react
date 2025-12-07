/**
 * Custom Slack Alert Webhook Handler
 * 
 * This endpoint sends formatted error alerts to Slack.
 * Called by webhook functions when 5xx errors occur.
 * 
 * Usage: POST /api/webhooks/slack-alert
 * Body: { route, errorId, timestamp, errorMessage, statusCode }
 * 
 * Environment Variables:
 * - SLACK_WEBHOOK_URL: Your Slack incoming webhook URL
 *   Should be in .env.local for local dev, or Vercel Dashboard for production
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { route, errorId, timestamp, errorMessage, statusCode, details } = req.body;

  // Debug: Log environment source (for troubleshooting)
  const isVercel = !!process.env.VERCEL;
  const isProduction = process.env.NODE_ENV === 'production';
  const envSource = isVercel ? 'Vercel Dashboard' : (isProduction ? 'Production' : '.env.local');
  
  // Get base URL for links
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  // Determine Vercel project name (from URL or environment)
  const vercelProject = process.env.VERCEL_PROJECT_NAME || 'commerce-template-react';
  
  // Build immediate actions based on route and status code
  const getImmediateActions = () => {
    if (route === '/api/webhooks/square-order-paid' && statusCode >= 500) {
      return '1. *IMMEDIATE CHECK:* Log into the **Square Dashboard** to find the order ID in the alert.\n2. *MANUAL FIX:* Manually insert that order\'s details into the **Neon `orders` and `order_items` tables**.\n3. *CODE REVIEW:* Check Vercel logs for the specific error (e.g., SQL syntax error, database connection failure) and push a fix immediately.';
    }
    
    if (route === '/api/webhooks/square-inventory' && statusCode >= 500) {
      return '1. *IDENTIFY SKU:* Use the Square webhook payload in the Vercel logs to find the SKU that triggered the failure.\n2. *MANUAL FIX:* Log into **Neon** and manually update the `stock_count` for that one SKU to match Square.\n3. *CODE REVIEW:* Review the Vercel function logic for the specific error (e.g., failed database connection, invalid payload data).';
    }
    
    if (statusCode === 403) {
      return '1. *VERIFY KEY:* In Vercel environment variables, re-paste the `SQUARE_SIGNATURE_KEY` from the Square Developer Dashboard.\n2. *REVIEW FIREWALL/WAF:* If you have any firewall (WAF) running in front of Vercel, check if it\'s incorrectly blocking Square\'s IP addresses.';
    }
    
    return '1. *CHECK LOGS:* Review Vercel logs for detailed error information.\n2. *VERIFY CONFIG:* Check environment variables and service configuration.\n3. *TEST ENDPOINT:* Manually test the endpoint to reproduce the issue.';
  };
  
  // Build error context
  const getErrorContext = () => {
    if (errorMessage?.includes('signature') || errorMessage?.includes('authentication')) {
      return '🔐 *Authentication Error*: Webhook signature verification failed. Check signature key configuration.';
    }
    if (errorMessage?.includes('database') || errorMessage?.includes('connection')) {
      return '💾 *Database Error*: Database connection or query failed. Check database URL and connectivity.';
    }
    if (errorMessage?.includes('timeout')) {
      return '⏱️ *Timeout Error*: Request exceeded maximum duration. Consider optimizing queries or increasing timeout.';
    }
    return '❌ *General Error*: Review error details and check system configuration.';
  };
  
  // Get SLACK_WEBHOOK_URL and strip quotes if present (common in .env files)
  let slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhookUrl) {
    slackWebhookUrl = slackWebhookUrl.trim().replace(/^["']|["']$/g, '');
  }
  
  // Try to load from .env.local if running locally and variable not found
  if (!slackWebhookUrl && !isVercel && process.env.NODE_ENV !== 'production') {
    try {
      const { config } = await import('dotenv');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const result = config({ path: join(__dirname, '../../.env.local') });
      if (result && !result.error) {
        slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
        if (slackWebhookUrl) {
          slackWebhookUrl = slackWebhookUrl.trim().replace(/^["']|["']$/g, '');
          console.log(`[Slack Alert] Loaded SLACK_WEBHOOK_URL from .env.local via dotenv`);
        }
      }
    } catch (e) {
      console.error(`[Slack Alert] Failed to load dotenv:`, e.message);
    }
  }
  
  if (!slackWebhookUrl) {
    console.error(`[Slack Alert] SLACK_WEBHOOK_URL not configured (reading from: ${envSource})`);
    console.error(`[Slack Alert] Environment check: VERCEL=${isVercel}, NODE_ENV=${process.env.NODE_ENV}`);
    const slackVars = Object.keys(process.env).filter(k => k.includes('SLACK') || k.includes('WEBHOOK'));
    console.error(`[Slack Alert] Available env vars:`, slackVars.length > 0 ? slackVars.join(', ') : 'none');
    return res.status(500).json({ 
      error: 'Slack webhook not configured',
      details: `Expected SLACK_WEBHOOK_URL in ${envSource}. Make sure it's set and restart 'vercel dev' if running locally.`
    });
  }
  
  // Log successful configuration (only in development for debugging)
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Slack Alert] Configuration loaded from: ${envSource}`);
  }

  const immediateActions = getImmediateActions();
  const errorContext = getErrorContext();
  
  const message = {
    text: `🚨 Critical Webhook Error - ${route}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Critical Webhook Error',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Route:*\n\`${route}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Status Code:*\n\`${statusCode}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n${timestamp || new Date().toISOString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Error ID:*\n\`${errorId}\``,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: errorContext,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n\`\`\`${errorMessage || 'No error message provided'}\`\`\``,
        },
      },
      ...(details ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Additional Details:*\n\`\`\`${typeof details === 'string' ? details : JSON.stringify(details, null, 2)}\`\`\``,
        },
      }] : []),
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🚨 IMMEDIATE ACTION REQUIRED:*\n${immediateActions}`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🔗 Quick Links:*\n<https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/logs?query=${encodeURIComponent(errorId)}|View Vercel Logs (Error ID: ${errorId})>\n<${baseUrl}${route}|Test Endpoint>\n<https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/settings/environment-variables|Check Environment Variables>`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Error ID: \`${errorId}\` | Timestamp: ${timestamp || new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Slack Alert] Failed to send alert:', error);
    return res.status(500).json({ error: 'Failed to send Slack alert' });
  }
}

