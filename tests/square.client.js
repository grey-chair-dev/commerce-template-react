/**
 * Square Client Configuration Utility for Tests
 * 
 * This module initializes a SquareClient instance configured for Sandbox environment.
 * It loads environment variables from .env.test file using dotenv.
 */

import { SquareClient, SquareEnvironment } from 'square';
import dotenv from 'dotenv';
import { join } from 'path';
import { cwd } from 'process';

// Load environment variables from .env.test file at project root
// Using process.cwd() to get the project root directory
// Set debug: false to suppress dotenv log messages
dotenv.config({ path: join(cwd(), '.env.test'), debug: false });

// Validate required environment variables
const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN?.trim();
const squareLocationId = process.env.SQUARE_LOCATION_ID?.trim();

if (!squareAccessToken) {
  throw new Error(
    'SQUARE_ACCESS_TOKEN is required in .env.test file. ' +
    'Please set your Square Sandbox Access Token.'
  );
}

if (!squareLocationId) {
  throw new Error(
    'SQUARE_LOCATION_ID is required in .env.test file. ' +
    'Please set your Square Sandbox Location ID.'
  );
}

// Initialize and export SquareClient configured for Sandbox
export const squareClient = new SquareClient({
  token: squareAccessToken,
  environment: SquareEnvironment.Sandbox,
});

// Export location ID for use in tests
export const locationId = squareLocationId;

// Export access token for reference (if needed)
export const accessToken = squareAccessToken;

