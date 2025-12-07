/**
 * Create auth_logs table for tracking login attempts
 * 
 * This table stores login attempts to enable authentication failure rate monitoring.
 * 
 * Usage:
 *   node scripts/create-auth-logs-table.js
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

async function createAuthLogsTable() {
  const databaseUrl = process.env.SPR_DATABASE_URL || 
                     process.env.NEON_DATABASE_URL || 
                     process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Database URL not configured');
    console.error('Set SPR_DATABASE_URL in .env.local');
    process.exit(1);
  }
  
  try {
    const sql = neon(databaseUrl);
    
    console.log('📋 Creating auth_logs table...');
    
    await sql`
      CREATE TABLE IF NOT EXISTS auth_logs (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        status VARCHAR(50) NOT NULL, -- 'success' or 'failure'
        error_code VARCHAR(50), -- 'invalid_credentials', 'database_error', etc.
        ip_address VARCHAR(45), -- IPv4 or IPv6
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('✅ Created auth_logs table');
    
    // Create index for efficient queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON auth_logs(status)
    `;
    
    console.log('✅ Created indexes on auth_logs table');
    console.log('');
    console.log('📋 Table structure:');
    console.log('  - id: SERIAL PRIMARY KEY');
    console.log('  - email: VARCHAR(255)');
    console.log('  - status: VARCHAR(50) - "success" or "failure"');
    console.log('  - error_code: VARCHAR(50) - optional error code');
    console.log('  - ip_address: VARCHAR(45)');
    console.log('  - user_agent: TEXT');
    console.log('  - created_at: TIMESTAMP WITH TIME ZONE');
    console.log('');
    console.log('✅ Auth logging is now ready!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Update /api/auth/login to log attempts to this table');
    console.log('  2. Run /api/monitoring/auth-failure-rate to check failure rates');
    
  } catch (error) {
    console.error('❌ Error creating auth_logs table:', error);
    process.exit(1);
  }
}

createAuthLogsTable();

