/**
 * Email Test Helper
 * 
 * Helper to test email functionality without importing modules that use import.meta
 * This creates a mock email sender that can be used in tests
 */

/**
 * Mock sendEmail function for testing
 * This bypasses the import.meta issue by directly calling the Make.com webhook
 */
export async function testSendEmail({ to, subject, html, text, emailType, ...additionalData }) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('MAKE_WEBHOOK_URL not configured');
  }

  // Strip quotes if present
  const cleanWebhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');

  // Prepare payload for Make.com (same structure as email.js)
  const payload = {
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
    emailType: emailType || 'generic',
    ...additionalData,
  };

  console.log(`[Email Test] Sending to Make.com webhook: ${cleanWebhookUrl.substring(0, 50)}...`);
  console.log(`[Email Test] Payload keys: ${Object.keys(payload).join(', ')}`);

  const response = await fetch(cleanWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseData = responseText || null;
  }

  if (!response.ok) {
    if (response.status === 410) {
      throw new Error(`Make.com webhook URL is invalid or scenario is inactive (410 Gone). Webhook URL: ${cleanWebhookUrl.substring(0, 50)}...`);
    }
    if (response.status === 404) {
      throw new Error(`Make.com webhook URL not found (404). Please verify the webhook URL is correct.`);
    }
    
    throw new Error(`Make.com webhook error: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
  }

  console.log(`[Email Test] Make.com webhook response: ${response.status} ${response.statusText}`);
  if (responseData) {
    console.log(`[Email Test] Response data:`, JSON.stringify(responseData));
  }

  return { success: true, provider: 'make' };
}
