/**
 * Centralized Slack Alerting Service
 * 
 * Provides a standardized way to send alerts to Slack across all webhook handlers
 * and monitoring functions.
 * 
 * Usage:
 *   import { sendSlackAlert } from '../utils/slackAlerter.js';
 *   
 *   await sendSlackAlert({
 *     priority: 'critical',
 *     errorId: 'err_123',
 *     route: '/api/webhooks/square-order-paid',
 *     title: 'Order Processing Failed',
 *     message: 'Failed to process order payment',
 *     context: 'Database connection timeout',
 *     recommendedAction: [
 *       'Check database connectivity',
 *       'Review Vercel logs for details',
 *       'Verify Square webhook configuration'
 *     ],
 *     fields: {
 *       'Order ID': 'ORD-123',
 *       'Status Code': '500'
 *     },
 *     links: {
 *       'View Logs': 'https://vercel.com/...',
 *       'Square Dashboard': 'https://developer.squareup.com'
 *     }
 *   });
 */

/**
 * Standard alert payload interface
 * @typedef {Object} SlackAlertPayload
 * @property {string} priority - 'critical' | 'high' | 'medium' | 'low'
 * @property {string} [errorId] - Unique error identifier for log correlation
 * @property {string} route - API route or endpoint where alert originated
 * @property {string} title - Alert title/header
 * @property {string} message - Main alert message
 * @property {string} [context] - Additional context about the alert
 * @property {string[]} [recommendedAction] - Array of actionable steps
 * @property {Object<string, string>} [fields] - Key-value pairs for additional fields
 * @property {Object<string, string>} [links] - Key-value pairs for quick links (label -> URL)
 * @property {Object} [metadata] - Additional metadata (incidents, apiTests, etc.)
 */

/**
 * Get Slack webhook URL from environment
 * Handles .env.local loading for local development
 */
async function getSlackWebhookUrl() {
  let webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (webhookUrl) {
    webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
  }
  
  // Try to load from .env.local if running locally and variable not found
  if (!webhookUrl && !process.env.VERCEL && process.env.NODE_ENV !== 'production') {
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
        }
      }
    } catch (e) {
      // dotenv not available or failed to load
      // Note: import.meta.url may not work in Jest, but this is fine - 
      // the service will work in production/Vercel where it's needed
    }
  }
  
  return webhookUrl;
}

/**
 * Get base URL for links
 */
function getBaseUrl() {
  return process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

/**
 * Format priority for display
 */
function formatPriority(priority) {
  const priorityMap = {
    critical: { emoji: '🔴', label: 'CRITICAL' },
    high: { emoji: '🔴', label: 'HIGH PRIORITY' },
    medium: { emoji: '🟡', label: 'MEDIUM PRIORITY' },
    low: { emoji: '🟢', label: 'LOW PRIORITY' },
  };
  
  return priorityMap[priority] || priorityMap.medium;
}

/**
 * Build Slack message blocks from alert payload
 */
function buildSlackBlocks(payload) {
  const { priority, errorId, route, title, message, context, recommendedAction, fields, links, metadata } = payload;
  const priorityInfo = formatPriority(priority);
  const emoji = priorityInfo.emoji;
  const priorityLabel = priorityInfo.label;
  
  const blocks = [];
  
  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: `${emoji} ${title}`,
      emoji: true,
    },
  });
  
  // Main fields section
  const mainFields = [
    {
      type: 'mrkdwn',
      text: `*Priority:*\n${priorityLabel}`,
    },
    {
      type: 'mrkdwn',
      text: `*Route:*\n\`${route}\``,
    },
  ];
  
  if (errorId) {
    mainFields.push({
      type: 'mrkdwn',
      text: `*Error ID:*\n\`${errorId}\``,
    });
  }
  
  mainFields.push({
    type: 'mrkdwn',
    text: `*Timestamp:*\n${new Date().toISOString()}`,
  });
  
  blocks.push({
    type: 'section',
    fields: mainFields,
  });
  
  // Context section (if provided)
  if (context) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: context,
      },
    });
  }
  
  // Message section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Alert:*\n${message}`,
    },
  });
  
  // Additional fields (if provided)
  if (fields && Object.keys(fields).length > 0) {
    const fieldEntries = Object.entries(fields);
    const fieldBlocks = [];
    
    for (let i = 0; i < fieldEntries.length; i += 2) {
      const field1 = fieldEntries[i];
      const field2 = fieldEntries[i + 1];
      
      const fieldSection = {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${field1[0]}:*\n${field1[1]}`,
          },
        ],
      };
      
      if (field2) {
        fieldSection.fields.push({
          type: 'mrkdwn',
          text: `*${field2[0]}:*\n${field2[1]}`,
        });
      }
      
      fieldBlocks.push(fieldSection);
    }
    
    blocks.push(...fieldBlocks);
  }
  
  // Metadata sections (for monitoring-specific data)
  if (metadata) {
    // Incidents (for Square/ESP health)
    if (metadata.incidents && Array.isArray(metadata.incidents) && metadata.incidents.length > 0) {
      const incidentText = metadata.incidents.slice(0, 5).map((incident, i) => {
        const name = incident.name || 'Unknown Incident';
        const status = incident.status || 'investigating';
        const impact = incident.impact || 'unknown';
        return `${i + 1}. *${name}*\n   Status: ${status} | Impact: ${impact}`;
      }).join('\n\n');
      
      let incidentTextFormatted = incidentText;
      if (metadata.incidents.length > 5) {
        incidentTextFormatted += `\n\n...and ${metadata.incidents.length - 5} more incidents`;
      }
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📋 Relevant Incidents:*\n${incidentTextFormatted}`,
        },
      });
    }
    
    // API test results (for Square health)
    if (metadata.apiTests) {
      const tests = metadata.apiTests;
      const apiTestText = `*Catalog API:* ${tests.catalog?.success ? '✅' : '❌'} ${tests.catalog?.error || 'OK'}\n` +
                          `*Inventory API:* ${tests.inventory?.success ? '✅' : '❌'} ${tests.inventory?.error || 'OK'}\n` +
                          `*Orders API:* ${tests.orders?.success ? '✅' : '❌'} ${tests.orders?.error || 'OK'}`;
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🧪 API Test Results:*\n${apiTestText}`,
        },
      });
    }
    
    // Mismatches list (for inventory sync)
    if (metadata.mismatches && Array.isArray(metadata.mismatches) && metadata.mismatches.length > 0) {
      let mismatchText = metadata.mismatches.slice(0, 20).map((m, i) => {
        return `${i + 1}. *${m.name}* (SKU: \`${m.square_variation_id}\`)\n   Square: ${m.square_count} | Neon: ${m.neon_count} | Diff: ${m.difference > 0 ? '+' : ''}${m.difference}`;
      }).join('\n\n');
      
      if (metadata.mismatches.length > 20) {
        mismatchText += `\n\n...and ${metadata.mismatches.length - 20} more mismatches`;
      }
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📋 Mismatched Items:*\n${mismatchText}`,
        },
      });
    }
    
    // Missing orders list (for order reconciliation)
    if (metadata.missingOrders && Array.isArray(metadata.missingOrders) && metadata.missingOrders.length > 0) {
      let missingOrdersText = metadata.missingOrders.slice(0, 20).map((order, i) => {
        const amount = (order.total_amount / 100).toFixed(2);
        return `${i + 1}. *${order.order_number}* (Square ID: \`${order.square_order_id}\`)\n   Amount: $${amount} ${order.currency} | Date: ${new Date(order.created_at).toLocaleDateString()}`;
      }).join('\n\n');
      
      if (metadata.missingOrders.length > 20) {
        missingOrdersText += `\n\n...and ${metadata.missingOrders.length - 20} more missing orders`;
      }
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📋 Missing Orders (Paid in Square, Missing in Neon):*\n${missingOrdersText}`,
        },
      });
    }
  }
  
  // Recommended actions section
  if (recommendedAction && recommendedAction.length > 0) {
    const actionsText = recommendedAction.map((action, index) => {
      return `${index + 1}. *${action}*`;
    }).join('\n');
    
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*🚨 IMMEDIATE ACTION REQUIRED:*\n${actionsText}`,
        },
      ],
    });
  }
  
  // Links section
  if (links && Object.keys(links).length > 0) {
    const baseUrl = getBaseUrl();
    const vercelProject = process.env.VERCEL_PROJECT_NAME || 'commerce-template-react';
    
    let linksText = '';
    
    // Add standard links based on route
    if (route.includes('webhook')) {
      const errorIdForLink = errorId || 'error';
      linksText += `<https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/logs?query=${encodeURIComponent(errorIdForLink)}|View Vercel Logs>\n`;
      linksText += `<${baseUrl}${route}|Test Endpoint>\n`;
      linksText += `<https://vercel.com/${process.env.VERCEL_TEAM_SLUG || 'dashboard'}/${vercelProject}/settings/environment-variables|Check Environment Variables>\n`;
    }
    
    // Add custom links
    Object.entries(links).forEach(([label, url]) => {
      linksText += `<${url}|${label}>\n`;
    });
    
    if (linksText) {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*🔗 Quick Links:*\n${linksText.trim()}`,
          },
        ],
      });
    }
  }
  
  // Footer context
  const contextElements = [];
  if (errorId) {
    contextElements.push({
      type: 'mrkdwn',
      text: `Error ID: \`${errorId}\``,
    });
  }
  contextElements.push({
    type: 'mrkdwn',
    text: `Timestamp: ${new Date().toISOString()}`,
  });
  
  blocks.push({
    type: 'context',
    elements: contextElements,
  });
  
  return blocks;
}

/**
 * Send Slack alert
 * 
 * @param {SlackAlertPayload} payload - Standard alert payload
 * @returns {Promise<boolean>} - True if alert was sent successfully
 */
export async function sendSlackAlert(payload) {
  const { priority = 'medium', route, title, message } = payload;
  
  // Validate required fields
  if (!route || !title || !message) {
    console.error('[Slack Alerter] Missing required fields:', { route, title, message });
    return false;
  }
  
  // Get webhook URL
  const webhookUrl = await getSlackWebhookUrl();
  
  if (!webhookUrl) {
    console.warn(`[Slack Alerter] SLACK_WEBHOOK_URL not configured, skipping alert for ${route}`);
    return false;
  }
  
  // Build Slack message
  const blocks = buildSlackBlocks(payload);
  
  const slackMessage = {
    text: `${formatPriority(priority).emoji} ${title}`,
    blocks,
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });
    
    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error(`[Slack Alerter] Failed to send alert for ${route}:`, error);
    return false;
  }
}

/**
 * Send alert via the webhook endpoint (for backward compatibility)
 * This allows existing code to call the webhook endpoint which will use this service
 */
export async function sendSlackAlertViaWebhook(payload) {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/webhooks/slack-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Slack Alerter] Failed to send alert via webhook:', error);
    return false;
  }
}
