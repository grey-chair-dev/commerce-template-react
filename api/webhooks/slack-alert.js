/**
 * Custom Slack Alert Webhook Handler
 * 
 * This endpoint sends formatted error alerts to Slack.
 * Called by webhook functions when 5xx errors occur.
 * Now uses the centralized SlackAlerterService for consistent formatting.
 * 
 * Usage: POST /api/webhooks/slack-alert
 * Body: { route, errorId, timestamp, errorMessage, statusCode, details }
 * 
 * Environment Variables:
 * - SLACK_WEBHOOK_URL: Your Slack incoming webhook URL
 *   Should be in .env.local for local dev, or Vercel Dashboard for production
 */

import { sendSlackAlert } from '../utils/slackAlerter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { route, errorId, timestamp, errorMessage, statusCode, details } = req.body;

  if (!route || !errorMessage) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: 'route and errorMessage are required'
    });
  }

  // Build error context
  let errorContext = '❌ *General Error*: Review error details and check system configuration.';
  if (errorMessage?.includes('signature') || errorMessage?.includes('authentication')) {
    errorContext = '🔐 *Authentication Error*: Webhook signature verification failed. Check signature key configuration.';
  } else if (errorMessage?.includes('database') || errorMessage?.includes('connection')) {
    errorContext = '💾 *Database Error*: Database connection or query failed. Check database URL and connectivity.';
  } else if (errorMessage?.includes('timeout')) {
    errorContext = '⏱️ *Timeout Error*: Request exceeded maximum duration. Consider optimizing queries or increasing timeout.';
  }
  
  // Build recommended actions based on route and status code
  const recommendedAction = [];
  if (route === '/api/webhooks/square-order-paid' && statusCode >= 500) {
    recommendedAction.push(
      'IMMEDIATE CHECK: Log into the Square Dashboard to find the order ID in the alert',
      'MANUAL FIX: Manually insert that order\'s details into the Neon `orders` and `order_items` tables',
      'CODE REVIEW: Check Vercel logs for the specific error (e.g., SQL syntax error, database connection failure) and push a fix immediately'
    );
  } else if (route === '/api/webhooks/square-inventory' && statusCode >= 500) {
    recommendedAction.push(
      'IDENTIFY SKU: Use the Square webhook payload in the Vercel logs to find the SKU that triggered the failure',
      'MANUAL FIX: Log into Neon and manually update the `stock_count` for that one SKU to match Square',
      'CODE REVIEW: Review the Vercel function logic for the specific error (e.g., failed database connection, invalid payload data)'
    );
  } else if (statusCode === 403) {
    recommendedAction.push(
      'VERIFY KEY: In Vercel environment variables, re-paste the `SQUARE_SIGNATURE_KEY` from the Square Developer Dashboard',
      'REVIEW FIREWALL/WAF: If you have any firewall (WAF) running in front of Vercel, check if it\'s incorrectly blocking Square\'s IP addresses'
    );
  } else {
    recommendedAction.push(
      'CHECK LOGS: Review Vercel logs for detailed error information',
      'VERIFY CONFIG: Check environment variables and service configuration',
      'TEST ENDPOINT: Manually test the endpoint to reproduce the issue'
    );
  }

  // Determine priority based on status code
  let priority = 'medium';
  if (statusCode >= 500) {
    priority = 'critical';
  } else if (statusCode === 403) {
    priority = 'high';
  }

  // Build fields
  const fields = {
    'Status Code': String(statusCode),
  };
  if (errorId) {
    fields['Error ID'] = errorId;
  }

  // Build links
  const vercelProject = process.env.VERCEL_PROJECT_NAME || 'commerce-template-react';
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const links = {
    'View Vercel Logs': `https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/logs?query=${encodeURIComponent(errorId || 'error')}`,
    'Test Endpoint': `${baseUrl}${route}`,
    'Check Environment Variables': `https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/settings/environment-variables`,
  };

  // Use centralized Slack alerting service
  const success = await sendSlackAlert({
    priority,
    errorId,
    route,
    title: 'Critical Webhook Error',
    message: errorMessage,
    context: errorContext,
    recommendedAction,
    fields,
    links,
    ...(details && { metadata: { details } }),
  });

  if (success) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(500).json({ 
      error: 'Failed to send Slack alert',
      details: 'SLACK_WEBHOOK_URL may not be configured. Check environment variables.'
    });
  }
}

