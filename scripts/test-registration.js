/**
 * Test Registration Endpoint
 * 
 * Tests the /api/auth/register endpoint with various scenarios
 */

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const REGISTER_URL = `${API_URL}/api/auth/register`;

async function testRegistration() {
  console.log('\n🧪 Testing Registration Endpoint\n');
  console.log('='.repeat(80));

  // Test 1: Valid registration
  console.log('\n1️⃣  Testing valid registration...');
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123',
        firstName: 'Test',
        lastName: 'User',
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ PASSED: Valid registration succeeded');
      console.log(`   Customer ID: ${data.customer.id}`);
      console.log(`   Email: ${data.customer.email}`);
      console.log(`   Token generated: ${data.token ? 'Yes' : 'No'}`);
    } else {
      console.error('❌ FAILED: Valid registration failed');
      console.error('   Response:', data);
      return;
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error.message);
    return;
  }

  // Test 2: Duplicate email
  console.log('\n2️⃣  Testing duplicate email rejection...');
  try {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;

    // First registration
    await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: duplicateEmail,
        password: 'TestPassword123',
      }),
    });

    // Second registration with same email
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: duplicateEmail,
        password: 'TestPassword123',
      }),
    });

    const data = await response.json();

    if (response.status === 409 && data.error === 'Email already registered') {
      console.log('✅ PASSED: Duplicate email correctly rejected');
    } else {
      console.error('❌ FAILED: Duplicate email was not rejected');
      console.error('   Response:', data);
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error.message);
  }

  // Test 3: Invalid email format
  console.log('\n3️⃣  Testing invalid email format rejection...');
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'TestPassword123',
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error === 'Invalid email format') {
      console.log('✅ PASSED: Invalid email format correctly rejected');
    } else {
      console.error('❌ FAILED: Invalid email format was not rejected');
      console.error('   Response:', data);
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error.message);
  }

  // Test 4: Weak password
  console.log('\n4️⃣  Testing weak password rejection...');
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        password: 'weak', // Too short
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error === 'Password does not meet requirements') {
      console.log('✅ PASSED: Weak password correctly rejected');
      console.log(`   Validation errors: ${data.details.join(', ')}`);
    } else {
      console.error('❌ FAILED: Weak password was not rejected');
      console.error('   Response:', data);
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error.message);
  }

  // Test 5: Missing required fields
  console.log('\n5️⃣  Testing missing required fields...');
  try {
    const response = await fetch(REGISTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        // Missing password
      }),
    });

    const data = await response.json();

    if (response.status === 400 && data.error === 'Missing required fields') {
      console.log('✅ PASSED: Missing fields correctly rejected');
    } else {
      console.error('❌ FAILED: Missing fields were not rejected');
      console.error('   Response:', data);
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Registration endpoint tests completed!\n');
}

// Run tests
testRegistration().catch(console.error);

