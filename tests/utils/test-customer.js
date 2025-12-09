/**
 * Test Customer Utility
 * 
 * Manages test customer creation and retrieval for Square API tests.
 * Creates a reusable test customer in Square Sandbox for consistent testing.
 * 
 * Square Customers API:
 * - https://developer.squareup.com/reference/square/customers-api/create-customer
 * - https://developer.squareup.com/reference/square/customers-api/search-customers
 */

import { squareClient } from '../square.client.js';
import { USE_MOCKS } from './test-config.js';
import { createMockSquareClient } from './mock-square-client.js';

// Use mock client if mocking is enabled (lazy initialization)
function getTestSquareClient() {
  if (USE_MOCKS) {
    if (!global.__mockSquareClient) {
      global.__mockSquareClient = createMockSquareClient();
    }
    return global.__mockSquareClient;
  }
  return squareClient;
}

/**
 * Test customer data - consistent across all tests
 */
export const TEST_CUSTOMER_DATA = {
  givenName: 'Test',
  familyName: 'Customer',
  emailAddress: 'test.customer@example.com',
  phoneNumber: '+15551234567',
  address: {
    addressLine1: '123 Test Street',
    locality: 'San Francisco',
    administrativeDistrictLevel1: 'CA',
    postalCode: '94102',
    country: 'US',
  },
  note: 'Test customer for automated Square API tests',
};

/**
 * Cache for test customer ID to avoid repeated API calls
 */
let cachedCustomerId = null;

/**
 * Create or retrieve test customer in Square Sandbox
 * 
 * @returns {Promise<string>} Square customer ID
 */
export async function getOrCreateTestCustomer() {
  // Return cached customer ID if available
  if (cachedCustomerId) {
    return cachedCustomerId;
  }

  try {
    // Square SDK v43 uses customersApi (not customers)
    const customersApi = getTestSquareClient().customersApi;

    // First, try to find existing test customer by email
    const searchResponse = await customersApi.searchCustomers({
      query: {
        filter: {
          emailAddress: {
            exact: TEST_CUSTOMER_DATA.emailAddress,
          },
        },
      },
    });

    // Handle different response structures from Square SDK v43
    const customers = searchResponse.result?.customers || 
                     searchResponse.customers || 
                     [];

    // If customer exists, use it
    if (customers.length > 0) {
      const existingCustomer = customers[0];
      cachedCustomerId = existingCustomer.id;
      console.log('✅ Found existing test customer:', cachedCustomerId);
      return cachedCustomerId;
    }

    // Customer doesn't exist, create a new one
    console.log('Creating new test customer in Square Sandbox...');
    const createResponse = await customersApi.createCustomer({
      idempotencyKey: `test-customer-${Date.now()}`,
      givenName: TEST_CUSTOMER_DATA.givenName,
      familyName: TEST_CUSTOMER_DATA.familyName,
      emailAddress: TEST_CUSTOMER_DATA.emailAddress,
      phoneNumber: TEST_CUSTOMER_DATA.phoneNumber,
      address: TEST_CUSTOMER_DATA.address,
      note: TEST_CUSTOMER_DATA.note,
    });

    // Handle different response structures
    const customer = createResponse.result?.customer || 
                    createResponse.customer;

    if (!customer || !customer.id) {
      throw new Error('Failed to create test customer - no customer ID returned');
    }

    cachedCustomerId = customer.id;
    console.log('✅ Created test customer:', cachedCustomerId);
    return cachedCustomerId;
  } catch (error) {
    console.error('❌ Error getting/creating test customer:', error);
    throw error;
  }
}

/**
 * Get test customer ID (cached or create new)
 * 
 * @returns {Promise<string>} Square customer ID
 */
export async function getTestCustomerId() {
  return getOrCreateTestCustomer();
}

/**
 * Clear cached customer ID (useful for tests that need fresh customer)
 */
export function clearTestCustomerCache() {
  cachedCustomerId = null;
}

/**
 * Get full test customer object with all details
 * 
 * @returns {Promise<Object>} Customer object with Square customer data
 */
export async function getTestCustomer() {
  const customerId = await getTestCustomerId();
  
  try {
    // Square SDK v43 uses customersApi (not customers)
    const customersApi = getTestSquareClient().customersApi;
    const response = await customersApi.retrieveCustomer(customerId);

    const customer = response.result?.customer || response.customer;
    return customer;
  } catch (error) {
    console.error('❌ Error retrieving test customer:', error);
    throw error;
  }
}

