/**
 * Forgot Password Endpoint
 * 
 * Handles password reset requests:
 * 1. Validates email address
 * 2. Checks if user exists
 * 3. Generates secure reset token
 * 4. Stores token in database (expires in 1 hour)
 * 5. Sends reset email with link
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'crypto';
import { sendEmail } from '../utils/email.js';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config(); // Also load .env if it exists

const sql = neon(process.env.SPR_DATABASE_URL);

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate secure random token
 */
function generateResetToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Get base URL for reset links
 */
function getBaseUrl() {
  // In production, use VERCEL_URL or NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // For local development
  return 'http://localhost:5173';
}

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);

  if (origin && allowedOrigins.some(allowed => origin.includes(allowed) || allowed.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported',
    });
  }

  try {
    const { email } = req.body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Email address is required',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address',
      });
    }

    // Check if user exists
    const customerResult = await sql`
      SELECT id, email, first_name, last_name
      FROM customers
      WHERE email = ${normalizedEmail}
    `;

    // Return error if email doesn't exist
    if (!customerResult || customerResult.length === 0) {
      console.log(`[Forgot Password] Email not found: ${normalizedEmail}`);
      return res.status(404).json({
        success: false,
        error: 'Email not found',
        message: 'No account found with this email address. Please check your email or sign up for a new account.',
      });
    }

    const customer = customerResult[0];

    // Generate reset token
    const token = generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Store token in database
    await sql`
      INSERT INTO password_reset_tokens (customer_id, email, token, expires_at)
      VALUES (${customer.id}, ${normalizedEmail}, ${token}, ${expiresAt.toISOString()})
    `;

    // Generate reset URL
    const baseUrl = getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send reset email
    try {
      const customerName = customer.first_name || customer.email.split('@')[0];
      
      const emailSubject = 'Reset Your Password - Spiral Groove Records';
      const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Reset Your Password - Spiral Groove Records</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td {font-family: Arial, sans-serif !important;}
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <!-- Wrapper -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
            <tbody>
              <tr>
                <td align="center" style="padding: 40px 20px;">
                  <!-- Main Container -->
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #000000;">
                    
                    <!-- Header with Logo -->
                    <tbody>
                      <tr>
                        <td align="center" style="padding: 0 0 40px 0;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; line-height: 1.2;">
                            SPIRAL GROOVE<br>
                            <span style="color: #00B3A4;">RECORDS</span>
                          </h1>
                        </td>
                      </tr>

                      <!-- Gradient Accent Line -->
                      <tr>
                        <td align="center" style="padding: 0 0 30px 0;">
                          <div style="height: 3px; width: 100px; background: linear-gradient(90deg, #EC4899 0%, #A855F7 50%, #06B6D4 100%); border-radius: 2px; margin: 0 auto;"></div>
                        </td>
                      </tr>

                      <!-- Reset Password Message -->
                      <tr>
                        <td style="padding: 0 0 30px 0;">
                          <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; line-height: 1.4;">
                            Reset Your Password
                          </h2>
                        </td>
                      </tr>

                      <!-- Main Content -->
                      <tr>
                        <td style="padding: 0 0 30px 0;">
                          <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                            Hi ${customerName},
                          </p>
                          <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                            We received a request to reset your password. Click the button below to create a new password:
                          </p>
                        </td>
                      </tr>

                      <!-- Reset Button -->
                      <tr>
                        <td align="center" style="padding: 0 0 30px 0;">
                          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(90deg, #EC4899 0%, #A855F7 50%, #06B6D4 100%); color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                            Reset Password
                          </a>
                        </td>
                      </tr>

                      <!-- Alternative Link -->
                      <tr>
                        <td style="padding: 0 0 30px 0;">
                          <p style="margin: 0 0 10px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px; line-height: 1.6;">
                            Or copy and paste this link into your browser:
                          </p>
                          <p style="margin: 0; color: #00B3A4; font-size: 12px; word-break: break-all; line-height: 1.6;">
                            ${resetUrl}
                          </p>
                        </td>
                      </tr>

                      <!-- Expiration Notice -->
                      <tr>
                        <td style="padding: 0 0 30px 0;">
                          <p style="margin: 0 0 10px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px; line-height: 1.6;">
                            This link will expire in 1 hour.
                          </p>
                          <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 14px; line-height: 1.6;">
                            If you didn't request a password reset, you can safely ignore this email.
                          </p>
                        </td>
                      </tr>

                      <!-- Visit Us Section -->
                      <tr>
                        <td style="padding: 30px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 20px;">
                            <tbody>
                              <tr>
                                <td align="center" style="padding: 0 0 15px 0;">
                                  <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                    Visit Us
                                  </h3>
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding: 0 0 10px 0;">
                                  <p style="margin: 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                                    215B Main St<br>
                                    Milford, OH 45150
                                  </p>
                                </td>
                              </tr>
                              <tr>
                                <td align="center" style="padding: 0 0 10px 0;">
                                  <a href="tel:+15136008018" style="color: #00B3A4; text-decoration: none; font-size: 16px;">
                                    (513) 600-8018
                                  </a>
                                </td>
                              </tr>
                              <tr>
                                <td align="center">
                                  <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 14px; font-style: italic;">
                                    Open 12–9 PM daily
                                  </p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Social Media Links -->
                      <tr>
                        <td align="center" style="padding: 30px 0 20px 0;">
                          <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                            Follow us for updates:
                          </p>
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tbody>
                              <tr>
                                <td style="padding: 0 15px;">
                                  <a href="https://www.facebook.com/spiralgrooverecords/" style="color: #00B3A4; text-decoration: none; font-size: 14px;">Facebook</a>
                                </td>
                                <td style="padding: 0 15px;">
                                  <a href="https://www.instagram.com/spiral_groove_records_/?hl=en" style="color: #00B3A4; text-decoration: none; font-size: 14px;">Instagram</a>
                                </td>
                                <td style="padding: 0 15px;">
                                  <a href="https://www.tiktok.com/@spiral_groove" style="color: #00B3A4; text-decoration: none; font-size: 14px;">TikTok</a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>

                      <!-- Footer -->
                      <tr>
                        <td align="center" style="padding: 30px 0 20px 0; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                          <p style="margin: 0 0 10px 0; color: rgba(255, 255, 255, 0.6); font-size: 14px; line-height: 1.6;">
                            You're receiving this email because you requested a password reset at<br>
                            <a href="https://spiralgrooverecords.com" style="color: #00B3A4; text-decoration: none;">spiralgrooverecords.com</a>
                          </p>
                          <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 12px;">
                            <a href="https://spiralgrooverecords.com/privacy" style="color: rgba(255, 255, 255, 0.5); text-decoration: underline;">Privacy Policy</a>
                          </p>
                        </td>
                      </tr>

                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const emailText = `
SPIRAL GROOVE RECORDS
Reset Your Password

Hi ${customerName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email.

Visit Us:
215B Main St
Milford, OH 45150
(513) 600-8018
Open 12–9 PM daily

Follow us:
Facebook: https://www.facebook.com/spiralgrooverecords/
Instagram: https://www.instagram.com/spiral_groove_records_/?hl=en
TikTok: https://www.tiktok.com/@spiral_groove

You're receiving this email because you requested a password reset at spiralgrooverecords.com
Privacy Policy: https://spiralgrooverecords.com/privacy
      `;

      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
        // Additional data for Make.com webhook
        customerName,
        resetUrl,
        emailType: 'password-reset',
      });

      console.log(`[Forgot Password] Reset email sent to: ${normalizedEmail}`);
      console.log(`[Forgot Password] Email provider: ${emailResult?.provider || 'unknown'}`);
    } catch (emailError) {
      console.error('[Forgot Password] Failed to send email:', emailError);
      console.error('[Forgot Password] Error details:', {
        message: emailError.message,
        stack: emailError.stack,
        webhookUrl: process.env.MAKE_WEBHOOK_URL ? 'configured' : 'not configured',
      });
      // Don't fail the request if email fails - token is still created
      // In production, you might want to queue the email for retry
    }

    return res.status(200).json({
      success: true,
      message: 'We\'ve sent a password reset link to your email address.',
    });
  } catch (error) {
    console.error('[Forgot Password] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process password reset request. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

