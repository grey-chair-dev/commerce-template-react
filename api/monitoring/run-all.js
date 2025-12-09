/**
 * Consolidated Monitoring Endpoint
 * 
 * Runs all monitoring checks sequentially in a single cron job.
 * This simplifies deployment and provides a unified view of system health.
 * 
 * Individual monitoring endpoints remain available for ad-hoc checks:
 * - GET /api/monitoring/{check-name} - Check status without alerts
 * - POST /api/monitoring/{check-name} - Run check and send alerts
 * 
 * Usage:
 *   POST /api/monitoring/run-all - Run all checks and send alerts if needed
 *   GET /api/monitoring/run-all - Run all checks without alerts
 */

/**
 * Run a monitoring check by calling its handler directly
 */
async function runMonitoringCheck(checkName, sendAlerts = false) {
  const startTime = Date.now();
  let result = {
    check: checkName,
    success: false,
    duration: 0,
    error: null,
    data: null,
  };

  try {
    // Import the check handler dynamically
    let handler;
    try {
      const module = await import(`./${checkName}.js`);
      handler = module.default;
      if (typeof handler !== 'function') {
        throw new Error(`Handler for ${checkName} is not a function`);
      }
    } catch (importError) {
      result.error = `Failed to import ${checkName}: ${importError.message}`;
      result.duration = Date.now() - startTime;
      return result;
    }

    // Create mock request object
    const mockReq = {
      method: sendAlerts ? 'POST' : 'GET',
      headers: {
        origin: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
      },
      body: {},
    };

    // Create mock response object that captures the JSON response
    let responseSent = false;
    let responseStatus = 200;
    let responseData = null;

    const mockRes = {
      statusCode: 200,
      headers: {},
      status: function(code) {
        this.statusCode = code;
        responseStatus = code;
        return this;
      },
      json: function(data) {
        responseData = data;
        responseSent = true;
        return this;
      },
      setHeader: function(name, value) {
        this.headers[name] = value;
      },
      end: function() {
        responseSent = true;
      },
    };

    // Call the handler with a timeout
    const handlerPromise = handler(mockReq, mockRes);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Check timed out after 30 seconds')), 30000)
    );

    await Promise.race([handlerPromise, timeoutPromise]);

    result.duration = Date.now() - startTime;
    result.success = responseStatus >= 200 && responseStatus < 300;
    result.data = responseData;
    
    if (!result.success) {
      result.error = result.data?.error || result.data?.message || `Check returned status ${responseStatus}`;
    }
  } catch (error) {
    result.duration = Date.now() - startTime;
    result.error = error.message;
    result.success = false;
  }

  return result;
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

  const sendAlerts = req.method === 'POST';
  const startTime = Date.now();

  // List of all monitoring checks to run
  const monitoringChecks = [
    'neon-health',
    'inventory-sync-check',
    'order-reconciliation-check',
    'square-health',
    'esp-health',
    'cart-abandonment',
    'auth-failure-rate',
  ];

  console.log(`[Monitoring Run-All] Starting ${monitoringChecks.length} monitoring checks (alerts: ${sendAlerts ? 'enabled' : 'disabled'})...`);

  // Run all checks sequentially
  const results = [];
  let overallStatus = 'healthy';
  let totalAlerts = 0;

  for (const checkName of monitoringChecks) {
    console.log(`[Monitoring Run-All] Running ${checkName}...`);
    const checkResult = await runMonitoringCheck(checkName, sendAlerts);
    results.push(checkResult);

    // Determine overall status
    if (!checkResult.success) {
      overallStatus = 'degraded';
    }

    // Count alerts from check results
    if (checkResult.data) {
      if (checkResult.data.alerts && Array.isArray(checkResult.data.alerts)) {
        totalAlerts += checkResult.data.alerts.length;
      } else if (checkResult.data.alertsList && Array.isArray(checkResult.data.alertsList)) {
        totalAlerts += checkResult.data.alertsList.length;
      } else if (checkResult.data.overall === 'degraded' || checkResult.data.overall === 'critical') {
        totalAlerts += 1;
      }
    }

    // Log check completion
    if (checkResult.success) {
      console.log(`[Monitoring Run-All] ✓ ${checkName} completed in ${checkResult.duration}ms`);
    } else {
      console.error(`[Monitoring Run-All] ✗ ${checkName} failed: ${checkResult.error}`);
      overallStatus = 'degraded';
    }
  }

  const totalDuration = Date.now() - startTime;

  // Build summary
  const summary = {
    timestamp: new Date().toISOString(),
    overall: overallStatus,
    totalChecks: monitoringChecks.length,
    successfulChecks: results.filter(r => r.success).length,
    failedChecks: results.filter(r => !r.success).length,
    totalAlerts,
    totalDuration,
    checks: results.map(r => ({
      name: r.check,
      success: r.success,
      duration: r.duration,
      status: r.data?.overall || (r.success ? 'healthy' : 'error'),
      alerts: r.data?.alerts?.length || r.data?.alertsList?.length || 0,
      error: r.error || null,
    })),
  };

  // Log summary
  console.log(`[Monitoring Run-All] Completed in ${totalDuration}ms - ${summary.successfulChecks}/${summary.totalChecks} checks passed, ${totalAlerts} alerts`);

  return res.status(200).json(summary);
}
