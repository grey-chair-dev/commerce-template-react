/**
 * Migration script to add pickup_details column to orders table
 * Run this once to add the pickup_details JSONB column for storing pickup customer info
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const databaseUrl = process.env.SPR_DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Error: SPR_DATABASE_URL environment variable is not set.');
  console.error('Please ensure SPR_DATABASE_URL is set in your .env.local file.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function addPickupDetailsColumn() {
  try {
    console.log('Adding pickup_details column to orders table...');
    
    // Add pickup_details column if it doesn't exist
    await sql`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS pickup_details JSONB;
    `;
    
    console.log('✅ Successfully added pickup_details column to orders table');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name = 'pickup_details';
    `;
    
    if (result.length > 0) {
      console.log('✅ Verified: pickup_details column exists');
      console.log('Column details:', result[0]);
    } else {
      console.warn('⚠️  Warning: pickup_details column not found after creation');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding pickup_details column:', error);
    process.exit(1);
  }
}

addPickupDetailsColumn();

