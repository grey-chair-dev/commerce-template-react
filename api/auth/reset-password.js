/**
 * Reset Password Endpoint
 * 
 * Handles password reset completion:
 * 1. Validates reset token
 * 2. Checks if token is valid and not expired
 * 3. Validates new password
 * 4. Updates password hash in database
 * 5. Marks token as used
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config(); // Also load .env if it exists

const sql = neon(process.env.SPR_DATABASE_URL);

/**
 * Validate password strength
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  return { valid: true };
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
    const { token, password } = req.body;

    // Validate inputs
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Reset token is required',
      });
    }

    // Find token in database FIRST (before password validation)
    // This allows us to check token validity even when password is missing/invalid
    const tokenResult = await sql`
      SELECT 
        prt.id,
        prt.customer_id,
        prt.email,
        prt.expires_at,
        prt.used,
        c.id as customer_exists
      FROM password_reset_tokens prt
      LEFT JOIN customers c ON c.id = prt.customer_id
      WHERE prt.token = ${token}
      ORDER BY prt.created_at DESC
      LIMIT 1
    `;

    // If password is not provided, return token info for validation (including email)
    if (!password || typeof password !== 'string') {
      if (!tokenResult || tokenResult.length === 0) {
        return res.status(400).json({
          error: 'Invalid token',
          message: 'Invalid or expired reset token. Please request a new password reset.',
        });
      }

      const tokenData = tokenResult[0];

      // Return token status without requiring password
      if (tokenData.used) {
        return res.status(400).json({
          error: 'Token already used',
          message: 'This reset token has already been used. Please request a new password reset.',
          email: tokenData.email, // Include email for resending
        });
      }

      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      if (expiresAt < now) {
        return res.status(400).json({
          error: 'Token expired',
          message: 'This reset token has expired. Please request a new password reset.',
          email: tokenData.email, // Include email for resending
        });
      }

      // Token is valid
      return res.status(200).json({
        success: true,
        valid: true,
        email: tokenData.email,
      });
    }

    if (!tokenResult || tokenResult.length === 0) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    const tokenData = tokenResult[0];

    // Check if token is already used
    if (tokenData.used) {
      return res.status(400).json({
        error: 'Token already used',
        message: 'This reset token has already been used. Please request a new password reset.',
      });
    }

    // Check if token is expired
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    if (expiresAt < now) {
      return res.status(400).json({
        error: 'Token expired',
        message: 'This reset token has expired. Please request a new password reset.',
      });
    }

    // Now validate password (only if token is valid)
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Password is required',
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Invalid password',
        message: passwordValidation.message,
      });
    }

    // Check if customer still exists
    if (!tokenData.customer_exists) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Customer account not found. Please contact support.',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password in database (using transaction would be better, but Neon serverless doesn't support transactions easily)
    try {
      // Update customer password
      await sql`
        UPDATE customers
        SET password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${tokenData.customer_id}
      `;

      // Mark token as used
      await sql`
        UPDATE password_reset_tokens
        SET used = TRUE, used_at = CURRENT_TIMESTAMP
        WHERE id = ${tokenData.id}
      `;

      console.log(`[Reset Password] Password reset successful for customer: ${tokenData.customer_id}`);

      return res.status(200).json({
        success: true,
        message: 'Password has been reset successfully. You can now sign in with your new password.',
      });
    } catch (dbError) {
      console.error('[Reset Password] Database error:', dbError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to update password. Please try again later.',
        ...(process.env.NODE_ENV === 'development' && { details: dbError.message }),
      });
    }
  } catch (error) {
    console.error('[Reset Password] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process password reset. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}


