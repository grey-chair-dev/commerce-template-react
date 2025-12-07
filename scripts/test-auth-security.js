/**
 * Authentication & Security Test Suite
 * 
 * Tests A-201 through A-204 for authentication, security, and checkout integration
 * 
 * Usage:
 *   node scripts/test-auth-security.js [test-id]
 * 
 * Examples:
 *   node scripts/test-auth-security.js A-201  # Test registration
 *   node scripts/test-auth-security.js A-202  # Test login & session
 *   node scripts/test-auth-security.js A-203  # Test JWT security
 *   node scripts/test-auth-security.js A-204  # Test login during checkout
 *   node scripts/test-auth-security.js        # Run all tests
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const databaseUrl = process.env.SPR_DATABASE_URL || 
                    process.env.SPR_NEON_DATABSE_URL || 
                    process.env.DATABASE_URL || 
                    process.env.NEON_DATABASE_URL ||
                    process.env.SPR_POSTGRES_URL ||
                    process.env.POSTGRES_URL;
const jwtSecret = process.env.JWT_SECRET;

if (!databaseUrl) {
  console.error('❌ Database URL not configured');
  console.error('Set one of these in .env.local:');
  console.error('  - SPR_DATABASE_URL');
  console.error('  - DATABASE_URL');
  process.exit(1);
}

if (!jwtSecret) {
  console.error('❌ JWT_SECRET not configured');
  console.error('Set JWT_SECRET in .env.local');
  process.exit(1);
}

const sql = neon(databaseUrl);

// Helper function to generate test email
function generateTestEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@example.com`;
}

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const baseUrl = process.env.VITE_API_URL || 'http://localhost:3000';
  const url = `${baseUrl}${endpoint}`;
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };
  
  try {
    const response = await fetch(url, defaultOptions);
    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      cookies: response.headers.get('set-cookie') || null,
    };
  } catch (error) {
    return {
      status: 0,
      error: error.message,
    };
  }
}

/**
 * Test A-201: Registration
 * Verify that sign up creates a new record in Neon customers table with hashed password
 */
async function testA201() {
  console.log('\n📋 Test A-201: Registration');
  console.log('='.repeat(60));
  
  try {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';
    const testFirstName = 'Test';
    const testLastName = 'User';
    
    console.log(`\n📝 Test Data:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${'*'.repeat(testPassword.length)}`);
    console.log(`   Name: ${testFirstName} ${testLastName}`);
    
    // Check if user already exists
    const existingUser = await sql`
      SELECT id, email FROM customers WHERE email = ${testEmail}
    `;
    
    if (existingUser.length > 0) {
      console.log(`\n⚠️  Test user already exists, cleaning up...`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
    }
    
    // Register new user
    console.log(`\n🔄 Registering new user...`);
    const registerResponse = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        firstName: testFirstName,
        lastName: testLastName,
      }),
    });
    
    if (registerResponse.status !== 200 && registerResponse.status !== 201) {
      console.error(`❌ Registration failed: ${registerResponse.status}`);
      console.error(`   Response:`, registerResponse.data);
      return false;
    }
    
    console.log(`✅ Registration API call successful`);
    
    // Verify user was created in database
    console.log(`\n🔍 Verifying database record...`);
    const newUser = await sql`
      SELECT id, email, first_name, last_name, password_hash, created_at
      FROM customers
      WHERE email = ${testEmail}
    `;
    
    if (newUser.length === 0) {
      console.error(`❌ User not found in database`);
      return false;
    }
    
    const user = newUser[0];
    console.log(`✅ User found in database:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   First Name: ${user.first_name}`);
    console.log(`   Last Name: ${user.last_name}`);
    
    // Verify password is hashed (not plaintext)
    console.log(`\n🔐 Verifying password hash...`);
    if (!user.password_hash) {
      console.error(`❌ password_hash is null or empty`);
      return false;
    }
    
    if (user.password_hash === testPassword) {
      console.error(`❌ Password is stored in plaintext!`);
      return false;
    }
    
    // Verify hash format (bcrypt hashes start with $2a$, $2b$, or $2y$)
    if (!user.password_hash.startsWith('$2')) {
      console.error(`❌ Password hash doesn't appear to be bcrypt format`);
      console.error(`   Hash starts with: ${user.password_hash.substring(0, 10)}`);
      return false;
    }
    
    // Verify hash length (bcrypt hashes are typically 60 characters)
    if (user.password_hash.length < 50) {
      console.error(`❌ Password hash seems too short (${user.password_hash.length} chars)`);
      return false;
    }
    
    console.log(`✅ Password is hashed (bcrypt format)`);
    console.log(`   Hash length: ${user.password_hash.length} characters`);
    console.log(`   Hash preview: ${user.password_hash.substring(0, 20)}...`);
    
    // Verify password can be verified with bcrypt
    const bcrypt = await import('bcrypt');
    const passwordMatches = await bcrypt.compare(testPassword, user.password_hash);
    if (!passwordMatches) {
      console.error(`❌ Password hash verification failed`);
      return false;
    }
    
    console.log(`✅ Password hash verification successful`);
    
    // Cleanup
    console.log(`\n🧹 Cleaning up test user...`);
    await sql`DELETE FROM customers WHERE email = ${testEmail}`;
    console.log(`✅ Test user deleted`);
    
    console.log(`\n✅ Test A-201 PASSED: Registration creates user with hashed password`);
    return true;
  } catch (error) {
    console.error('❌ Test A-201 FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test A-202: Login & Session
 * Verify that login returns HTTP-only cookie with JWT and user info appears
 */
async function testA202() {
  console.log('\n📋 Test A-202: Login & Session');
  console.log('='.repeat(60));
  
  try {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';
    const testFirstName = 'Test';
    const testLastName = 'User';
    
    // Create test user first
    console.log(`\n📝 Creating test user...`);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    await sql`
      INSERT INTO customers (id, email, first_name, last_name, password_hash, created_at)
      VALUES (gen_random_uuid(), ${testEmail}, ${testFirstName}, ${testLastName}, ${passwordHash}, NOW())
      RETURNING id
    `;
    
    console.log(`✅ Test user created: ${testEmail}`);
    
    // Attempt login
    console.log(`\n🔄 Attempting login...`);
    const loginResponse = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    
    if (loginResponse.status !== 200) {
      console.error(`❌ Login failed: ${loginResponse.status}`);
      console.error(`   Response:`, loginResponse.data);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ Login API call successful`);
    
    // Verify HTTP-only cookie was set
    console.log(`\n🍪 Verifying cookie...`);
    if (!loginResponse.cookies) {
      console.error(`❌ No cookie set in response`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    // Check for auth_token cookie
    const cookieHeader = loginResponse.cookies;
    if (!cookieHeader.includes('auth_token=')) {
      console.error(`❌ auth_token cookie not found`);
      console.error(`   Cookies: ${cookieHeader}`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    // Verify cookie is HTTP-only
    if (!cookieHeader.includes('HttpOnly')) {
      console.error(`❌ Cookie is not HttpOnly`);
      console.error(`   Cookie: ${cookieHeader}`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ HTTP-only cookie set`);
    console.log(`   Cookie preview: ${cookieHeader.substring(0, 100)}...`);
    
    // Extract JWT from cookie
    const cookieMatch = cookieHeader.match(/auth_token=([^;]+)/);
    if (!cookieMatch) {
      console.error(`❌ Could not extract JWT from cookie`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const token = cookieMatch[1];
    console.log(`✅ JWT token extracted`);
    console.log(`   Token preview: ${token.substring(0, 50)}...`);
    
    // Verify JWT structure
    try {
      const decoded = jwt.verify(token, jwtSecret);
      console.log(`✅ JWT token is valid`);
      console.log(`   Customer ID: ${decoded.customerId}`);
      console.log(`   Email: ${decoded.email}`);
      console.log(`   Type: ${decoded.type}`);
      
      if (decoded.type !== 'customer') {
        console.error(`❌ JWT type is not 'customer'`);
        // Cleanup
        await sql`DELETE FROM customers WHERE email = ${testEmail}`;
        return false;
      }
    } catch (jwtError) {
      console.error(`❌ JWT verification failed: ${jwtError.message}`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    // Test /api/auth/me endpoint with cookie
    console.log(`\n🔍 Testing /api/auth/me endpoint...`);
    const meResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${token}`,
      },
    });
    
    if (meResponse.status !== 200) {
      console.error(`❌ /api/auth/me failed: ${meResponse.status}`);
      console.error(`   Response:`, meResponse.data);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    if (!meResponse.data.success || !meResponse.data.customer) {
      console.error(`❌ /api/auth/me response invalid`);
      console.error(`   Response:`, meResponse.data);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const customerData = meResponse.data.customer;
    console.log(`✅ /api/auth/me returned user data:`);
    console.log(`   Email: ${customerData.email}`);
    console.log(`   First Name: ${customerData.firstName}`);
    console.log(`   Last Name: ${customerData.lastName}`);
    
    if (customerData.email !== testEmail) {
      console.error(`❌ Email mismatch`);
      // Cleanup
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    // Cleanup
    console.log(`\n🧹 Cleaning up test user...`);
    await sql`DELETE FROM customers WHERE email = ${testEmail}`;
    console.log(`✅ Test user deleted`);
    
    console.log(`\n✅ Test A-202 PASSED: Login returns HTTP-only cookie with valid JWT`);
    return true;
  } catch (error) {
    console.error('❌ Test A-202 FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test A-203: Security (JWT)
 * Verify that modified JWT tokens are rejected by security middleware
 */
async function testA203() {
  console.log('\n📋 Test A-203: Security (JWT)');
  console.log('='.repeat(60));
  
  try {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';
    
    // Create test user and get valid token
    console.log(`\n📝 Creating test user and getting valid token...`);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    const userResult = await sql`
      INSERT INTO customers (id, email, first_name, last_name, password_hash, created_at)
      VALUES (gen_random_uuid(), ${testEmail}, 'Test', 'User', ${passwordHash}, NOW())
      RETURNING id
    `;
    const userId = userResult[0].id;
    
    // Get valid token by logging in
    const loginResponse = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    
    if (loginResponse.status !== 200) {
      console.error(`❌ Login failed: ${loginResponse.status}`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const cookieMatch = loginResponse.cookies.match(/auth_token=([^;]+)/);
    if (!cookieMatch) {
      console.error(`❌ Could not extract token from login response`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const validToken = cookieMatch[1];
    console.log(`✅ Valid token obtained`);
    
    // Test 1: Modified token (tampered payload)
    console.log(`\n🔐 Test 1: Modified token (tampered payload)...`);
    try {
      const decoded = jwt.decode(validToken);
      decoded.customerId = 'fake-customer-id';
      const modifiedToken = jwt.sign(decoded, 'wrong-secret');
      
      const modifiedResponse = await apiRequest('/api/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${modifiedToken}`,
        },
      });
      
      if (modifiedResponse.status === 200) {
        console.error(`❌ Modified token was accepted!`);
        await sql`DELETE FROM customers WHERE email = ${testEmail}`;
        return false;
      }
      
      console.log(`✅ Modified token correctly rejected (${modifiedResponse.status})`);
    } catch (error) {
      console.log(`✅ Modified token correctly rejected (${error.message})`);
    }
    
    // Test 2: Expired token
    console.log(`\n🔐 Test 2: Expired token...`);
    const expiredToken = jwt.sign(
      { customerId: userId, email: testEmail, type: 'customer' },
      jwtSecret,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );
    
    const expiredResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${expiredToken}`,
      },
    });
    
    if (expiredResponse.status === 200) {
      console.error(`❌ Expired token was accepted!`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ Expired token correctly rejected (${expiredResponse.status})`);
    
    // Test 3: Token with wrong secret
    console.log(`\n🔐 Test 3: Token with wrong secret...`);
    const wrongSecretToken = jwt.sign(
      { customerId: userId, email: testEmail, type: 'customer' },
      'wrong-secret-key',
      { expiresIn: '1h' }
    );
    
    const wrongSecretResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${wrongSecretToken}`,
      },
    });
    
    if (wrongSecretResponse.status === 200) {
      console.error(`❌ Token with wrong secret was accepted!`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ Token with wrong secret correctly rejected (${wrongSecretResponse.status})`);
    
    // Test 4: Valid token should still work
    console.log(`\n🔐 Test 4: Valid token should still work...`);
    const validResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${validToken}`,
      },
    });
    
    if (validResponse.status !== 200) {
      console.error(`❌ Valid token was rejected!`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ Valid token correctly accepted`);
    
    // Cleanup
    console.log(`\n🧹 Cleaning up test user...`);
    await sql`DELETE FROM customers WHERE email = ${testEmail}`;
    console.log(`✅ Test user deleted`);
    
    console.log(`\n✅ Test A-203 PASSED: Security middleware rejects invalid tokens`);
    return true;
  } catch (error) {
    console.error('❌ Test A-203 FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test A-204: Login during Checkout
 * Verify that guest user can log in during checkout and is redirected to review with pre-filled info
 */
async function testA204() {
  console.log('\n📋 Test A-204: Login during Checkout');
  console.log('='.repeat(60));
  
  try {
    const testEmail = generateTestEmail();
    const testPassword = 'TestPassword123!';
    const testFirstName = 'Checkout';
    const testLastName = 'Test';
    const testPhone = '555-1234';
    
    // Create test user with complete info
    console.log(`\n📝 Creating test user with complete information...`);
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(testPassword, 10);
    
    const userResult = await sql`
      INSERT INTO customers (id, email, first_name, last_name, phone, password_hash, created_at)
      VALUES (gen_random_uuid(), ${testEmail}, ${testFirstName}, ${testLastName}, ${testPhone}, ${passwordHash}, NOW())
      RETURNING id
    `;
    const userId = userResult[0].id;
    
    console.log(`✅ Test user created: ${testEmail}`);
    
    // Simulate checkout flow: Guest starts checkout
    console.log(`\n🛒 Simulating guest checkout flow...`);
    console.log(`   1. Guest user starts checkout (no authentication)`);
    
    // Verify user is not authenticated initially
    const initialMeResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
    });
    
    if (initialMeResponse.status === 200) {
      console.log(`⚠️  User appears to be authenticated already (may have existing session)`);
    } else {
      console.log(`✅ User is not authenticated (as expected for guest)`);
    }
    
    // Simulate login during checkout
    console.log(`\n   2. User logs in during checkout...`);
    const loginResponse = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    
    if (loginResponse.status !== 200) {
      console.error(`❌ Login failed: ${loginResponse.status}`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ Login successful`);
    
    // Extract token
    const cookieMatch = loginResponse.cookies.match(/auth_token=([^;]+)/);
    if (!cookieMatch) {
      console.error(`❌ Could not extract token`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const token = cookieMatch[1];
    
    // Verify user data is available after login
    console.log(`\n   3. Verifying user data is available...`);
    const meResponse = await apiRequest('/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${token}`,
      },
    });
    
    if (meResponse.status !== 200 || !meResponse.data.success) {
      console.error(`❌ Failed to fetch user data: ${meResponse.status}`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    const customerData = meResponse.data.customer;
    console.log(`✅ User data retrieved:`);
    console.log(`   Email: ${customerData.email}`);
    console.log(`   First Name: ${customerData.firstName}`);
    console.log(`   Last Name: ${customerData.lastName}`);
    console.log(`   Phone: ${customerData.phone || 'not set'}`);
    
    // Verify all required fields are present
    const hasEmail = customerData.email === testEmail;
    const hasFirstName = customerData.firstName === testFirstName;
    const hasLastName = customerData.lastName === testLastName;
    const hasPhone = customerData.phone === testPhone;
    
    if (!hasEmail || !hasFirstName || !hasLastName) {
      console.error(`❌ Required fields missing:`);
      console.error(`   Email: ${hasEmail ? '✅' : '❌'}`);
      console.error(`   First Name: ${hasFirstName ? '✅' : '❌'}`);
      console.error(`   Last Name: ${hasLastName ? '✅' : '❌'}`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ All required fields present for checkout`);
    
    // Verify user has "complete info" (email, firstName, lastName)
    // Phone is optional but should be included if available
    const hasCompleteInfo = hasEmail && hasFirstName && hasLastName;
    
    if (!hasCompleteInfo) {
      console.error(`❌ User does not have complete information`);
      await sql`DELETE FROM customers WHERE email = ${testEmail}`;
      return false;
    }
    
    console.log(`✅ User has complete information for checkout`);
    console.log(`   (According to checkout logic, user should skip contact page and go to review)`);
    
    // Note: Actual redirect to review page would require frontend testing
    // This test verifies the backend data is correct
    console.log(`\n📋 Expected Frontend Behavior:`);
    console.log(`   - User should be redirected to Review Page`);
    console.log(`   - Contact form should be pre-filled with:`);
    console.log(`     * Email: ${customerData.email}`);
    console.log(`     * First Name: ${customerData.firstName}`);
    console.log(`     * Last Name: ${customerData.lastName}`);
    console.log(`     * Phone: ${customerData.phone || '(not set)'}`);
    
    // Cleanup
    console.log(`\n🧹 Cleaning up test user...`);
    await sql`DELETE FROM customers WHERE email = ${testEmail}`;
    console.log(`✅ Test user deleted`);
    
    console.log(`\n✅ Test A-204 PASSED: Login during checkout provides complete user data`);
    console.log(`   (Frontend should redirect to review and pre-fill form)`);
    return true;
  } catch (error) {
    console.error('❌ Test A-204 FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Main test runner
async function runTests() {
  const testId = process.argv[2];
  
  console.log('🧪 Authentication & Security Test Suite');
  console.log('='.repeat(60));
  
  const results = {};
  
  if (!testId || testId === 'A-201') {
    results['A-201'] = await testA201();
  }
  
  if (!testId || testId === 'A-202') {
    results['A-202'] = await testA202();
  }
  
  if (!testId || testId === 'A-203') {
    results['A-203'] = await testA203();
  }
  
  if (!testId || testId === 'A-204') {
    results['A-204'] = await testA204();
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  for (const [testId, passed] of Object.entries(results)) {
    if (passed === null) {
      console.log(`   ${testId}: ⚠️  SKIPPED`);
    } else if (passed === true) {
      console.log(`   ${testId}: ✅ PASSED`);
    } else {
      console.log(`   ${testId}: ❌ FAILED`);
    }
  }
  
  // Filter out skipped tests
  const testResults = Object.entries(results).filter(([_, passed]) => passed !== null);
  const allPassed = testResults.every(([_, passed]) => passed === true);
  const hasSkipped = Object.values(results).some(r => r === null);
  
  if (allPassed) {
    if (hasSkipped) {
      console.log('\n✅ All automated tests passed!');
      console.log('   (Some tests were skipped - see details above)');
    } else {
      console.log('\n✅ All tests passed!');
    }
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

