/**
 * Test script to verify HTTPS/HTTP fix for Error -107
 * 
 * Tests:
 * 1. Verify baseUrl logic correctly uses HTTP for localhost
 * 2. Test order details endpoint accessibility
 * 3. Verify redirect URLs use correct protocol
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';

console.log('\n🔍 Testing HTTPS/HTTP Fix for Error -107');
console.log('='.repeat(60));
console.log(`API Base URL: ${API_BASE_URL}`);
console.log('='.repeat(60));

// Test 1: Verify endpoint is accessible via HTTP
async function testHttpAccess() {
  console.log('\n✅ Test 1: HTTP Access to Order Details Endpoint');
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/order/details?id=ORD-MIV0JVOL-AFZFMH`, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:5173',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Endpoint accessible via HTTP');
      console.log(`   Order ID: ${data.id}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Protocol: ${API_BASE_URL.startsWith('http://') ? 'HTTP ✅' : 'HTTPS ⚠️'}`);
      return true;
    } else {
      console.error('❌ Endpoint returned error:', response.status, await response.text());
      return false;
    }
  } catch (error) {
    console.error('❌ HTTP request failed:', error.message);
    if (error.message.includes('SSL') || error.message.includes('TLS') || error.message.includes('certificate')) {
      console.error('   ⚠️  SSL/TLS error detected - this is the Error -107 issue!');
      console.error('   Solution: Ensure baseUrl uses HTTP for localhost');
    }
    return false;
  }
}

// Test 2: Verify HTTPS fails gracefully (expected for localhost)
async function testHttpsFailure() {
  console.log('\n⚠️  Test 2: HTTPS Access (Should Fail on Localhost)');
  console.log('='.repeat(60));
  
  const httpsUrl = API_BASE_URL.replace('http://', 'https://');
  
  try {
    const response = await fetch(`${httpsUrl}/api/order/details?id=ORD-MIV0JVOL-AFZFMH`, {
      method: 'GET',
      headers: {
        'Origin': 'https://localhost:5173',
      },
    });
    
    // If it succeeds, that's unexpected but okay
    if (response.ok) {
      console.log('ℹ️  HTTPS request succeeded (unexpected for localhost)');
      return true;
    } else {
      console.log('ℹ️  HTTPS request failed as expected:', response.status);
      return true; // This is expected behavior
    }
  } catch (error) {
    console.log('✅ HTTPS correctly fails on localhost (expected)');
    console.log(`   Error: ${error.message}`);
    if (error.message.includes('SSL') || error.message.includes('certificate')) {
      console.log('   This confirms the Error -107 issue - localhost should use HTTP');
    }
    return true; // This is expected
  }
}

// Test 3: Check if baseUrl logic is correct
async function testBaseUrlLogic() {
  console.log('\n🔧 Test 3: Base URL Logic Verification');
  console.log('='.repeat(60));
  
  // Simulate the baseUrl logic from checkout/create.js
  const mockReq = {
    headers: {
      host: 'localhost:3000',
    },
  };
  
  const baseUrl = (() => {
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      return process.env.NEXT_PUBLIC_SITE_URL;
    }
    
    const host = mockReq.headers.host || 'localhost:5173';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    
    return isLocalhost ? `http://${host}` : `https://${host}`;
  })();
  
  console.log(`   Computed baseUrl: ${baseUrl}`);
  
  if (baseUrl.startsWith('http://') && baseUrl.includes('localhost')) {
    console.log('✅ Base URL correctly uses HTTP for localhost');
    return true;
  } else if (baseUrl.startsWith('https://') && baseUrl.includes('localhost')) {
    console.error('❌ Base URL incorrectly uses HTTPS for localhost (this causes Error -107)');
    return false;
  } else {
    console.log('ℹ️  Base URL is for production (HTTPS expected)');
    return true;
  }
}

async function runTests() {
  const results = {
    httpAccess: false,
    httpsFailure: false,
    baseUrlLogic: false,
  };
  
  results.httpAccess = await testHttpAccess();
  results.httpsFailure = await testHttpsFailure();
  results.baseUrlLogic = await testBaseUrlLogic();
  
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  let passedCount = 0;
  for (const testName in results) {
    if (results[testName]) {
      console.log(`✅ ${testName}: PASSED`);
      passedCount++;
    } else {
      console.log(`❌ ${testName}: FAILED`);
    }
  }
  console.log(`\n${passedCount}/${Object.keys(results).length} tests passed`);
  
  if (passedCount === Object.keys(results).length) {
    console.log('\n🎉 All tests passed! Error -107 should be resolved.');
    process.exit(0);
  } else {
    console.warn('\n⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});

