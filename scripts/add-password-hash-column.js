/**
 * Migration script to add password_hash column to customers table
 * Run this once to add the password_hash column for storing bcrypt hashes
 */

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.SPR_DATABASE_URL);

async function addPasswordHashColumn() {
  try {
    console.log('Adding password_hash column to customers table...');
    
    // Add password_hash column if it doesn't exist
    await sql`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    `;
    
    console.log('✅ Successfully added password_hash column to customers table');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'password_hash';
    `;
    
    if (result.length > 0) {
      console.log('✅ Verified: password_hash column exists');
      console.log('Column details:', result[0]);
    } else {
      console.warn('⚠️  Warning: password_hash column not found after creation');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding password_hash column:', error);
    process.exit(1);
  }
}

addPasswordHashColumn();

