/**
 * User Profile Endpoint
 * 
 * GET: Get current user profile
 * PUT: Update user profile (name, email, phone)
 */

import { authenticateRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local explicitly
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config();

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Authenticate request
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId } = authResult;

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SPR_DATABASE_URL);

    // GET: Return current profile
    if (req.method === 'GET') {
      const customerResult = await sql`
        SELECT id, email, first_name, last_name, phone, created_at, updated_at
        FROM customers
        WHERE id = ${customerId}
      `;

      if (!customerResult || customerResult.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Customer record not found',
        });
      }

      const customer = customerResult[0];

      return res.status(200).json({
        success: true,
        customer: {
          id: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone,
          createdAt: customer.created_at,
          updatedAt: customer.updated_at,
        },
      });
    }

    // PUT: Update profile
    if (req.method === 'PUT') {
      const { firstName, lastName, email, phone } = req.body;

      // Validate email if provided
      if (email && !validateEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
          message: 'Please provide a valid email address',
        });
      }

      // Check if email is already taken by another user
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const existingCustomer = await sql`
          SELECT id FROM customers 
          WHERE email = ${normalizedEmail} AND id != ${customerId}
        `;

        if (existingCustomer && existingCustomer.length > 0) {
          return res.status(409).json({
            error: 'Email already in use',
            message: 'This email is already associated with another account',
          });
        }
      }

      // Fetch current values first for partial updates
      const currentResult = await sql`
        SELECT first_name, last_name, email, phone
        FROM customers
        WHERE id = ${customerId}
      `;

      if (!currentResult || currentResult.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Customer record not found',
        });
      }

      const current = currentResult[0];
      const finalFirstName = firstName !== undefined ? (firstName || null) : current.first_name;
      const finalLastName = lastName !== undefined ? (lastName || null) : current.last_name;
      const finalEmail = email !== undefined ? (email ? email.toLowerCase().trim() : null) : current.email;
      const finalPhone = phone !== undefined ? (phone || null) : current.phone;

      // Update with all fields (using current values for fields not provided)
      const updateResult = await sql`
        UPDATE customers 
        SET 
          first_name = ${finalFirstName},
          last_name = ${finalLastName},
          email = ${finalEmail},
          phone = ${finalPhone},
          updated_at = NOW()
        WHERE id = ${customerId}
        RETURNING id, email, first_name, last_name, phone, created_at, updated_at
      `;

      if (!updateResult || updateResult.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Customer record not found',
        });
      }

      const updatedCustomer = updateResult[0];

      return res.status(200).json({
        success: true,
        customer: {
          id: updatedCustomer.id,
          email: updatedCustomer.email,
          firstName: updatedCustomer.first_name,
          lastName: updatedCustomer.last_name,
          phone: updatedCustomer.phone,
          createdAt: updatedCustomer.created_at,
          updatedAt: updatedCustomer.updated_at,
        },
      });
    }

    // Method not allowed
    return res.status(405).json({
      error: 'Method not allowed',
      message: `Method ${req.method} not supported`,
    });

  } catch (error) {
    console.error('[Profile] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process profile request',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

