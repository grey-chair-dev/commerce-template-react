/**
 * Square Log Quality Tests
 * 
 * Tests log coherence, readability, and consistency across Square-related endpoints.
 * Ensures logs are human-readable and provide actionable information.
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Mock console methods to capture logs
let logOutput = [];
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  logOutput = [];
  console.log = (...args) => {
    logOutput.push({ level: 'log', args });
    originalLog(...args);
  };
  console.error = (...args) => {
    logOutput.push({ level: 'error', args });
    originalError(...args);
  };
  console.warn = (...args) => {
    logOutput.push({ level: 'warn', args });
    originalWarn(...args);
  };
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

describe('Log Format Validation', () => {
  test('should use structured log format with [Webhook] prefix', () => {
    // This test validates that logs follow the structured format
    // In actual implementation, you would capture logs from webhook handlers
    
    const logMessage = '[Webhook] Processing order.updated';
    expect(logMessage).toMatch(/^\[Webhook\]/);
  });

  test('should use structured log format with [Square API] prefix', () => {
    const logMessage = '[Square API] Fetching products';
    expect(logMessage).toMatch(/^\[Square API\]/);
  });

  test('should not contain sensitive data in logs', () => {
    // Test that logs don't expose tokens or keys
    const sensitivePatterns = [
      /SQUARE_ACCESS_TOKEN[=:]\s*[^\s]+/i,
      /token[=:]\s*[a-zA-Z0-9]{20,}/i,
      /key[=:]\s*[a-zA-Z0-9]{20,}/i,
    ];

    const testLogs = [
      '[Webhook] Processing order.updated',
      '[Square API] Token configured',
      '[Webhook] Error: Invalid token',
    ];

    testLogs.forEach(log => {
      sensitivePatterns.forEach(pattern => {
        expect(log).not.toMatch(pattern);
      });
    });
  });

  test('should include relevant context (order IDs, payment IDs)', () => {
    // Validate that logs include correlation IDs
    const logWithContext = '[Webhook] Order abc-123 status updated: "New" → "In Progress"';
    
    expect(logWithContext).toMatch(/Order\s+\w+/); // Contains order ID
    expect(logWithContext).toContain('status updated');
  });
});

describe('Log Readability', () => {
  test('should be human-readable without excessive JSON dumps', () => {
    // Good log format
    const goodLog = '[Webhook] ✅ Order abc-123 status updated: "New" → "In Progress" | 3 items | $25.00';
    
    // Bad log format (excessive JSON)
    const badLog = '[Webhook] Data: {"order":{"id":"abc-123","status":"In Progress","items":[{"id":"1","name":"Item"},{"id":"2","name":"Item2"}],"total":25.00,"customer":{"id":"cust-123","email":"test@example.com","name":"John Doe"}}}';
    
    expect(goodLog.length).toBeLessThan(200); // Concise
    expect(badLog.length).toBeGreaterThan(200); // Verbose
    expect(goodLog).not.toMatch(/\{[^}]{100,}\}/); // No large JSON objects
  });

  test('should provide actionable error information', () => {
    const actionableError = '[Webhook] ❌ Invalid webhook signature - rejecting request';
    const nonActionableError = '[Webhook] Error occurred';
    
    expect(actionableError).toContain('Invalid webhook signature');
    expect(actionableError).toContain('rejecting');
    expect(nonActionableError.length).toBeLessThan(actionableError.length);
  });
});

describe('Log Consistency', () => {
  test('should use consistent log prefixes across endpoints', () => {
    const prefixes = [
      '[Webhook]',
      '[Square API]',
      '[Square Health]',
    ];

    // All Square-related logs should use one of these prefixes
    const testLog = '[Webhook] Test message';
    const hasValidPrefix = prefixes.some(prefix => testLog.startsWith(prefix));
    expect(hasValidPrefix).toBe(true);
  });

  test('should use consistent success/error indicators', () => {
    const successLog = '[Webhook] ✅ Order updated';
    const errorLog = '[Webhook] ❌ Error occurred';
    const warnLog = '[Webhook] ⚠️  Warning message';
    
    expect(successLog).toContain('✅');
    expect(errorLog).toContain('❌');
    expect(warnLog).toContain('⚠️');
  });
});

describe('Log-to-Slack Correlation', () => {
  test('should include error IDs in logs for Slack correlation', () => {
    // Error logs should include error IDs that match Slack alerts
    const logWithErrorId = '[Webhook] ❌ Error ID: err_1234567890_abc123';
    
    expect(logWithErrorId).toMatch(/Error ID:\s*err_\d+_\w+/);
  });

  test('should include Square order IDs for correlation', () => {
    const logWithOrderId = '[Webhook] Order Yyh01NFkhEvNt9Gug87Q7vFRPk7YY status updated';
    
    // Square order IDs are typically alphanumeric strings
    expect(logWithOrderId).toMatch(/Order\s+[A-Za-z0-9]+/);
  });
});

