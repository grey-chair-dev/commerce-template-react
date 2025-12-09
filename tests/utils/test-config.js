/**
 * Test Configuration
 * 
 * Controls whether tests use real APIs or mocks.
 * Set USE_MOCKS=true in environment to enable mocking.
 */

export const USE_MOCKS = process.env.USE_MOCKS === 'true' || process.env.USE_MOCKS === '1';

/**
 * Check if mocking is enabled for a specific service
 */
export function shouldMock(service) {
  if (!USE_MOCKS) return false;
  
  // Allow per-service override
  const serviceEnvVar = `MOCK_${service.toUpperCase()}`;
  return process.env[serviceEnvVar] !== 'false';
}
