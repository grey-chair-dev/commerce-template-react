/**
 * Mock Helpers for Tests
 * 
 * Provides utilities for setting up mocks in tests
 */

import { createMockSquareClient } from './mock-square-client.js';

/**
 * Enable or disable HTTP mocking
 * When disabled, allows real HTTP requests (useful for integration tests)
 */
export function enableHTTPMocks() {
  const nock = require('nock');
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');
  nock.enableNetConnect('localhost');
}

export function disableHTTPMocks() {
  const nock = require('nock');
  nock.restore();
  nock.enableNetConnect();
}

/**
 * Create a test environment with mocked Square client
 */
export function createTestEnvironment() {
  return {
    squareClient: createMockSquareClient(),
    locationId: 'LOCATION_TEST',
    accessToken: 'test_token',
  };
}
