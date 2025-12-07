/**
 * Delete Account Endpoint
 * 
 * DELETE: Securely delete customer account and anonymize order data
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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported. Use DELETE.`,
    });
  }

  // Authenticate request
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId } = authResult;

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Please confirm your password to delete your account',
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
        message: 'This account does not have a password set.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      password,
      customer.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'The password you entered is incorrect',
      });
    }

    // Anonymize order data (keep orders for business records but remove personal info)
    await sql`
      UPDATE orders 
      SET 
        customer_id = NULL,
        pickup_details = jsonb_set(
          COALESCE(pickup_details, '{}'::jsonb),
          '{email}',
          '"deleted@account.removed"'::jsonb
        )
      WHERE customer_id = ${customerId}
    `;

    // Delete customer record
    await sql`
      DELETE FROM customers 
      WHERE id = ${customerId}
    `;

    // Clear cart if exists
    await sql`
      DELETE FROM cart 
      WHERE customer_id = ${customerId}
    `;

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });

  } catch (error) {
    console.error('[Delete Account] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete account',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

