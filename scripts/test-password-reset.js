/**
 * Test Password Reset Flow
 * 
 * Tests the password reset functionality:
 * 1. Creates a test user (if needed)
 * 2. Calls /api/auth/forgot-password
 * 3. Verifies token is created in database
 * 4. Tests /api/auth/reset-password with the token
 * 5. Verifies password is updated
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
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'http://localhost:3000';

// Test user credentials
const TEST_EMAIL = `test-password-reset-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123';
const NEW_PASSWORD = 'NewPassword456';

let testUserId = null;
let resetToken = null;

/**
 * Create a test user
 */
async function createTestUser() {
  console.log('\n📝 Step 1: Creating test user...');
  
  try {
    // Check if user already exists
    const existing = await sql`
      SELECT id FROM customers WHERE email = ${TEST_EMAIL}
    `;
    
    if (existing && existing.length > 0) {
      testUserId = existing[0].id;
      console.log(`✅ Test user already exists: ${TEST_EMAIL}`);
      return;
    }

    // Create new user
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const { randomUUID } = await import('crypto');
    
    const result = await sql`
      INSERT INTO customers (id, email, first_name, last_name, password_hash)
      VALUES (${randomUUID()}, ${TEST_EMAIL}, 'Test', 'User', ${passwordHash})
      RETURNING id
    `;
    
    testUserId = result[0].id;
    console.log(`✅ Test user created: ${TEST_EMAIL} (ID: ${testUserId})`);
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    throw error;
  }
}

/**
 * Test forgot-password endpoint
 */
async function testForgotPassword() {
  console.log('\n📧 Step 2: Testing forgot-password endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Forgot password failed:', data);
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    console.log('✅ Forgot password request successful');
    console.log(`   Response: ${data.message}`);

    // Verify token was created in database
    const tokenResult = await sql`
      SELECT token, expires_at, used
      FROM password_reset_tokens
      WHERE email = ${TEST_EMAIL}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!tokenResult || tokenResult.length === 0) {
      throw new Error('❌ No reset token found in database');
    }

    resetToken = tokenResult[0].token;
    const expiresAt = new Date(tokenResult[0].expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);

    console.log(`✅ Reset token created in database`);
    console.log(`   Token: ${resetToken.substring(0, 20)}...`);
    console.log(`   Expires at: ${expiresAt.toISOString()}`);
    console.log(`   Expires in: ${hoursUntilExpiry.toFixed(2)} hours`);
    console.log(`   Used: ${tokenResult[0].used}`);

    if (hoursUntilExpiry < 0.9 || hoursUntilExpiry > 1.1) {
      console.warn(`⚠️  Token expiration time is unexpected: ${hoursUntilExpiry.toFixed(2)} hours (expected ~1 hour)`);
    }

    return true;
  } catch (error) {
    console.error('❌ Forgot password test failed:', error.message);
    throw error;
  }
}

/**
 * Test reset-password endpoint
 */
async function testResetPassword() {
  console.log('\n🔐 Step 3: Testing reset-password endpoint...');
  
  if (!resetToken) {
    throw new Error('No reset token available. Run forgot-password test first.');
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: resetToken,
        password: NEW_PASSWORD,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Reset password failed:', data);
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    console.log('✅ Password reset successful');
    console.log(`   Response: ${data.message}`);

    // Verify token is marked as used
    const tokenResult = await sql`
      SELECT used, used_at
      FROM password_reset_tokens
      WHERE token = ${resetToken}
    `;

    if (!tokenResult || tokenResult.length === 0) {
      throw new Error('❌ Token not found after reset');
    }

    if (!tokenResult[0].used) {
      throw new Error('❌ Token was not marked as used');
    }

    console.log(`✅ Token marked as used`);
    console.log(`   Used at: ${tokenResult[0].used_at}`);

    // Verify password was updated
    const bcrypt = await import('bcrypt');
    const userResult = await sql`
      SELECT password_hash FROM customers WHERE id = ${testUserId}
    `;

    if (!userResult || userResult.length === 0) {
      throw new Error('❌ User not found');
    }

    const isNewPasswordValid = await bcrypt.compare(NEW_PASSWORD, userResult[0].password_hash);
    const isOldPasswordInvalid = await bcrypt.compare(TEST_PASSWORD, userResult[0].password_hash);

    if (!isNewPasswordValid) {
      throw new Error('❌ New password hash does not match');
    }

    if (isOldPasswordInvalid) {
      throw new Error('❌ Old password still works (password not updated)');
    }

    console.log(`✅ Password hash updated correctly`);
    console.log(`   New password works: ✅`);
    console.log(`   Old password invalid: ✅`);

    return true;
  } catch (error) {
    console.error('❌ Reset password test failed:', error.message);
    throw error;
  }
}

/**
 * Test Make.com webhook payload (simulate)
 */
async function testMakeWebhookPayload() {
  console.log('\n🔗 Step 4: Verifying Make.com webhook payload structure...');
  
  try {
    // Get the latest token to construct what would be sent
    const tokenResult = await sql`
      SELECT token, email
      FROM password_reset_tokens
      WHERE email = ${TEST_EMAIL}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (!tokenResult || tokenResult.length === 0) {
      console.log('⚠️  No token found, skipping webhook payload test');
      return;
    }

    const baseUrl = BASE_URL.replace('localhost:3000', 'localhost:5173');
    const resetUrl = `${baseUrl}/reset-password?token=${tokenResult[0].token}`;

    // This is what Make.com would receive
    const expectedPayload = {
      to: TEST_EMAIL,
      subject: 'Reset Your Password - Spiral Groove Records',
      html: '[HTML content with SPIRAL GROOVE branding]',
      text: '[Plain text version]',
      customerName: 'Test',
      resetUrl: resetUrl,
      emailType: 'password-reset',
    };

    console.log('✅ Expected Make.com webhook payload structure:');
    console.log(`   to: ${expectedPayload.to}`);
    console.log(`   subject: ${expectedPayload.subject}`);
    console.log(`   html: [HTML content with SPIRAL GROOVE branding]`);
    console.log(`   text: [Plain text version]`);
    console.log(`   customerName: ${expectedPayload.customerName}`);
    console.log(`   resetUrl: ${expectedPayload.resetUrl}`);
    console.log(`   emailType: ${expectedPayload.emailType}`);

    console.log('\n💡 To test Make.com webhook:');
    console.log(`   1. Ensure MAKE_WEBHOOK_URL is set in .env.local`);
    console.log(`   2. Trigger a password reset from the app`);
    console.log(`   3. Check Make.com executions to see the webhook data`);

    return true;
  } catch (error) {
    console.error('❌ Webhook payload test failed:', error.message);
    throw error;
  }
}

/**
 * Cleanup test data
 */
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    if (testUserId) {
      // Delete reset tokens
      await sql`
        DELETE FROM password_reset_tokens
        WHERE email = ${TEST_EMAIL}
      `;
      console.log('✅ Reset tokens deleted');

      // Delete test user
      await sql`
        DELETE FROM customers
        WHERE id = ${testUserId}
      `;
      console.log('✅ Test user deleted');
    }
  } catch (error) {
    console.error('⚠️  Cleanup error (non-critical):', error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Password Reset Flow Test');
  console.log('=' .repeat(50));
  console.log(`\nTest Email: ${TEST_EMAIL}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Make.com Webhook: ${process.env.MAKE_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}`);

  let allTestsPassed = true;

  try {
    // Step 1: Create test user
    await createTestUser();

    // Step 2: Test forgot password
    await testForgotPassword();

    // Step 3: Test reset password
    await testResetPassword();

    // Step 4: Verify webhook payload
    await testMakeWebhookPayload();

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Test failed:', error.message);
    console.error('='.repeat(50));
    allTestsPassed = false;
  } finally {
    await cleanup();
  }

  process.exit(allTestsPassed ? 0 : 1);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  cleanup().then(() => process.exit(1));
});

// Run tests
runTests();

