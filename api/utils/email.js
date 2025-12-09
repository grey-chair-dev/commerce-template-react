/**
 * Email Utility
 * 
 * Supports multiple Email Service Providers (ESPs):
 * - Make.com Webhook (priority)
 * - SendGrid
 * - Mailgun
 * - AWS SES
 * - Resend
 * 
 * Automatically detects which ESP is configured via environment variables.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly (dotenv/config doesn't load .env.local by default)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config(); // Also load .env if it exists

/**
 * Detect which ESP is configured
 * Make.com webhook takes priority if configured
 */
function detectESP() {
  // Make.com webhook takes priority
  if (process.env.MAKE_WEBHOOK_URL) {
    return 'make';
  }
  if (process.env.SENDGRID_API_KEY) {
    return 'sendgrid';
  }
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    return 'mailgun';
  }
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return 'ses';
  }
  if (process.env.RESEND_API_KEY) {
    return 'resend';
  }
  return null;
}

/**
 * Send email via Make.com webhook
 */
async function sendViaMake({ to, subject, html, text, ...additionalData }) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('MAKE_WEBHOOK_URL not configured');
  }

  // Strip quotes if present
  const cleanWebhookUrl = webhookUrl.trim().replace(/^["']|["']$/g, '');

  // Prepare payload for Make.com
  // Make.com will receive this data and handle the email sending
  // Always include emailType for routing in Make.com
  const payload = {
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    emailType: emailType || 'generic', // Always include emailType for Make.com routing
    ...additionalData, // Include any additional data (e.g., customerName, resetUrl, orderNumber, etc.)
  };

  console.log(`[Email] Sending to Make.com webhook: ${cleanWebhookUrl.substring(0, 50)}...`);
  console.log(`[Email] Payload keys: ${Object.keys(payload).join(', ')}`);

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
    // Handle specific error codes
    if (response.status === 410) {
      throw new Error(`Make.com webhook URL is invalid or scenario is inactive (410 Gone). Please check your Make.com scenario and ensure it's active. Webhook URL: ${cleanWebhookUrl.substring(0, 50)}...`);
    }
    if (response.status === 404) {
      throw new Error(`Make.com webhook URL not found (404). Please verify the webhook URL is correct.`);
    }
    
    throw new Error(`Make.com webhook error: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
  }

  console.log(`[Email] Make.com webhook response: ${response.status} ${response.statusText}`);
  if (responseData) {
    console.log(`[Email] Response data:`, JSON.stringify(responseData));
  }

  return { success: true, provider: 'make' };
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid({ to, subject, html, text }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@example.com';
  const fromName = process.env.SENDGRID_FROM_NAME || 'Spiral Groove Records';

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }],
      }],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject,
      content: [
        {
          type: 'text/plain',
          value: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
        },
        {
          type: 'text/html',
          value: html,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
  }

  return { success: true, provider: 'sendgrid' };
}

/**
 * Send email via Mailgun
 */
async function sendViaMailgun({ to, subject, html, text }) {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  
  if (!apiKey || !domain) {
    throw new Error('MAILGUN_API_KEY and MAILGUN_DOMAIN must be configured');
  }

  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `noreply@${domain}`;

  const formData = new URLSearchParams();
  formData.append('from', fromEmail);
  formData.append('to', to);
  formData.append('subject', subject);
  formData.append('html', html);
  if (text) {
    formData.append('text', text);
  }

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mailgun API error: ${response.status} - ${errorText}`);
  }

  return { success: true, provider: 'mailgun' };
}

/**
 * Send email via AWS SES
 */
async function sendViaSES({ to, subject, html, text }) {
  // AWS SES requires AWS SDK
  // For now, we'll use a simple fetch approach if AWS_REGION is set
  // In production, you might want to use @aws-sdk/client-ses
  
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || process.env.AWS_SES_REGION || 'us-east-1';
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be configured');
  }

  // Note: AWS SES API requires AWS Signature Version 4 signing
  // This is a simplified version - for production, use AWS SDK
  const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com';
  
  // For now, throw an error suggesting to use AWS SDK
  throw new Error('AWS SES requires @aws-sdk/client-ses. Please install: npm install @aws-sdk/client-ses');
}

/**
 * Send email via Resend
 */
async function sendViaResend({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
  const fromName = process.env.RESEND_FROM_NAME || 'Spiral Groove Records';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    }),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      const errorText = await response.text();
      errorData = { message: errorText };
    }
    throw new Error(`Resend API error: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  return { success: true, provider: 'resend' };
}

/**
 * Send an email using the configured ESP
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text email content (optional)
 * @param {string} [options.emailType] - Type of email (welcome, order-confirmation, order-status-update, password-reset) (optional)
 * @param {Object} [options.additionalData] - Additional data to pass to the email service (optional)
 * @returns {Promise<{success: boolean, provider: string}>}
 */
export async function sendEmail({ to, subject, html, text, emailType, ...additionalData }) {
  const esp = detectESP();
  
  if (!esp) {
    throw new Error('No email service provider configured. Please set one of: MAKE_WEBHOOK_URL, SENDGRID_API_KEY, MAILGUN_API_KEY, AWS_ACCESS_KEY_ID, or RESEND_API_KEY');
  }

  try {
    switch (esp) {
      case 'make':
        return await sendViaMake({ to, subject, html, text, ...additionalData });
      case 'sendgrid':
        return await sendViaSendGrid({ to, subject, html, text });
      case 'mailgun':
        return await sendViaMailgun({ to, subject, html, text });
      case 'ses':
        return await sendViaSES({ to, subject, html, text });
      case 'resend':
        return await sendViaResend({ to, subject, html, text });
      default:
        throw new Error(`Unsupported ESP: ${esp}`);
    }
  } catch (error) {
    console.error(`[Email] Failed to send email via ${esp}:`, error);
    throw error;
  }
}

