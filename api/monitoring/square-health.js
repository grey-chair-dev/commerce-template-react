/**
 * Square API Health Check
 * 
 * Monitors Square's public status and API availability.
 * Checks Square's status page and sends Slack alerts if there are outages
 * or degraded performance on Catalog, Inventory, or Checkout APIs.
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (every 15 minutes)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/square-health - Run check and send alerts if needed
 *   GET /api/monitoring/square-health - Check status without alerts
 */

import { sendSlackAlert } from '../utils/slackAlerter.js';

/**
 * Fetch Square status from their status page
 * Square uses status.squareup.com for status updates
 */
async function checkSquareStatus() {
  try {
    // Square's status page - try multiple possible endpoints
    const statusPageUrls = [
      'https://status.squareup.com/api/v2/status.json',
      'https://issquareup.com/api/v2/status.json',
      'https://status.squareup.com/api/v2/summary.json',
    ];
    
    let data = null;
    let lastError = null;
    
    // Try each URL until one works
    for (const url of statusPageUrls) {
      try {
        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Commerce-Template-Monitoring/1.0',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          data = await response.json();
          break; // Success, exit loop
        }
      } catch (error) {
        lastError = error;
        continue; // Try next URL
      }
    }
    
    if (!data) {
      // If no status page API works, return unknown but don't fail
      return {
        success: false,
        error: lastError?.message || 'Could not reach Square status page',
        status: 'unknown',
        note: 'Square status page API may not be publicly available. Relying on direct API tests.',
      };
    }
    
    // Parse status page response (handle different formats)
    const status = data.status?.indicator || 
                   data.page?.status?.indicator || 
                   data.page?.status?.indicator || 
                   'none';
    const description = data.status?.description || 
                       data.page?.status?.description || 
                       '';
    
    // Check for incidents affecting our APIs
    const incidents = data.incidents || [];
    const scheduledMaintenances = data.scheduled_maintenances || [];
    
    // Filter for incidents affecting Catalog, Inventory, or Checkout APIs
    const relevantIncidents = incidents.filter(incident => {
      const name = (incident.name || '').toLowerCase();
      const impact = (incident.impact || '').toLowerCase();
      const components = (incident.components || []).map(c => (c.name || '').toLowerCase()).join(' ');
      return name.includes('catalog') || 
             name.includes('inventory') || 
             name.includes('checkout') ||
             name.includes('orders') ||
             name.includes('payments') ||
             name.includes('api') ||
             components.includes('catalog') ||
             components.includes('inventory') ||
             components.includes('checkout') ||
             components.includes('orders') ||
             components.includes('payments') ||
             impact === 'major' ||
             impact === 'critical';
    });
    
    return {
      success: true,
      status: status.toLowerCase(), // 'none', 'minor', 'major', 'critical', 'maintenance'
      description,
      incidents: relevantIncidents,
      scheduledMaintenances: scheduledMaintenances.filter(m => {
        const name = (m.name || '').toLowerCase();
        return name.includes('catalog') || 
               name.includes('inventory') || 
               name.includes('checkout') ||
               name.includes('orders') ||
               name.includes('payments');
      }),
      allIncidents: incidents.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: 'unknown',
      details: error.stack,
    };
  }
}

/**
 * Test Square API endpoints directly
 */
async function testSquareAPIs(squareClient) {
  const results = {
    catalog: { success: false, error: null },
    inventory: { success: false, error: null },
    orders: { success: false, error: null },
  };
  
  try {
    // Test Catalog API
    try {
      const catalogResponse = await squareClient.catalog.list({ types: ['ITEM'], limit: 1 });
      results.catalog.success = !!(catalogResponse.result);
      if (!results.catalog.success) {
        results.catalog.error = 'No result returned';
      }
    } catch (error) {
      results.catalog.error = error.message;
    }
    
    // Test Inventory API (via batchGetCounts with empty array)
    try {
      const inventoryResponse = await squareClient.inventory.batchGetCounts({
        catalogObjectIds: [],
        locationIds: [process.env.SQUARE_LOCATION_ID],
      });
      // Even with empty array, if API is working, we get a response
      results.inventory.success = true;
    } catch (error) {
      results.inventory.error = error.message;
    }
    
    // Test Orders API (via locations list as a proxy)
    try {
      const locationsResponse = await squareClient.locations.list();
      results.orders.success = !!(locationsResponse.result);
      if (!results.orders.success) {
        results.orders.error = 'No result returned';
      }
    } catch (error) {
      results.orders.error = error.message;
    }
  } catch (error) {
    // Overall error
    results.error = error.message;
  }
  
  return results;
}

/**
 * Send Slack alert for Square API issues
 * Now uses centralized SlackAlerterService
 */
async function sendSquareHealthAlert(alertData) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const recommendedAction = [
    'PROACTIVE UPDATE: Immediately display a banner on your site informing customers of the issue (e.g., "Payments are temporarily disabled due to a service provider issue")',
    'CHECK STATUS: View Square Status Page for current incidents',
    'REVIEW LOGS: Check Vercel logs for /api/monitoring/square-health',
    'VERIFY CREDENTIALS: Ensure SQUARE_ACCESS_TOKEN is valid',
  ];
  
  return await sendSlackAlert({
    priority: alertData.priority || 'medium',
    route: '/api/monitoring/square-health',
    title: 'Square API Health Alert',
    message: alertData.message,
    context: `*Status:* ${alertData.status}\n*Source:* ${alertData.source}`,
    recommendedAction,
    fields: {
      'Status': alertData.status,
      'Source': alertData.source,
        },
    links: {
      'Square Status Page': 'https://status.squareup.com',
      'View Debug Info': `${baseUrl}/api/monitoring/debug`,
      'Square Dashboard': 'https://developer.squareup.com/apps',
      },
    metadata: {
      incidents: alertData.incidents,
      apiTests: alertData.apiTests,
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
    // Get Square credentials for API testing
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
    const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();
    
    // Check Square status page
    console.log('[Square Health] Checking Square status page...');
    const statusCheck = await checkSquareStatus();
    
    // Test Square APIs directly if credentials are available
    let apiTests = null;
    if (squareAccessToken && squareLocationId) {
      try {
        const { SquareClient, SquareEnvironment } = await import('square');
        const squareClient = new SquareClient({
          token: squareAccessToken,
          environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
        });
        
        console.log('[Square Health] Testing Square APIs directly...');
        apiTests = await testSquareAPIs(squareClient);
      } catch (error) {
        console.warn('[Square Health] Could not test Square APIs:', error.message);
      }
    }
    
    // Determine if we need to alert
    const alerts = [];
    const status = statusCheck.status || 'unknown';
    
    // Only alert on status page if we successfully retrieved it
    if (statusCheck.success && (status === 'critical' || status === 'major')) {
      alerts.push({
        priority: status === 'critical' ? 'critical' : 'major',
        status,
        source: 'Square Status Page',
        message: `Square API Status: ${status.toUpperCase()} - ${statusCheck.description || 'Service degradation detected'}`,
        incidents: statusCheck.incidents || [],
        actionableSteps: [
          'Check Square Status Page: Review current incidents and estimated resolution time',
          'Display Maintenance Message: Consider showing a maintenance banner on your site',
          'Monitor Closely: Watch for updates from Square on status.squareup.com',
          'Check API Test Results: Review direct API test results below',
          'Contact Support: If critical, contact Square support for ETA',
        ],
      });
    } else if (statusCheck.success && statusCheck.incidents && statusCheck.incidents.length > 0) {
      // Even if status is minor, alert about relevant incidents
      alerts.push({
        priority: 'minor',
        status: 'minor',
        source: 'Square Status Page',
        message: `Square API: ${statusCheck.incidents.length} relevant incident(s) detected`,
        incidents: statusCheck.incidents,
        actionableSteps: [
          'Monitor Status Page: Keep an eye on status.squareup.com for updates',
          'Review Incidents: Check the incident details below',
          'Test APIs: Verify your Square API calls are still working',
          'Prepare Contingency: Be ready to display maintenance message if status worsens',
        ],
      });
    }
    
    // Check API test results
    if (apiTests) {
      const failedAPIs = [];
      if (!apiTests.catalog.success) failedAPIs.push('Catalog');
      if (!apiTests.inventory.success) failedAPIs.push('Inventory');
      if (!apiTests.orders.success) failedAPIs.push('Orders');
      
      if (failedAPIs.length > 0) {
        alerts.push({
          priority: 'major',
          status: 'api_failure',
          source: 'Direct API Tests',
          message: `Square API Test Failures: ${failedAPIs.join(', ')} APIs are not responding`,
          apiTests,
          actionableSteps: [
            'Verify Credentials: Check SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID',
            'Check Square Status: Review status.squareup.com for known issues',
            'Test Manually: Try calling Square APIs directly to confirm',
            'Review Error Details: Check the API test results below for specific errors',
            'Contact Support: If credentials are correct, contact Square support',
          ],
        });
      }
    }
    
    const result = {
      timestamp: new Date().toISOString(),
      statusCheck,
      apiTests,
      alerts: alerts.length,
      alertsList: alerts,
      overall: alerts.length > 0 ? 'degraded' : 'healthy',
    };
    
    // Send Slack alerts if POST request and alerts exist
    if (req.method === 'POST' && alerts.length > 0) {
      for (const alert of alerts) {
        alert.apiTests = apiTests; // Include API test results
        await sendSquareHealthAlert(alert);
      }
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Square Health] Error:', error);
    return res.status(500).json({
      error: 'Square health check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

