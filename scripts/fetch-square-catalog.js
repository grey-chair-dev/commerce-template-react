#!/usr/bin/env node

/**
 * Fetch Square Catalog Products
 * 
 * This script retrieves all products from Square Catalog API with pagination
 * and outputs a clean JSON file with sku, square_item_id, and square_variation_id.
 * 
 * Usage:
 *   node scripts/fetch-square-catalog.js [output-file]
 * 
 * Example:
 *   node scripts/fetch-square-catalog.js square-products.json
 */

import dotenv from 'dotenv';
import { SquareClient, SquareEnvironment } from 'square';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Load environment variables
const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
const locationId = process.env.SQUARE_LOCATION_ID;

// Validate required environment variables
if (!accessToken) {
  console.error('❌ Error: SQUARE_ACCESS_TOKEN is not set in .env.local');
  process.exit(1);
}

if (!locationId) {
  console.error('❌ Error: SQUARE_LOCATION_ID is not set in .env.local');
  process.exit(1);
}

// Log environment variable details for debugging
console.log('📋 Environment Variable Verification:');
console.log(`   SQUARE_ACCESS_TOKEN: ${accessToken ? `${accessToken.substring(0, 12)}...${accessToken.substring(accessToken.length - 8)} (length: ${accessToken.length})` : 'NOT SET'}`);
console.log(`   SQUARE_ENVIRONMENT: ${environment}`);
console.log(`   SQUARE_LOCATION_ID: ${locationId}`);
console.log(`   Token starts with: ${accessToken.substring(0, 10)}`);
console.log(`   Token ends with: ...${accessToken.substring(accessToken.length - 10)}`);
console.log('');

// Initialize Square client - using 'token' instead of 'accessToken'
const squareClient = new SquareClient({
  token: accessToken,
  environment: environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

// Log client configuration
console.log('⚙️  Square Client Configuration:');
console.log(`   Environment: ${environment === 'production' ? 'Production' : 'Sandbox'}`);
console.log(`   Using SquareEnvironment: ${environment === 'production' ? 'SquareEnvironment.Production' : 'SquareEnvironment.Sandbox'}`);
console.log('');

const catalogApi = squareClient.catalog;
const inventoryApi = squareClient.inventory;

/**
 * Convert camelCase object to snake_case (recursive)
 * This converts the SDK's camelCase format back to Square API's snake_case format
 */
function convertToSnakeCase(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertToSnakeCase(item));
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    // Convert camelCase to snake_case
    // Handle special cases like itemData -> item_data, itemVariationData -> item_variation_data
    const snakeKey = key
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
    
    // Handle nested objects and arrays
    if (typeof value === 'object' && value !== null) {
      converted[snakeKey] = convertToSnakeCase(value);
    } else {
      converted[snakeKey] = value;
    }
  }
  
  return converted;
}

/**
 * Test authentication by making a simple API call
 */
async function testAuthentication() {
  try {
    console.log('🔐 Testing authentication...');
    // Try to list catalog as an auth test (will fail with 401 if auth is bad)
    const testResponse = await catalogApi.list({ limit: 1 });
    
    // Handle response structure
    const result = testResponse.result || testResponse;
    
    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      if (error.code === 'UNAUTHORIZED' || error.category === 'AUTHENTICATION_ERROR') {
        console.error('❌ Authentication failed:');
        console.error(`   - ${error.code}: ${error.detail || error.field}`);
        return false;
      }
    }
    
    console.log('✅ Authentication successful!');
    return true;
  } catch (error) {
    // Check if it's an auth error
    if (error.statusCode === 401 || 
        error.message?.includes('401') || 
        error.message?.includes('UNAUTHORIZED') ||
        (error.response?.body && JSON.parse(error.response.body)?.errors?.[0]?.code === 'UNAUTHORIZED')) {
      console.error('❌ Authentication failed (401 Unauthorized)');
      return false;
    }
    // Other errors might be OK (e.g., no catalog items yet)
    console.log('✅ Authentication appears valid (proceeding with catalog fetch)');
    return true;
  }
}

/**
 * Fetch all catalog objects with pagination
 */
async function fetchAllCatalogObjects() {
  const allObjects = [];
  let cursor = null;
  let hasMore = true;

  console.log('🔍 Fetching catalog objects from Square...');
  console.log(`📍 Location ID: ${locationId}`);
  console.log(`🌍 Environment: ${environment}\n`);

  let currentResponse = null;
  
  while (hasMore) {
    try {
      let response;
      
      if (cursor === null || cursor === undefined) {
        // First request
        console.log('   Making first request...');
        response = await catalogApi.list({});
        currentResponse = response;
      } else if (cursor === 'hasNextPage' && currentResponse && typeof currentResponse.loadNextPage === 'function') {
        // Load next page using loadNextPage
        console.log(`   Loading next page...`);
        response = await currentResponse.loadNextPage();
        currentResponse = response;
      } else {
        // Use cursor for pagination
        console.log(`   Fetching next page (cursor: ${cursor.substring(0, 20)}...)`);
        response = await catalogApi.list({ cursor });
        currentResponse = response;
      }

      // Debug: inspect response structure (only on first request)
      if (cursor === null || cursor === undefined) {
        console.log('   Response structure:');
        console.log('   - Has getItems:', typeof response.getItems === 'function');
        console.log('   - Has rawResponse:', !!response.rawResponse);
        if (response.rawResponse?.body) {
          try {
            const body = typeof response.rawResponse.body === 'string' 
              ? JSON.parse(response.rawResponse.body) 
              : response.rawResponse.body;
            console.log('   - rawResponse.body has objects:', !!body.objects);
            if (body.objects && body.objects.length > 0) {
              const firstObj = body.objects[0];
              const keys = Object.keys(firstObj);
              console.log('   - First object keys (first 10):', keys.slice(0, 10).join(', '));
              console.log('   - Has item_data:', keys.includes('item_data'));
              console.log('   - Has itemData:', keys.includes('itemData'));
            }
          } catch (e) {
            console.log('   - Could not parse rawResponse.body:', e.message);
          }
        }
      }

      // Square SDK v43 returns response with getItems() method
      // The SDK converts snake_case to camelCase, but we want the original format
      // Try rawResponse first to get original API format
      let objects = [];
      
      // Try to get raw response first (should preserve original Square API format with snake_case)
      if (response.rawResponse?.body) {
        try {
          const body = typeof response.rawResponse.body === 'string' 
            ? JSON.parse(response.rawResponse.body) 
            : response.rawResponse.body;
          if (body.objects) {
            objects = body.objects;
          } else if (body.result?.objects) {
            objects = body.result.objects;
          }
        } catch (e) {
          // If parsing fails, fall through to getItems()
        }
      }
      
      // Fallback to getItems() if raw response didn't work
      // Note: getItems() returns camelCase (itemData, itemVariationData)
      // We'll need to convert back to snake_case if rawResponse doesn't have it
      if (objects.length === 0 && response.getItems && typeof response.getItems === 'function') {
        objects = response.getItems() || [];
      }
      
      // Additional fallbacks
      if (objects.length === 0) {
        if (response.data?.objects) {
          objects = response.data.objects;
        } else if (response.result?.objects) {
          objects = response.result.objects;
        } else if (response.objects) {
          objects = response.objects;
        } else if (response.data) {
          objects = Array.isArray(response.data) ? response.data : [];
        }
      }
      
      // Convert camelCase to snake_case if needed (to match Square API format)
      // Check if first object uses camelCase
      if (objects.length > 0) {
        const firstObj = objects[0];
        const hasCamelCase = 'itemData' in firstObj || 'itemVariationData' in firstObj;
        const hasSnakeCase = 'item_data' in firstObj || 'item_variation_data' in firstObj;
        
        // If we have camelCase but need snake_case, convert it
        if (hasCamelCase && !hasSnakeCase && cursor === null) {
          console.log('   Converting camelCase to snake_case to match Square API format...');
          objects = objects.map(obj => convertToSnakeCase(obj));
        }
      }
      
      // Debug: log object types if found
      if (objects.length > 0 && cursor === null) {
        const types = [...new Set(objects.map(obj => obj.type))];
        console.log(`   Found object types: ${types.join(', ')}`);
      }
      
      allObjects.push(...objects);

      console.log(`   ✓ Fetched ${objects.length} objects (total: ${allObjects.length})`);

      // Check if there's more data - use loadNextPage for pagination
      let hasNext = false;
      if (typeof response._hasNextPage === 'function') {
        hasNext = response._hasNextPage();
      } else {
        hasNext = response._hasNextPage === true;
      }
        
      if (hasNext && typeof response.loadNextPage === 'function') {
        // Continue pagination
        hasMore = true;
        cursor = 'hasNextPage'; // Use a marker to indicate we should use loadNextPage
      } else {
        // No more pages
        hasMore = false;
        cursor = null;
        currentResponse = null;
      }

      // Rate limiting: small delay between requests
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      // Better error handling for authentication errors
      if (error.statusCode === 401 || error.message?.includes('401') || error.message?.includes('UNAUTHORIZED')) {
        console.error('\n❌ Authentication Error (401 Unauthorized)');
        console.error('   This usually means:');
        console.error('   1. Your access token is expired (Square tokens expire after 30 days)');
        console.error('   2. Your access token is invalid or revoked');
        console.error('   3. Environment mismatch (using sandbox token in production or vice versa)');
        console.error('   4. Token lacks required permissions (CATALOG_READ)');
        console.error('\n💡 To fix:');
        console.error('   - Go to https://developer.squareup.com/apps');
        console.error('   - Select your application');
        console.error('   - Navigate to Credentials');
        console.error('   - Generate a new access token');
        console.error('   - Update SQUARE_ACCESS_TOKEN in .env.local');
      } else {
        console.error('❌ Error fetching catalog:', error.message);
        if (error.response) {
          console.error('   Response:', JSON.stringify(error.response, null, 2));
        }
      }
      throw error;
    }
  }

  console.log(`\n✅ Total catalog objects retrieved: ${allObjects.length}\n`);
  return allObjects;
}

/**
 * Process catalog objects to match Square API response format
 * Returns objects in the same structure as the Square API
 */
function processCatalogObjects(catalogObjects) {
  // Return objects as-is, maintaining the full Square API structure
  // The objects already contain all the nested data (item_data, item_variation_data, etc.)
  return catalogObjects;
}

/**
 * Extract clean product data (sku, square_item_id, square_variation_id)
 * This creates a simplified mapping for easy reference
 */
function extractCleanProductData(catalogObjects) {
  const products = [];
  
  catalogObjects.forEach(obj => {
    if (obj.type === 'ITEM' && obj.item_data?.variations) {
      const itemId = obj.id;
      const itemData = obj.item_data;
      
      // Process each variation
      itemData.variations.forEach(variation => {
        if (variation.type === 'ITEM_VARIATION') {
          const variationData = variation.item_variation_data || {};
          products.push({
            sku: variationData.sku || null,
            square_item_id: itemId,
            square_variation_id: variation.id,
          });
        }
      });
      
      // Handle items without variations
      if (!itemData.variations || itemData.variations.length === 0) {
        products.push({
          sku: null,
          square_item_id: itemId,
          square_variation_id: null,
        });
      }
    }
  });
  
  return products;
}

/**
 * Initialize Neon database connection
 */
function getDatabasePool() {
  // Try multiple environment variable names for database URL
  const dbUrl = process.env.SPR_NEON_DATABSE_URL || 
                process.env.DATABASE_URL || 
                process.env.SPR_POSTGRES_URL ||
                process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    throw new Error('Database URL not found. Set SPR_NEON_DATABSE_URL, DATABASE_URL, SPR_POSTGRES_URL, or POSTGRES_URL in .env.local');
  }
  
  return new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  });
}

/**
 * UPSERT products into Neon database
 */
async function upsertProducts(pool, catalogObjects) {
  console.log('💾 Upserting products into Neon database...');
  
  const client = await pool.connect();
  let upserted = 0;
  let errors = 0;
  
  try {
    await client.query('BEGIN');
    
    for (const obj of catalogObjects) {
      if (obj.type === 'ITEM' && obj.item_data) {
        const itemData = obj.item_data;
        const itemId = obj.id;
        
        // Process each variation as a separate product
        if (itemData.variations && itemData.variations.length > 0) {
          for (const variation of itemData.variations) {
            if (variation.type === 'ITEM_VARIATION') {
              const variationData = variation.item_variation_data || {};
              const variationId = variation.id;
              
              // Use variation_id as the product ID (since that's the sellable unit)
              const productId = variationId;
              
              // Extract price from variation (could be FIXED_PRICING or VARIABLE_PRICING)
              let price = 0;
              if (variationData.price_money?.amount) {
                // Handle BigInt or regular number
                const amount = typeof variationData.price_money.amount === 'bigint'
                  ? Number(variationData.price_money.amount)
                  : variationData.price_money.amount;
                price = amount / 100; // Square stores cents
              }
              
              // Extract category (use first category if available)
              const category = itemData.categories && itemData.categories.length > 0
                ? itemData.categories[0].id
                : null;
              
              // Extract description
              const description = itemData.description || 
                                 itemData.description_plaintext || 
                                 itemData.description_html || 
                                 null;
              
              // Extract image URL (would need to fetch from Square Images API)
              const imageUrl = null; // TODO: Fetch from Square Images API if image_ids exist
              
              try {
                // UPSERT product
                await client.query(`
                  INSERT INTO products (
                    id, name, description, price, category, stock_count, image_url,
                    created_at, updated_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                  ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    price = EXCLUDED.price,
                    category = EXCLUDED.category,
                    image_url = EXCLUDED.image_url,
                    updated_at = NOW()
                `, [
                  productId,
                  itemData.name || 'Unnamed Product',
                  description,
                  price,
                  category,
                  0, // Initial stock_count (will be updated by inventory records)
                  imageUrl,
                ]);
                
                upserted++;
              } catch (error) {
                console.error(`   ⚠️  Error upserting product ${productId}:`, error.message);
                errors++;
              }
            }
          }
        } else {
          // Item without variations - use item_id as product ID
          const productId = itemId;
          const description = itemData.description || 
                             itemData.description_plaintext || 
                             itemData.description_html || 
                             null;
          const category = itemData.categories && itemData.categories.length > 0
            ? itemData.categories[0].id
            : null;
          
          try {
            await client.query(`
              INSERT INTO products (
                id, name, description, price, category, stock_count, image_url,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                category = EXCLUDED.category,
                image_url = EXCLUDED.image_url,
                updated_at = NOW()
            `, [
              productId,
              itemData.name || 'Unnamed Product',
              description,
              0, // No price without variation
              category,
              0,
              null,
            ]);
            
            upserted++;
          } catch (error) {
            console.error(`   ⚠️  Error upserting product ${productId}:`, error.message);
            errors++;
          }
        }
      }
    }
    
    await client.query('COMMIT');
    console.log(`   ✅ Upserted ${upserted} products (${errors} errors)\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  
  return { upserted, errors };
}

/**
 * Create initial inventory records
 * This sets up the foreign key mappings for real-time syncs
 */
async function createInitialInventory(pool, catalogObjects) {
  console.log('📦 Creating initial inventory records...');
  
  const client = await pool.connect();
  let created = 0;
  let skipped = 0;
  let errors = 0;
  
  try {
    // First, check how many inventory records currently exist
    const countResult = await client.query('SELECT COUNT(*) as count FROM inventory WHERE reason = $1', ['initial_load']);
    const existingCount = parseInt(countResult.rows[0].count, 10);
    console.log(`   Found ${existingCount} existing inventory records`);
    
    await client.query('BEGIN');
    
    for (const obj of catalogObjects) {
      if (obj.type === 'ITEM' && obj.item_data?.variations) {
        const itemData = obj.item_data;
        
        for (const variation of itemData.variations) {
          if (variation.type === 'ITEM_VARIATION') {
            const variationData = variation.item_variation_data || {};
            const productId = variation.id; // Use variation_id as product ID
            
            // Check if inventory record already exists
            const existing = await client.query(
              'SELECT id FROM inventory WHERE product_id = $1 AND reason = $2 LIMIT 1',
              [productId, 'initial_load']
            );
            
            if (existing.rows.length === 0) {
              try {
                // Create initial inventory record with 0 change (just for FK mapping)
                await client.query(`
                  INSERT INTO inventory (product_id, quantity_change, reason, notes, created_at)
                  VALUES ($1, $2, $3, $4, NOW())
                `, [
                  productId,
                  0, // No initial quantity change, just establishing the mapping
                  'initial_load',
                  `Initial load from Square catalog. SKU: ${variationData.sku || 'N/A'}, Item: ${itemData.name}`
                ]);
                
                created++;
              } catch (error) {
                console.error(`   ⚠️  Error creating inventory for ${productId}:`, error.message);
                if (error.code === '23503') {
                  console.error(`      Foreign key violation - product ${productId} may not exist in products table`);
                }
                errors++;
              }
            } else {
              skipped++;
            }
          }
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Verify final count and show sample records
    const finalCountResult = await client.query('SELECT COUNT(*) as count FROM inventory WHERE reason = $1', ['initial_load']);
    const finalCount = parseInt(finalCountResult.rows[0].count, 10);
    
    // Also check total inventory count (all reasons)
    const totalCountResult = await client.query('SELECT COUNT(*) as count FROM inventory');
    const totalCount = parseInt(totalCountResult.rows[0].count, 10);
    
    // Show a few sample records to verify they exist
    const sampleResult = await client.query(
      'SELECT product_id, quantity_change, reason, notes FROM inventory WHERE reason = $1 LIMIT 3',
      ['initial_load']
    );
    
    if (skipped > 0) {
      console.log(`   ✅ Created ${created} inventory records, skipped ${skipped} existing (${errors} errors)`);
    } else {
      console.log(`   ✅ Created ${created} inventory records (${errors} errors)`);
    }
    console.log(`   📊 Total inventory records (initial_load): ${finalCount}`);
    console.log(`   📊 Total inventory records (all reasons): ${totalCount}`);
    if (sampleResult.rows.length > 0) {
      console.log(`   📋 Sample records:`);
      sampleResult.rows.forEach((row, i) => {
        console.log(`      ${i + 1}. product_id: ${row.product_id}, quantity_change: ${row.quantity_change}, reason: ${row.reason}`);
      });
    }
    
    // Verify that products exist and can be joined
    const joinTest = await client.query(`
      SELECT COUNT(*) as count 
      FROM inventory i 
      INNER JOIN products p ON i.product_id = p.id 
      WHERE i.reason = $1
    `, ['initial_load']);
    const joinCount = parseInt(joinTest.rows[0].count, 10);
    console.log(`   🔗 Inventory records with valid product FK: ${joinCount}`);
    console.log('');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
  
  return { created, skipped, errors };
}

/**
 * Fetch inventory counts from Square and update stock_count in products table
 */
async function fetchAndUpdateInventoryCounts(pool, catalogObjects) {
  console.log('📦 Fetching inventory counts from Square...');
  
  // Extract all catalog object IDs (variation IDs) that we need to check
  const catalogObjectIds = [];
  
  for (const obj of catalogObjects) {
    if (obj.type === 'ITEM' && obj.item_data?.variations) {
      for (const variation of obj.item_data.variations) {
        if (variation.type === 'ITEM_VARIATION') {
          catalogObjectIds.push(variation.id);
        }
      }
    }
  }
  
  console.log(`   Found ${catalogObjectIds.length} catalog objects to check`);
  
  if (catalogObjectIds.length === 0) {
    console.log('   ⚠️  No catalog objects found, skipping inventory count fetch\n');
    return { updated: 0, errors: 0 };
  }
  
  const client = await pool.connect();
  let updated = 0;
  let errors = 0;
  
  try {
    // Square's BatchRetrieveInventoryCounts API can handle up to 1000 objects per request
    // We'll batch them if needed
    const batchSize = 1000;
    const batches = [];
    
    for (let i = 0; i < catalogObjectIds.length; i += batchSize) {
      batches.push(catalogObjectIds.slice(i, i + batchSize));
    }
    
    console.log(`   Fetching inventory counts in ${batches.length} batch(es)...`);
    
    const inventoryCountsMap = new Map(); // Map variation_id -> quantity
    
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      console.log(`   Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} items)...`);
      
      try {
        // Call Square's BatchRetrieveInventoryCounts API
        // Square SDK v43+ uses: inventoryApi.batchRetrieveInventoryCounts()
        let response;
        let counts = [];
        
        // Square SDK doesn't expose batchRetrieveInventoryCounts, so use direct HTTP call
        const https = await import('https');
        const data = JSON.stringify({
          catalog_object_ids: batch,
          location_ids: [locationId],
        });
        
        const hostname = environment === 'production' ? 'connect.squareup.com' : 'connect.squareupsandbox.com';
        const options = {
          hostname: hostname,
          path: '/v2/inventory/counts/batch-retrieve',
          method: 'POST',
          headers: {
            'Square-Version': '2024-01-18',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          },
        };
        
        response = await new Promise((resolve, reject) => {
          const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (parsed.errors && parsed.errors.length > 0) {
                  reject(new Error(`Square API errors: ${JSON.stringify(parsed.errors)}`));
                } else {
                  resolve({ result: parsed });
                }
              } catch (e) {
                reject(new Error(`Failed to parse response: ${e.message}`));
              }
            });
          });
          req.on('error', reject);
          req.write(data);
          req.end();
        });
        
        // Handle response - Square SDK may return data in different formats
        if (response) {
          if (response.result?.counts) {
            counts = response.result.counts;
          } else if (response.data?.counts) {
            counts = response.data.counts;
          } else if (response.counts) {
            counts = response.counts;
          } else if (response.getCounts && typeof response.getCounts === 'function') {
            counts = response.getCounts() || [];
          } else if (response.rawResponse?.body) {
            // Try parsing raw response
            try {
              const body = typeof response.rawResponse.body === 'string' 
                ? JSON.parse(response.rawResponse.body) 
                : response.rawResponse.body;
              if (body.counts) {
                counts = body.counts;
              } else if (body.result?.counts) {
                counts = body.result.counts;
              }
            } catch (parseError) {
              // Ignore parse errors
            }
          }
        }
        
        // Process each count
        for (const count of counts) {
          const catalogObjectId = count.catalogObjectId || count.catalog_object_id;
          // Square API returns quantity as a string in the format "123" or null
          const quantity = count.quantity || '0';
          
          // Convert quantity to number (handle string format)
          let quantityNum = 0;
          if (quantity !== null && quantity !== undefined) {
            quantityNum = typeof quantity === 'string' ? parseInt(quantity, 10) : Number(quantity);
            if (isNaN(quantityNum)) {
              quantityNum = 0;
            }
          }
          
          if (catalogObjectId) {
            // Use the latest count if multiple counts exist for same object
            inventoryCountsMap.set(catalogObjectId, quantityNum);
          }
        }
        
        console.log(`      ✓ Retrieved ${counts.length} inventory counts from batch ${batchIdx + 1}`);
        
        // Rate limiting: small delay between batches
        if (batchIdx < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.error(`   ⚠️  Error fetching batch ${batchIdx + 1}:`, error.message);
        errors++;
      }
    }
    
    console.log(`   ✅ Retrieved ${inventoryCountsMap.size} inventory counts total\n`);
    
    // Update products table with stock counts
    console.log('💾 Updating product stock counts in database...');
    await client.query('BEGIN');
    
    for (const [variationId, quantity] of inventoryCountsMap.entries()) {
      try {
        // Update the product's stock_count
        // Note: variation_id is used as product_id in our schema
        await client.query(`
          UPDATE products 
          SET stock_count = $1, updated_at = NOW()
          WHERE id = $2
        `, [quantity, variationId]);
        
        updated++;
      } catch (error) {
        console.error(`   ⚠️  Error updating stock_count for ${variationId}:`, error.message);
        errors++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`   ✅ Updated ${updated} product stock counts (${errors} errors)\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Error fetching/updating inventory counts:', error.message);
    throw error;
  } finally {
    client.release();
  }
  
  return { updated, errors };
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get output filename from command line or use default
    const outputFile = process.argv[2] || 'square-products.json';
    const outputPath = join(process.cwd(), outputFile);

    console.log('🚀 Starting Square Catalog fetch...\n');

    // Test authentication first
    const authSuccess = await testAuthentication();
    if (!authSuccess) {
      console.error('\n❌ Authentication failed. Please check:');
      console.error('   1. Your SQUARE_ACCESS_TOKEN is valid and not expired');
      console.error('   2. Your SQUARE_ENVIRONMENT matches your token (sandbox vs production)');
      console.error('   3. Your token has the required permissions (CATALOG_READ)');
      console.error('\n💡 Tip: Square access tokens expire after 30 days. You may need to regenerate it.');
      process.exit(1);
    }
    
    console.log(''); // Empty line for spacing

    // Fetch all catalog objects
    const catalogObjects = await fetchAllCatalogObjects();

    // Process catalog objects (maintain full structure)
    console.log('📦 Processing catalog objects...');
    const processedObjects = processCatalogObjects(catalogObjects);
    console.log(`✅ Processed ${processedObjects.length} objects\n`);

    // Extract clean product data (Task 0.2)
    console.log('🔍 Extracting clean product data...');
    const cleanProducts = extractCleanProductData(processedObjects);
    console.log(`✅ Extracted ${cleanProducts.length} products\n`);
    
    // Write clean product data to separate file
    const cleanOutputPath = outputPath.replace('.json', '-clean.json');
    const cleanOutput = {
      metadata: {
        fetched_at: new Date().toISOString(),
        location_id: locationId,
        environment: environment,
        total_products: cleanProducts.length,
      },
      products: cleanProducts,
    };
    
    writeFileSync(cleanOutputPath, JSON.stringify(cleanOutput, null, 2), 'utf8');
    console.log(`✅ Clean product data exported to: ${cleanOutputPath}\n`);

    // Create output structure matching Square API format (full data)
    const output = {
      cursor: null, // No cursor for final output (all data fetched)
      objects: processedObjects,
    };

    // Write full data to file with BigInt handling
    const jsonString = JSON.stringify(output, (key, value) => {
      // Convert BigInt to string
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }, 2);
    
    writeFileSync(outputPath, jsonString, 'utf8');

    // Count items and variations for summary
    const items = processedObjects.filter(obj => obj.type === 'ITEM');
    const variations = processedObjects.filter(obj => obj.type === 'ITEM_VARIATION');
    const itemsWithVariations = items.filter(item => 
      item.item_data?.variations && item.item_data.variations.length > 0
    );
    const itemsWithSku = cleanProducts.filter(p => p.sku).length;

    console.log('📄 Output Summary:');
    console.log(`   Full data file: ${outputPath}`);
    console.log(`   Clean data file: ${cleanOutputPath}`);
    console.log(`   Total objects: ${processedObjects.length}`);
    console.log(`   Items: ${items.length}`);
    console.log(`   Variations: ${variations.length}`);
    console.log(`   Items with variations: ${itemsWithVariations.length}`);
    console.log(`   Products with SKU: ${itemsWithSku}\n`);

    // Task 0.3: UPSERT into Neon database
    console.log('🗄️  Connecting to Neon database...');
    const pool = getDatabasePool();
    
    try {
      // Test connection
      await pool.query('SELECT 1');
      console.log('✅ Connected to Neon database\n');
      
      // UPSERT products
      const productResult = await upsertProducts(pool, processedObjects);
      
      // Create initial inventory records
      const inventoryResult = await createInitialInventory(pool, processedObjects);
      
      // Fetch and update inventory counts from Square
      const inventoryCountsResult = await fetchAndUpdateInventoryCounts(pool, processedObjects);
      
      console.log('📊 Database Summary:');
      console.log(`   Products upserted: ${productResult.upserted}`);
      console.log(`   Inventory records created: ${inventoryResult.created}`);
      if (inventoryResult.skipped > 0) {
        console.log(`   Inventory records skipped (already exist): ${inventoryResult.skipped}`);
      }
      console.log(`   Stock counts updated: ${inventoryCountsResult.updated}`);
      console.log(`   Errors: ${productResult.errors + inventoryResult.errors + inventoryCountsResult.errors}\n`);
      
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      console.error('   Skipping database operations. Files were still exported.\n');
    } finally {
      await pool.end();
    }

    console.log('✅ Success! All operations completed.');
  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();

