/**
 * Create password_reset_tokens table
 * 
 * This table stores password reset tokens for users who request password resets.
 * Tokens expire after 1 hour and are single-use.
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

if (!process.env.SPR_DATABASE_URL) {
  console.error('❌ SPR_DATABASE_URL not configured in .env.local');
  process.exit(1);
}

const sql = neon(process.env.SPR_DATABASE_URL);

async function createPasswordResetTokensTable() {
  try {
    console.log('Creating password_reset_tokens table...');

    await sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        used_at TIMESTAMP WITH TIME ZONE
      )
    `;

    // Create indexes for performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_customer_id ON password_reset_tokens(customer_id)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at)
    `;

    // Create a function to automatically clean up expired tokens (optional, can be done via cron)
    await sql`
      CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
      RETURNS void AS $$
      BEGIN
        DELETE FROM password_reset_tokens
        WHERE expires_at < CURRENT_TIMESTAMP
        OR (used = TRUE AND used_at < CURRENT_TIMESTAMP - INTERVAL '7 days');
      END;
      $$ LANGUAGE plpgsql;
    `;

    console.log('✅ password_reset_tokens table created successfully!');
    console.log('\nTable structure:');
    console.log('  - id: SERIAL PRIMARY KEY');
    console.log('  - customer_id: VARCHAR(255) REFERENCES customers(id)');
    console.log('  - email: VARCHAR(255) NOT NULL');
    console.log('  - token: VARCHAR(255) UNIQUE NOT NULL');
    console.log('  - expires_at: TIMESTAMP WITH TIME ZONE NOT NULL');
    console.log('  - used: BOOLEAN DEFAULT FALSE');
    console.log('  - created_at: TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP');
    console.log('  - used_at: TIMESTAMP WITH TIME ZONE');
    console.log('\nIndexes created:');
    console.log('  - idx_password_reset_tokens_token');
    console.log('  - idx_password_reset_tokens_customer_id');
    console.log('  - idx_password_reset_tokens_email');
    console.log('  - idx_password_reset_tokens_expires_at');
    console.log('\nCleanup function created: cleanup_expired_reset_tokens()');
  } catch (error) {
    console.error('❌ Error creating password_reset_tokens table:', error);
    process.exit(1);
  }
}

createPasswordResetTokensTable();

