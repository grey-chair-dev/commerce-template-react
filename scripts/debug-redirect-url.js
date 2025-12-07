/**
 * Debug script to check what redirect URL is being generated
 * and test if Square is modifying it
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Simulate the baseUrl logic
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
  
  if (isLocalhost) {
    return 'http://localhost:5173';
  }
  
  return `https://${host}`;
})();

const testOrderId = 'test-order-uuid-12345';
const returnUrlSuccess = `${baseUrl}/order-confirmation?id=${testOrderId}`;

console.log('\n🔍 Redirect URL Debug');
console.log('='.repeat(60));
console.log(`Base URL: ${baseUrl}`);
console.log(`Protocol: ${baseUrl.startsWith('http://') ? 'HTTP ✅' : 'HTTPS ⚠️'}`);
console.log(`Is Localhost: ${baseUrl.includes('localhost')}`);
console.log(`Return URL: ${returnUrlSuccess}`);
console.log(`Return URL Protocol: ${returnUrlSuccess.startsWith('http://') ? 'HTTP ✅' : 'HTTPS ⚠️'}`);
console.log('='.repeat(60));

// Check if browser might force HTTPS
console.log('\n⚠️  Browser HSTS Check:');
console.log('If your browser has HSTS enabled for localhost, it may force HTTPS.');
console.log('To fix:');
console.log('1. Chrome: Go to chrome://net-internals/#hsts');
console.log('2. Delete "localhost" from HSTS list');
console.log('3. Clear browser cache');
console.log('4. Try accessing http://localhost:3000 directly');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log(`VERCEL_URL: ${process.env.VERCEL_URL || 'not set'}`);
console.log(`NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || 'not set'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

