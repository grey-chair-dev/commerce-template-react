/**
 * Email Service Provider (ESP) Health Check
 * 
 * Monitors email service provider status and deliverability.
 * Checks ESP status pages and sends Slack alerts if there are outages
 * or high bounce rates that could prevent order confirmation emails.
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (every 15 minutes)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/esp-health - Run check and send alerts if needed
 *   GET /api/monitoring/esp-health - Check status without alerts
 */

import { sendSlackAlert } from '../utils/slackAlerter.js';

// Supported ESPs and their status page URLs
const ESP_CONFIGS = {
  sendgrid: {
    name: 'SendGrid',
    statusPageUrl: 'https://status.sendgrid.com/api/v2/status.json',
    dashboardUrl: 'https://app.sendgrid.com',
    bounceRateThreshold: 5, // 5%
  },
  mailgun: {
    name: 'Mailgun',
    statusPageUrl: 'https://status.mailgun.com/api/v2/status.json',
    dashboardUrl: 'https://app.mailgun.com',
    bounceRateThreshold: 5,
  },
  ses: {
    name: 'AWS SES',
    statusPageUrl: 'https://status.aws.amazon.com/rss/ses-us-east-1.rss',
    dashboardUrl: 'https://console.aws.amazon.com/ses',
    bounceRateThreshold: 5,
  },
  resend: {
    name: 'Resend',
    statusPageUrl: 'https://status.resend.com/api/v2/status.json',
    dashboardUrl: 'https://resend.com/dashboard',
    bounceRateThreshold: 5,
  },
};

/**
 * Detect which ESP is being used based on environment variables
 */
function detectESP() {
  // Check for common ESP environment variables
  if (process.env.SENDGRID_API_KEY) {
    return 'sendgrid';
  }
  if (process.env.MAILGUN_API_KEY || process.env.MAILGUN_DOMAIN) {
    return 'mailgun';
  }
  if (process.env.AWS_SES_REGION || process.env.AWS_ACCESS_KEY_ID) {
    return 'ses';
  }
  if (process.env.RESEND_API_KEY) {
    return 'resend';
  }
  
  // Default to SendGrid if SENDGRID_API_KEY is set (common)
  return null;
}

/**
 * Check ESP status page
 */
async function checkESPStatus(espConfig) {
  try {
    const response = await fetch(espConfig.statusPageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Commerce-Template-Monitoring/1.0',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Status page returned ${response.status}`,
        status: 'unknown',
      };
    }
    
    const data = await response.json();
    
    // Parse status page response (handle different formats)
    const status = data.status?.indicator || 
                   data.page?.status?.indicator || 
                   'none';
    const description = data.status?.description || 
                       data.page?.status?.description || 
                       '';
    
    // Check for incidents
    const incidents = data.incidents || [];
    
    return {
      success: true,
      status: status.toLowerCase(), // 'none', 'minor', 'major', 'critical', 'maintenance'
      description,
      incidents,
      allIncidents: incidents.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        status: 'unknown',
      };
    }
    return {
      success: false,
      error: error.message,
      status: 'unknown',
      details: error.stack,
    };
  }
}

/**
 * Test ESP API connection (if API key is available)
 */
async function testESPAPI(espType) {
  const results = {
    success: false,
    error: null,
    details: null,
  };
  
  try {
    switch (espType) {
      case 'sendgrid':
        if (process.env.SENDGRID_API_KEY) {
          // Test SendGrid API with a simple request
          const sendgridResponse = await fetch('https://api.sendgrid.com/v3/user/profile', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          
          results.success = sendgridResponse.ok;
          if (!sendgridResponse.ok) {
            results.error = `SendGrid API returned ${sendgridResponse.status}`;
          }
        } else {
          results.error = 'SENDGRID_API_KEY not configured';
        }
        break;
        
      case 'mailgun':
        if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
          // Test Mailgun API
          const mailgunUrl = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}`;
          const mailgunAuth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64');
          
          const mailgunResponse = await fetch(mailgunUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${mailgunAuth}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          
          results.success = mailgunResponse.ok;
          if (!mailgunResponse.ok) {
            results.error = `Mailgun API returned ${mailgunResponse.status}`;
          }
        } else {
          results.error = 'MAILGUN_API_KEY or MAILGUN_DOMAIN not configured';
        }
        break;
        
      case 'resend':
        if (process.env.RESEND_API_KEY) {
          // Test Resend API
          const resendResponse = await fetch('https://api.resend.com/domains', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            },
            signal: AbortSignal.timeout(5000),
          });
          
          results.success = resendResponse.ok;
          if (!resendResponse.ok) {
            results.error = `Resend API returned ${resendResponse.status}`;
          }
        } else {
          results.error = 'RESEND_API_KEY not configured';
        }
        break;
        
      default:
        results.error = `ESP type ${espType} not supported for API testing`;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      results.error = 'API test timeout';
    } else {
      results.error = error.message;
    }
  }
  
  return results;
}

/**
 * Send Slack alert for ESP issues
 * Now uses centralized SlackAlerterService
 */
async function sendESPHealthAlert(alertData, espConfig) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const statusPageUrl = alertData.statusPage?.source && alertData.statusPage.source !== 'none'
    ? alertData.statusPage.source.replace('/api/v2/status.json', '')
    : null;
  
  const recommendedAction = [
    'PROACTIVE UPDATE: Immediately display a banner on your site informing customers of the issue (e.g., "Email confirmations are temporarily delayed")',
    'FULFILLMENT: If the email service is down, manually notify customers about their pickup status',
    statusPageUrl ? `CHECK STATUS: View ${espConfig.name} Status Page for current incidents` : 'CHECK STATUS: Review ESP status',
    'REVIEW LOGS: Check Vercel logs for /api/monitoring/esp-health',
    'VERIFY CREDENTIALS: Ensure API keys/domains are valid',
    '⚠️ Critical Impact: Order confirmation emails may not be delivered. Customers won\'t receive pickup instructions.',
  ];
  
  const links = {
    'View Debug Info': `${baseUrl}/api/monitoring/debug`,
    [`${espConfig.name} Dashboard`]: espConfig.dashboardUrl,
  };
  
  if (statusPageUrl) {
    links[`${espConfig.name} Status Page`] = statusPageUrl;
  }
  
  return await sendSlackAlert({
    priority: alertData.priority || 'medium',
    route: '/api/monitoring/esp-health',
    title: `${espConfig.name} Health Alert`,
    message: alertData.message,
    context: `*Status:* ${alertData.status}\n*Source:* ${alertData.source}\n*ESP:* ${espConfig.name}`,
    recommendedAction,
    fields: {
      'Status': alertData.status,
      'Source': alertData.source,
      'ESP': espConfig.name,
    },
    links,
    metadata: {
      incidents: alertData.incidents,
    },
  });
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
    // Detect which ESP is being used
    const espType = detectESP();
    
    if (!espType) {
      return res.status(200).json({
        timestamp: new Date().toISOString(),
        esp: 'none_detected',
        message: 'No ESP detected. Configure SENDGRID_API_KEY, MAILGUN_API_KEY, RESEND_API_KEY, or AWS SES credentials.',
        note: 'Email service provider monitoring requires ESP credentials to be configured.',
      });
    }
    
    const espConfig = ESP_CONFIGS[espType];
    if (!espConfig) {
      return res.status(500).json({
        error: 'ESP configuration not found',
        espType,
      });
    }
    
    // Check ESP status page
    console.log(`[ESP Health] Checking ${espConfig.name} status page...`);
    const statusCheck = await checkESPStatus(espConfig);
    
    // Test ESP API directly if credentials are available
    console.log(`[ESP Health] Testing ${espConfig.name} API...`);
    const apiTest = await testESPAPI(espType);
    
    // Determine if we need to alert
    const alerts = [];
    
    // Check status page results
    if (statusCheck.success && (statusCheck.status === 'critical' || statusCheck.status === 'major')) {
      alerts.push({
        priority: statusCheck.status === 'critical' ? 'critical' : 'major',
        status: statusCheck.status,
        source: `${espConfig.name} Status Page`,
        message: `${espConfig.name} Status: ${statusCheck.status.toUpperCase()} - ${statusCheck.description || 'Service degradation detected'}`,
        incidents: statusCheck.incidents || [],
        actionableSteps: [
          `Check ${espConfig.name} Status Page: Review current incidents and estimated resolution time`,
          'Display Maintenance Message: Consider showing a maintenance banner on your site',
          'Monitor Closely: Watch for updates from the ESP',
          'Check API Test Results: Review direct API test results below',
          'Contact Support: If critical, contact ESP support for ETA',
          '⚠️ Critical: Order confirmation emails may not be delivered',
        ],
      });
    } else if (statusCheck.success && statusCheck.incidents && statusCheck.incidents.length > 0) {
      // Even if status is minor, alert about incidents
      alerts.push({
        priority: 'minor',
        status: 'minor',
        source: `${espConfig.name} Status Page`,
        message: `${espConfig.name}: ${statusCheck.incidents.length} incident(s) detected`,
        incidents: statusCheck.incidents,
        actionableSteps: [
          `Monitor ${espConfig.name} Status Page: Keep an eye on status updates`,
          'Review Incidents: Check the incident details below',
          'Test API: Verify your ESP API calls are still working',
          'Prepare Contingency: Be ready to display maintenance message if status worsens',
        ],
      });
    }
    
    // Check API test results
    if (!apiTest.success) {
      alerts.push({
        priority: 'major',
        status: 'api_failure',
        source: 'Direct API Test',
        message: `${espConfig.name} API Test Failed: ${apiTest.error}`,
        actionableSteps: [
          'Verify Credentials: Check your ESP API key/credentials',
          `Check ${espConfig.name} Status: Review status page for known issues`,
          'Test Manually: Try calling ESP API directly to confirm',
          'Review Error Details: Check the API test results below',
          'Contact Support: If credentials are correct, contact ESP support',
          '⚠️ Critical: Order confirmation emails cannot be sent',
        ],
      });
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      esp: espType,
      espName: espConfig.name,
      statusCheck,
      apiTest,
      alerts: alerts.length,
      alertsList: alerts,
      overall: alerts.length > 0 ? 'degraded' : 'healthy',
    };
    
    // Send Slack alerts if POST request and alerts exist
    if (req.method === 'POST' && alerts.length > 0) {
      for (const alert of alerts) {
        await sendESPHealthAlert(alert, espConfig);
      }
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[ESP Health] Error:', error);
    return res.status(500).json({
      error: 'ESP health check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

