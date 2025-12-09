#!/usr/bin/env node

/**
 * End-to-End Flow Test
 * 
 * Tests the complete authentication and checkout flow:
 * 1. User Registration
 * 2. User Login
 * 3. Get User Info (verify session)
 * 4. Create Checkout Order
 * 5. Verify Order in Database
 * 6. Check Order Confirmation
 */

import fetch from 'node-fetch';
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const TEST_EMAIL = `test-e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test1234!';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

let authCookie = null;
let customerId = null;
let orderId = null;
let orderNumber = null;

// Helper to make requests with cookies
async function makeRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (authCookie) {
    headers['Cookie'] = authCookie;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Extract cookies from response
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    // Extract just the cookie value (before the first semicolon)
    const cookieMatch = setCookie.match(/auth_token=([^;]+)/);
    if (cookieMatch) {
      authCookie = `auth_token=${cookieMatch[1]}`;
    }
  }
  
  return response;
}

// Test 1: User Registration
async function testRegistration() {
  console.log('\n📝 Test 1: User Registration');
  console.log('='.repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: TEST_FIRST_NAME,
        lastName: TEST_LAST_NAME,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Registration successful');
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   Customer ID: ${data.customer?.id || 'N/A'}`);
      customerId = data.customer?.id;
      return true;
    } else {
      console.error('❌ Registration failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Registration error:', error.message);
    return false;
  }
}

// Test 2: User Login
async function testLogin() {
  console.log('\n🔐 Test 2: User Login');
  console.log('='.repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Login successful');
      console.log(`   Email: ${data.customer?.email || TEST_EMAIL}`);
      console.log(`   Cookie set: ${authCookie ? 'Yes' : 'No'}`);
      if (authCookie) {
        console.log(`   Cookie preview: ${authCookie.substring(0, 50)}...`);
      }
      return true;
    } else {
      console.error('❌ Login failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Login error:', error.message);
    return false;
  }
}

// Test 3: Get User Info (verify session)
async function testGetUserInfo() {
  console.log('\n👤 Test 3: Get User Info (Session Verification)');
  console.log('='.repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Session verified');
      console.log(`   Customer ID: ${data.customer.id}`);
      console.log(`   Email: ${data.customer.email}`);
      console.log(`   First Name: ${data.customer.firstName}`);
      console.log(`   Last Name: ${data.customer.lastName}`);
      customerId = data.customer.id;
      return true;
    } else {
      console.error('❌ Session verification failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Session verification error:', error.message);
    return false;
  }
}

// Test 4: Create Checkout Order
async function testCheckout() {
  console.log('\n🛒 Test 4: Create Checkout Order');
  console.log('='.repeat(60));
  
  // First, we need a product SKU - try to get one from the database
  let product = null;
  
  if (process.env.SPR_DATABASE_URL) {
    try {
      const sql = neon(process.env.SPR_DATABASE_URL);
      const products = await sql`
        SELECT id, name, price FROM products LIMIT 1
      `;
      
      if (products && products.length > 0) {
        product = products[0];
      }
    } catch (error) {
      console.warn('   ⚠️  Could not fetch product from database:', error.message);
    }
  }
  
  // Fallback: use a test product SKU (you may need to adjust this)
  if (!product) {
    console.warn('   ⚠️  Using test product SKU. Make sure this product exists in Square.');
    product = {
      id: 'Q6B7CKDGH7UOIEGDAKXV35DO', // Example SKU - adjust as needed
      name: 'Test Product',
      price: 29.99,
    };
  }
  
  console.log(`   Using product: ${product.name} (${product.id})`);
  
  const checkoutPayload = {
    items: [
      {
        sku: product.id,
        quantity: 1,
      },
    ],
    customer_details: {
      email: TEST_EMAIL,
      firstName: TEST_FIRST_NAME,
      lastName: TEST_LAST_NAME,
      phone: '555-1234',
    },
    totals: {
      subtotal: parseFloat(product.price),
      shipping: 0,
      tax: parseFloat(product.price) * 0.0675, // 6.75% tax
      total: parseFloat(product.price) * 1.0675,
    },
  };
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/checkout/create`, {
      method: 'POST',
      body: JSON.stringify(checkoutPayload),
    });
    
    const data = await response.json();
    
    if (response.ok && data.url) {
      console.log('✅ Checkout order created');
      console.log(`   Square Order ID: ${data.square_order_id || 'N/A'}`);
      console.log(`   Checkout URL: ${data.url.substring(0, 80)}...`);
      
      // Extract order number from the checkout URL or response
      // The order number is in the return URL
      const returnUrlMatch = data.url.match(/order-confirmation\?id=([^&]+)/);
      if (returnUrlMatch) {
        orderNumber = returnUrlMatch[1];
        console.log(`   Order Number: ${orderNumber}`);
      }
      
      return true;
    } else {
      console.error('❌ Checkout failed:', JSON.stringify(data, null, 2));
      if (data.message) {
        console.error(`   Error message: ${data.message}`);
      }
      if (data.error) {
        console.error(`   Error type: ${data.error}`);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Checkout error:', error.message);
    return false;
  }
}

// Test 5: Verify Order in Database
async function testVerifyOrder() {
  console.log('\n📦 Test 5: Verify Order in Database');
  console.log('='.repeat(60));
  
  if (!orderNumber) {
    console.error('❌ No order number available from checkout');
    return false;
  }
  
  try {
    const sql = neon(process.env.SPR_DATABASE_URL);
    
    // Look up order by order_number
    const orders = await sql`
      SELECT 
        id,
        order_number,
        customer_id,
        status,
        subtotal,
        tax,
        total,
        shipping_method,
        square_order_id,
        created_at
      FROM orders
      WHERE order_number = ${orderNumber}
    `;
    
    if (orders && orders.length > 0) {
      const order = orders[0];
      console.log('✅ Order found in database');
      console.log(`   Order ID: ${order.id}`);
      console.log(`   Order Number: ${order.order_number}`);
      console.log(`   Customer ID: ${order.customer_id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Total: $${order.total}`);
      console.log(`   Square Order ID: ${order.square_order_id || 'N/A'}`);
      
      // Verify customer_id matches
      if (order.customer_id === customerId) {
        console.log('✅ Customer ID matches authenticated user');
      } else {
        console.warn('⚠️  Customer ID mismatch:', {
          expected: customerId,
          actual: order.customer_id,
        });
      }
      
      orderId = order.id;
      return true;
    } else {
      console.error('❌ Order not found in database');
      return false;
    }
  } catch (error) {
    console.error('❌ Database verification error:', error.message);
    return false;
  }
}

// Test 6: Check Order Items
async function testOrderItems() {
  console.log('\n📋 Test 6: Verify Order Items');
  console.log('='.repeat(60));
  
  if (!orderId && !orderNumber) {
    console.error('❌ No order ID or order number available');
    return false;
  }
  
  try {
    const orderIdentifier = orderId || orderNumber;
    // Use the main order endpoint which includes items in the response
    const response = await makeRequest(`${API_BASE_URL}/api/orders/${orderIdentifier}`, {
      method: 'GET',
    });
    
    const orderData = await response.json();
    
    if (response.ok && orderData.items && Array.isArray(orderData.items)) {
      const items = orderData.items;
      console.log(`✅ Found ${items.length} order item(s)`);
      items.forEach((item, index) => {
        console.log(`   Item ${index + 1}:`);
        console.log(`     Product: ${item.product_name || item.name || item.product_id}`);
        console.log(`     Quantity: ${item.quantity}`);
        console.log(`     Price: $${item.price}`);
        console.log(`     Subtotal: $${item.subtotal || (item.price * item.quantity)}`);
      });
      return true;
    } else {
      console.error('❌ Failed to fetch order items:', orderData);
      return false;
    }
  } catch (error) {
    console.error('❌ Order items error:', error.message);
    return false;
  }
}

// Test 7: Check Order Status
async function testOrderStatus() {
  console.log('\n📊 Test 7: Check Order Status');
  console.log('='.repeat(60));
  
  if (!orderId && !orderNumber) {
    console.error('❌ No order ID or order number available');
    return false;
  }
  
  try {
    const orderIdentifier = orderId || orderNumber;
    const response = await makeRequest(`${API_BASE_URL}/api/orders/${orderIdentifier}/status`, {
      method: 'GET',
    });
    
    const status = await response.json();
    
    if (response.ok && status.status) {
      console.log('✅ Order status retrieved');
      console.log(`   Status: ${status.status}`);
      console.log(`   Order Number: ${status.order_number}`);
      console.log(`   Total: $${status.total || 'N/A'}`);
      return true;
    } else {
      console.error('❌ Failed to fetch order status:', status);
      return false;
    }
  } catch (error) {
    console.error('❌ Order status error:', error.message);
    return false;
  }
}

// Test 8: Logout
async function testLogout() {
  console.log('\n🚪 Test 8: User Logout');
  console.log('='.repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ Logout successful');
      authCookie = null; // Clear cookie
      return true;
    } else {
      console.error('❌ Logout failed:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    return false;
  }
}

// Test 9: Verify Session Cleared
async function testSessionCleared() {
  console.log('\n🔒 Test 9: Verify Session Cleared');
  console.log('='.repeat(60));
  
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
    });
    
    if (response.status === 401) {
      console.log('✅ Session cleared - API correctly returns 401');
      return true;
    } else {
      const data = await response.json();
      console.warn('⚠️  Session may not be cleared:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Session verification error:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('\n🧪 End-to-End Flow Test');
  console.log('='.repeat(60));
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log('='.repeat(60));
  
  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_BASE_URL}/api/auth/me`);
    console.log(`\n✅ Server is running (Status: ${healthCheck.status})`);
  } catch (error) {
    console.error(`\n❌ Server is not running at ${API_BASE_URL}`);
    console.error('   Please start the Vercel dev server: vercel dev --listen 3000');
    process.exit(1);
  }
  
  const results = {
    registration: false,
    login: false,
    getUserInfo: false,
    checkout: false,
    verifyOrder: false,
    orderItems: false,
    orderStatus: false,
    logout: false,
    sessionCleared: false,
  };
  
  // Run tests in sequence
  results.registration = await testRegistration();
  if (!results.registration) {
    console.error('\n❌ Registration failed. Stopping tests.');
    process.exit(1);
  }
  
  results.login = await testLogin();
  if (!results.login) {
    console.error('\n❌ Login failed. Stopping tests.');
    process.exit(1);
  }
  
  results.getUserInfo = await testGetUserInfo();
  if (!results.getUserInfo) {
    console.error('\n❌ Session verification failed. Stopping tests.');
    process.exit(1);
  }
  
  results.checkout = await testCheckout();
  if (!results.checkout) {
    console.warn('\n⚠️  Checkout failed. This may be due to missing Square credentials.');
    console.warn('   Continuing with remaining tests...');
  }
  
  if (results.checkout) {
    results.verifyOrder = await testVerifyOrder();
    results.orderItems = await testOrderItems();
    results.orderStatus = await testOrderStatus();
  }
  
  results.logout = await testLogout();
  results.sessionCleared = await testSessionCleared();
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(60));
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Test runner error:', error);
  process.exit(1);
});

