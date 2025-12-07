/**
 * Test Make.com Webhook Directly
 * 
 * Tests the Make.com webhook connection and payload
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

if (!WEBHOOK_URL) {
  console.error('❌ MAKE_WEBHOOK_URL not configured in .env.local');
  process.exit(1);
}

// Clean webhook URL (strip quotes)
const cleanWebhookUrl = WEBHOOK_URL.trim().replace(/^["']|["']$/g, '');

console.log('🧪 Testing Make.com Webhook');
console.log('='.repeat(50));
console.log(`Webhook URL: ${cleanWebhookUrl}`);
console.log('');

// Test payload
const testPayload = {
  to: 'test@example.com',
  subject: 'Test Email - Spiral Groove Records',
  html: '<!DOCTYPE html><html><body><h1>Test Email</h1><p>This is a test email from the password reset system.</p></body></html>',
  text: 'Test Email\n\nThis is a test email from the password reset system.',
  customerName: 'Test User',
  resetUrl: 'https://spiralgrooverecords.com/reset-password?token=test123',
  emailType: 'password-reset',
};

console.log('📤 Sending test payload to Make.com webhook...');
console.log('Payload:', JSON.stringify(testPayload, null, 2));
console.log('');

try {
  const response = await fetch(cleanWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testPayload),
  });

  console.log(`Response Status: ${response.status} ${response.statusText}`);
  
  let responseData;
  try {
    const text = await response.text();
    if (text) {
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = text;
      }
    }
  } catch (e) {
    responseData = 'No response body';
  }

  console.log('Response Data:', responseData);
  console.log('');

  if (response.ok) {
    console.log('✅ Webhook call successful!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Check Make.com scenario executions');
    console.log('   2. Verify the webhook received the data');
    console.log('   3. Check if the email module processed it correctly');
  } else {
    console.error('❌ Webhook call failed!');
    console.error(`   Status: ${response.status}`);
    console.error(`   Response: ${JSON.stringify(responseData)}`);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Verify the webhook URL is correct');
    console.error('   2. Check if the Make.com scenario is active');
    console.error('   3. Verify the webhook module is configured correctly');
  }
} catch (error) {
  console.error('❌ Error calling webhook:', error.message);
  console.error('');
  console.error('💡 Possible issues:');
  console.error('   1. Network connectivity problem');
  console.error('   2. Webhook URL is incorrect');
  console.error('   3. Make.com service is down');
  console.error('   4. SSL/TLS certificate issue');
  process.exit(1);
}


