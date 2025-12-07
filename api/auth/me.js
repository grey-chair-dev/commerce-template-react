/**
 * Get Current User Endpoint
 * 
 * Example endpoint demonstrating authentication middleware usage
 * Returns the current authenticated user's information
 */

import { authenticateRequest } from '../middleware/auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step A, B, C: Authenticate request using middleware
  const authResult = await authenticateRequest(req, res);
  
  if (!authResult.success) {
    return; // Response already sent by middleware
  }

  const { customerId, email } = authResult;

  // Fetch full customer details from database
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.SPR_DATABASE_URL);

    const customerResult = await sql`
      SELECT id, email, first_name, last_name, phone, created_at
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
      },
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch user information',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

