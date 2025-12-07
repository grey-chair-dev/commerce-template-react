/**
 * Inventory Divergence Check
 * 
 * Compares Square Inventory API with Neon inventory table to detect mismatches.
 * 
 * This endpoint can be called:
 * - Via Vercel Cron Job (daily at 3 AM EST)
 * - Manually for testing
 * 
 * Usage:
 *   POST /api/monitoring/inventory-sync-check - Run check and send alerts if needed
 *   GET /api/monitoring/inventory-sync-check - Check status without alerts
 */

import { neon } from '@neondatabase/serverless';
import { SquareClient, SquareEnvironment } from 'square';

// Alert threshold: Alert if mismatch is 5 or more units
const MISMATCH_THRESHOLD = 5;

/**
 * Fetch inventory from Square Catalog API
 */
async function getSquareInventory(squareClient, locationId) {
  try {
    const inventory = [];
    
    // Get all catalog items with pagination
    const catalogObjects = [];
    let cursor = null;
    
    do {
      const catalogResponse = await squareClient.catalog.list({
        types: ['ITEM'],
        cursor: cursor,
      });
      
      if (catalogResponse.result && catalogResponse.result.objects) {
        catalogObjects.push(...catalogResponse.result.objects);
        cursor = catalogResponse.result.cursor || null;
      } else {
        break;
      }
    } while (cursor);
    
    // Collect all variation IDs and item info
    const variationMap = new Map(); // variation_id -> { item_id, name }
    
    for (const object of catalogObjects) {
      if (object.type === 'ITEM' && object.itemData && object.itemData.variations) {
        for (const variation of object.itemData.variations) {
          if (variation.id) {
            variationMap.set(variation.id, {
              square_item_id: object.id,
              name: variation.itemVariationData?.name || object.itemData.name,
            });
          }
        }
      }
    }
    
    // Fetch inventory counts in batches (Square API limit: 1000 per request)
    const variationIds = Array.from(variationMap.keys());
    const batchSize = 1000;
    const inventoryMap = new Map(); // variation_id -> quantity
    
    for (let i = 0; i < variationIds.length; i += batchSize) {
      const batch = variationIds.slice(i, i + batchSize);
      
      try {
        // Use batchGetCounts (Square SDK v43 method)
        const inventoryResponse = await squareClient.inventory.batchGetCounts({
          catalogObjectIds: batch,
          locationIds: [locationId],
        });
        
        // Process paginated results
        for await (const page of inventoryResponse) {
          const counts = page.result?.counts || page.counts || [];
          
          for (const count of counts) {
            const variationId = count.catalogObjectId;
            if (variationId) {
              let quantity = 0;
              if (count.quantity != null) {
                quantity = typeof count.quantity === 'bigint' 
                  ? Number(count.quantity) 
                  : Number(count.quantity) || 0;
              }
              inventoryMap.set(variationId, quantity);
            }
          }
        }
      } catch (err) {
        console.warn(`[Inventory Check] Failed to get inventory for batch:`, err.message);
      }
    }
    
    // Build inventory array
    for (const variationId of variationIds) {
      const itemInfo = variationMap.get(variationId);
      inventory.push({
        square_variation_id: variationId,
        square_item_id: itemInfo.square_item_id,
        name: itemInfo.name,
        square_count: inventoryMap.get(variationId) || 0,
      });
    }
    
    return inventory;
  } catch (error) {
    console.error('[Inventory Check] Error fetching Square inventory:', error);
    throw error;
  }
}

/**
 * Fetch inventory from Neon database
 */
async function getNeonInventory(sql) {
  try {
    // Note: In our schema, products.id IS the Square variation ID
    const result = await sql`
      SELECT 
        id as square_variation_id,
        name,
        stock_count
      FROM products
      WHERE id IS NOT NULL
    `;
    
    return result.map(row => ({
      square_variation_id: row.square_variation_id,
      name: row.name,
      neon_count: parseInt(row.stock_count || 0, 10),
    }));
  } catch (error) {
    console.error('[Inventory Check] Error fetching Neon inventory:', error);
    throw error;
  }
}

/**
 * Compare Square and Neon inventories
 */
function compareInventories(squareInventory, neonInventory) {
  const mismatches = [];
  const squareMap = new Map(squareInventory.map(item => [item.square_variation_id, item]));
  const neonMap = new Map(neonInventory.map(item => [item.square_variation_id, item]));
  
  // Check items in both systems
  const allIds = new Set([...squareMap.keys(), ...neonMap.keys()]);
  
  for (const id of allIds) {
    const squareItem = squareMap.get(id);
    const neonItem = neonMap.get(id);
    
    if (!squareItem && neonItem) {
      // Item exists in Neon but not in Square
      mismatches.push({
        square_variation_id: id,
        name: neonItem.name,
        square_count: 0,
        neon_count: neonItem.neon_count,
        difference: -neonItem.neon_count,
        status: 'missing_in_square',
      });
    } else if (squareItem && !neonItem) {
      // Item exists in Square but not in Neon
      mismatches.push({
        square_variation_id: id,
        name: squareItem.name,
        square_count: squareItem.square_count,
        neon_count: 0,
        difference: squareItem.square_count,
        status: 'missing_in_neon',
      });
    } else if (squareItem && neonItem) {
      // Item exists in both - check for mismatch
      const difference = Math.abs(squareItem.square_count - neonItem.neon_count);
      if (difference >= MISMATCH_THRESHOLD) {
        mismatches.push({
          square_variation_id: id,
          name: squareItem.name || neonItem.name,
          square_count: squareItem.square_count,
          neon_count: neonItem.neon_count,
          difference,
          status: 'mismatch',
        });
      }
    }
  }
  
  return mismatches;
}

/**
 * Send Slack alert for inventory divergence
 */
async function sendSlackAlert(mismatches, totalChecked) {
  let webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  // Try to load from .env.local if not found (for local dev)
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
        console.log('[Inventory Check] Loaded SLACK_WEBHOOK_URL from .env.local');
      }
    } catch (e) {
      console.warn('[Inventory Check] Failed to load dotenv:', e.message);
    }
  }
  
  if (!webhookUrl) {
    console.warn('[Inventory Check] SLACK_WEBHOOK_URL not configured, skipping alert');
    return false;
  }
  
  // Strip quotes if present
  if (webhookUrl) {
    webhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');
  }
  
  // Get base URL for links
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  const emoji = mismatches.length > 0 ? '🚨' : '✅';
  const title = mismatches.length > 0 
    ? '🚨 Inventory Divergence Detected' 
    : '✅ Daily Sync Check Passed';
  
  // Build mismatch list
  let mismatchText = '';
  if (mismatches.length > 0) {
    mismatchText = mismatches.slice(0, 20).map((m, i) => {
      return `${i + 1}. *${m.name}* (SKU: \`${m.square_variation_id}\`)\n   Square: ${m.square_count} | Neon: ${m.neon_count} | Diff: ${m.difference > 0 ? '+' : ''}${m.difference}`;
    }).join('\n\n');
    
    if (mismatches.length > 20) {
      mismatchText += `\n\n...and ${mismatches.length - 20} more mismatches`;
    }
  }
  
  const message = {
    text: title,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n${mismatches.length > 0 ? '❌ Failures Detected' : '✅ All Checks Passed'}`,
          },
          {
            type: 'mrkdwn',
            text: `*Items Checked:*\n${totalChecked}`,
          },
          {
            type: 'mrkdwn',
            text: `*Mismatches Found:*\n${mismatches.length}`,
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n${MISMATCH_THRESHOLD}+ units`,
          },
        ],
      },
      ...(mismatches.length > 0 ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📋 Mismatched Items:*\n${mismatchText}`,
        },
      }] : [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*✅ All inventories match!*',
        },
      }]),
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*🚨 IMMEDIATE ACTION REQUIRED:*\n${mismatches.length > 0
                  ? '1. *CODE AUDIT:* Run the inventory reconciliation script manually in debug mode to find *which* SKU is mismatched.\n2. *RESYNC:* Run a full, **one-time catalog and inventory sync script** (Phase 0.2/0.4 logic) to force Neon to match Square\'s current status, correcting the divergence.'
                  : '1. *Continue Monitoring*: Daily checks will continue automatically\n2. *Review Logs*: Check Vercel logs for any warnings\n3. *Verify Webhooks*: Ensure Square webhooks are active'}`,
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
                  `<${baseUrl}/api/monitoring/inventory-sync-check|View Full Report>\n` +
                  `<https://console.neon.tech|Neon Console>\n` +
                  `<https://developer.squareup.com/apps|Square Dashboard>`
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
    console.error('[Inventory Check] Failed to send Slack alert:', error);
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
    
    // Fetch inventories
    console.log('[Inventory Check] Fetching Square inventory...');
    const squareInventory = await getSquareInventory(squareClient, squareLocationId);
    
    console.log('[Inventory Check] Fetching Neon inventory...');
    const neonInventory = await getNeonInventory(sql);
    
    // Compare
    console.log('[Inventory Check] Comparing inventories...');
    const mismatches = compareInventories(squareInventory, neonInventory);
    
    const result = {
      timestamp: new Date().toISOString(),
      totalChecked: Math.max(squareInventory.length, neonInventory.length),
      squareItems: squareInventory.length,
      neonItems: neonInventory.length,
      mismatches: mismatches.length,
      mismatchesList: mismatches,
      status: mismatches.length > 0 ? 'divergence_detected' : 'all_match',
    };
    
    // Send Slack alert if POST request
    if (req.method === 'POST') {
      await sendSlackAlert(mismatches, result.totalChecked);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('[Inventory Check] Error:', error);
    return res.status(500).json({
      error: 'Inventory check failed',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { details: error.stack }),
    });
  }
}

