/**
 * Authentication Failure Rate Monitoring
 * 
 * Tracks authentication failure rate and alerts if it exceeds threshold.
 * 
 * Metric: Ratio of Successful Logins to Login Attempts
 * Alert: If failure rate (401 Unauthorized) exceeds 3%
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (daily at 3 AM EST)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/auth-failure-rate - Run check and send alerts if needed
 *   GET /api/monitoring/auth-failure-rate - Check status without alerts
 */

import { neon } from '@neondatabase/serverless';
import { sendSlackAlert } from '../utils/slackAlerter.js';

// Alert threshold: Alert if failure rate exceeds 3%
const FAILURE_RATE_THRESHOLD = 0.03; // 3%

/**
 * Calculate authentication failure rate for a time period
 * 
 * Note: This requires logging login attempts. We'll create a simple approach
 * by checking Vercel logs or creating an auth_logs table.
 * 
 * For now, we'll use a simple heuristic: check recent login activity
 * and estimate based on common patterns.
 */
async function calculateAuthFailureRate(sql, startDate, endDate) {
  try {
    // Option 1: If we have an auth_logs table, use it
    // Option 2: Check Vercel logs (requires log drain)
    // Option 3: Use a simple heuristic based on recent activity
    
    // For now, we'll create a simple check that can be enhanced later
    // We'll check for recent customer activity and estimate
    
    // Count total login attempts (we'll need to track this)
    // For now, we'll use a placeholder that can be enhanced with actual logging
    
    // Check if auth_logs table exists, if not, return placeholder data
    let authLogs = null;
    try {
      authLogs = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'success') as successful,
          COUNT(*) FILTER (WHERE status = 'failure') as failed,
          COUNT(*) as total
        FROM auth_logs
        WHERE created_at >= ${startDate}
          AND created_at < ${endDate}
      `;
    } catch (error) {
      // Table doesn't exist yet - we'll return a note about setting up logging
      console.warn('[Auth Failure Rate] auth_logs table not found. Set up logging first.');
    }
    
    if (authLogs && authLogs[0]) {
      const successful = parseInt(authLogs[0].successful || 0, 10);
      const failed = parseInt(authLogs[0].failed || 0, 10);
      const total = parseInt(authLogs[0].total || 0, 10);
      
      let failureRate = 0;
      if (total > 0) {
        failureRate = (failed / total) * 100;
      }
      
      return {
        totalAttempts: total,
        successful: successful,
        failed: failed,
        failureRate: failureRate,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    }
    
    // Fallback: Return placeholder indicating logging needs to be set up
    return {
      totalAttempts: 0,
      successful: 0,
      failed: 0,
      failureRate: 0,
      note: 'Auth logging not configured. Set up auth_logs table to track login attempts.',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('[Auth Failure Rate] Error calculating rate:', error);
    throw error;
  }
}

/**
 * Send Slack alert for high authentication failure rate
 * Now uses centralized SlackAlerterService
 */
async function sendAuthFailureRateAlert(alertData) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  return await sendSlackAlert({
    priority: 'high',
    route: '/api/monitoring/auth-failure-rate',
    title: 'High Authentication Failure Rate Detected',
    message: `Authentication failure rate of ${alertData.failureRate.toFixed(2)}% exceeds the 3% threshold. Users may be unable to log in.`,
    context: `*Failure Rate:* ${alertData.failureRate.toFixed(2)}%\n*Threshold:* 3%\n*Total Attempts:* ${alertData.totalAttempts}\n*Failed:* ${alertData.failed}`,
    recommendedAction: alertData.actionableSteps || [
      'IMMEDIATE CHECK: Verify the JWT_SECRET environment variable is correct and matches the value used to sign tokens',
      'REVIEW LOGS: Check Vercel logs for authentication errors',
      'TEST LOGIN: Manually test the login endpoint',
      'CHECK PASSWORD HASHES: Verify bcrypt password hashing is working correctly',
      '⚠️ Critical Impact: Users cannot access their accounts. Checkout and order history are blocked.',
    ],
    fields: {
      'Failure Rate': `${alertData.failureRate.toFixed(2)}%`,
      'Threshold': '3%',
      'Total Attempts': String(alertData.totalAttempts),
      'Failed': String(alertData.failed),
    },
    links: {
      'View Debug Info': `${baseUrl}/api/monitoring/debug`,
      'Test Login Endpoint': `${baseUrl}/api/auth/login`,
      'Vercel Logs': 'https://vercel.com/dashboard',
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
    
    // Calculate failure rate for last 24 hours
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    console.log('[Auth Failure Rate] Calculating rate...');
    const rateData = await calculateAuthFailureRate(sql, startDate, now);
    
    const result = {
      timestamp: new Date().toISOString(),
      ...rateData,
      threshold: FAILURE_RATE_THRESHOLD * 100, // 3%
      status: rateData.failureRate > (FAILURE_RATE_THRESHOLD * 100) ? 'threshold_exceeded' : 'normal',
    };
    
    // Send Slack alert if POST request and threshold exceeded
    if (req.method === 'POST' && result.status === 'threshold_exceeded' && rateData.totalAttempts > 0) {
      await sendAuthFailureRateAlert({
        failureRate: rateData.failureRate,
        totalAttempts: rateData.totalAttempts,
        successful: rateData.successful,
        failed: rateData.failed,
        actionableSteps: [
          'IMMEDIATE CHECK: Verify the JWT_SECRET environment variable is correct and matches the value used to sign tokens',
          'TEST LOGIC: Manually test the /api/auth/login endpoint to see if bcrypt.compare() is failing',
        ],
      });
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Auth Failure Rate] Error:', error);
    return res.status(500).json({
      error: 'Auth failure rate check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

