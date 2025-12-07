/**
 * Password Update Endpoint
 * 
 * PUT: Update user password (changes password_hash in Neon DB)
 */

import { authenticateRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config();

function validatePassword(password) {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default async function handler(req, res) {
  // Set CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow PUT
  if (req.method !== 'PUT') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported. Use PUT.`,
    });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId } = authResult;

  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both currentPassword and newPassword are required',
      });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SPR_DATABASE_URL);

    // Get current password hash
    const customerResult = await sql`
      SELECT password_hash FROM customers WHERE id = ${customerId}
    `;

    if (!customerResult || customerResult.length === 0) {
      return res.status(404).json({
        error: 'User not found',
        message: 'Customer record not found',
      });
    }

    const customer = customerResult[0];

    if (!customer.password_hash) {
      return res.status(400).json({
        error: 'No password set',
        message: 'This account does not have a password set. Please use password reset.',
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      customer.password_hash
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Invalid current password',
        message: 'The current password you entered is incorrect',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password_hash in database
    await sql`
      UPDATE customers 
      SET password_hash = ${newPasswordHash}, updated_at = NOW()
      WHERE id = ${customerId}
    `;

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });

  } catch (error) {
    console.error('[Password Update] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update password',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

