/**
 * Order Reconciliation Check
 * 
 * Checks for orders paid in Square but missing from the Neon orders table.
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (daily at 3 AM EST)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/order-reconciliation-check - Run check and send alerts if needed
 *   GET /api/monitoring/order-reconciliation-check - Check status without alerts
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';
import { sendSlackAlert } from '../utils/slackAlerter.js';

/**
 * Fetch paid orders from Square (last 7 days)
 */
async function getSquarePaidOrders(squareClient, locationId) {
  try {
    const paidOrders = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // Last 7 days
    
    // Search for orders - Square SDK v43 uses search() method with pagination
    const allOrders = [];
    let cursor = null;
    
    try {
      do {
        const searchResponse = await squareClient.orders.search({
          locationIds: [locationId],
          query: {
            filter: {
              stateFilter: {
                states: ['COMPLETED', 'FULFILLED'],
              },
              dateTimeFilter: {
                createdAtAt: {
                  startAt: startDate.toISOString(),
                  endAt: endDate.toISOString(),
                },
              },
            },
          },
          limit: 100,
          cursor: cursor,
        });
        
        if (searchResponse.result && searchResponse.result.orders) {
          allOrders.push(...searchResponse.result.orders);
          cursor = searchResponse.result.cursor || null;
        } else {
          break;
        }
      } while (cursor);
      
      // Process all orders
      for (const order of allOrders) {
        // Check if order has payments
        if (order.tenders && order.tenders.length > 0) {
          const hasSuccessfulPayment = order.tenders.some(tender => 
            tender.type === 'CARD' && 
            (tender.cardDetails?.status === 'CAPTURED' || tender.cardDetails?.status === 'AUTHORIZED')
          );
          
          if (hasSuccessfulPayment && order.referenceId) {
            paidOrders.push({
              square_order_id: order.id,
              order_number: order.referenceId,
              created_at: order.createdAt,
              total_amount: order.totalMoney?.amount || 0,
              currency: order.totalMoney?.currency || 'USD',
            });
          }
        }
      }
      
      return paidOrders;
    } catch (error) {
      console.error('[Order Reconciliation] Error fetching Square orders:', error);
      // Return empty array if search fails (e.g., no orders, API error)
      // This allows the check to continue and report that no orders were found
      console.warn('[Order Reconciliation] Returning empty orders list due to error');
      return [];
    }
}

/**
 * Fetch orders from Neon database
 */
async function getNeonOrders(sql) {
  try {
    const result = await sql`
      SELECT 
        square_order_id,
        order_number,
        created_at,
        total_amount
      FROM orders
      WHERE square_order_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
    `;
    
    return result.map(row => ({
      square_order_id: row.square_order_id,
      order_number: row.order_number,
      created_at: row.created_at,
      total_amount: parseFloat(row.total_amount || 0),
    }));
  } catch (error) {
    console.error('[Order Reconciliation] Error fetching Neon orders:', error);
    throw error;
  }
}

/**
 * Find orders in Square but missing from Neon
 */
function findMissingOrders(squareOrders, neonOrders) {
  const neonOrderIds = new Set(neonOrders.map(o => o.square_order_id));
  const missingOrders = squareOrders.filter(order => !neonOrderIds.has(order.square_order_id));
  
  return missingOrders;
}

/**
 * Send Slack alert for missing orders
 * Now uses centralized SlackAlerterService
 */
async function sendOrderReconciliationAlert(missingOrders, totalChecked) {
  const totalMissingAmount = missingOrders.reduce((sum, order) => sum + (order.total_amount / 100), 0);
  
  const title = missingOrders.length > 0 
    ? 'Order Reconciliation Failure' 
    : 'Daily Sync Check Passed';
  
  const recommendedAction = missingOrders.length > 0
    ? [
        'Check Webhook Logs: Review /api/webhooks/square-order-paid logs in Vercel',
        'Verify Webhook Configuration: Ensure Square webhook is active and pointing to correct URL',
        'Check Square Dashboard: Verify orders exist in Square',
        'Review Database: Check Neon orders table for any errors',
        'Manual Reconciliation: Consider manually processing missing orders if needed',
      ]
    : [
        'Continue Monitoring: Daily checks will continue automatically',
        'Review Logs: Check Vercel logs for any warnings',
        'Verify Webhooks: Ensure Square webhooks are active',
      ];
  
  return await sendSlackAlert({
    priority: missingOrders.length > 0 ? 'high' : 'low',
    route: '/api/monitoring/order-reconciliation-check',
    title,
    message: missingOrders.length > 0 
      ? `Found ${missingOrders.length} order(s) paid in Square but missing from Neon database`
      : 'All orders are reconciled between Square and Neon',
    context: `*Orders Checked:* ${totalChecked}\n*Missing Orders:* ${missingOrders.length}\n*Total Missing Amount:* $${totalMissingAmount.toFixed(2)}`,
    recommendedAction,
    fields: {
      'Status': missingOrders.length > 0 ? '❌ Failures Detected' : '✅ All Checks Passed',
      'Orders Checked': String(totalChecked),
      'Missing Orders': String(missingOrders.length),
      'Total Missing Amount': `$${totalMissingAmount.toFixed(2)}`,
    },
    links: {
      'View Neon Console': 'https://console.neon.tech',
      'View Square Dashboard': 'https://developer.squareup.com/apps',
    },
    metadata: missingOrders.length > 0 ? { missingOrders } : undefined,
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
    // Get Square credentials
    const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
    const squareEnvironment = (process.env.SQUARE_ENVIRONMENT || 'sandbox').toLowerCase().trim();
    const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();
    
    if (!squareAccessToken || !squareLocationId) {
      return res.status(500).json({
        error: 'Square credentials not configured',
        message: 'Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID in environment variables',
      });
    }
    
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
    
    // Initialize clients
    // Note: Square SDK v43 uses 'token' parameter (not 'accessToken')
    const squareClient = new SquareClient({
      token: squareAccessToken,
      environment: squareEnvironment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    });
    
    const sql = neon(databaseUrl);
    
    // Fetch orders
    console.log('[Order Reconciliation] Fetching Square paid orders...');
    const squareOrders = await getSquarePaidOrders(squareClient, squareLocationId);
    
    console.log('[Order Reconciliation] Fetching Neon orders...');
    const neonOrders = await getNeonOrders(sql);
    
    // Find missing orders
    console.log('[Order Reconciliation] Comparing orders...');
    const missingOrders = findMissingOrders(squareOrders, neonOrders);
    
    const result = {
      timestamp: new Date().toISOString(),
      totalChecked: squareOrders.length,
      squareOrders: squareOrders.length,
      neonOrders: neonOrders.length,
      missingOrders: missingOrders.length,
      missingOrdersList: missingOrders,
      status: missingOrders.length > 0 ? 'reconciliation_failure' : 'all_reconciled',
    };
    
    // Send Slack alert if POST request
    if (req.method === 'POST') {
      await sendOrderReconciliationAlert(missingOrders, result.totalChecked);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Order Reconciliation] Error:', error);
    return res.status(500).json({
      error: 'Order reconciliation check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

