/**
 * User Login Endpoint
 * 
 * Handles user authentication with email/password
 * Steps:
 * A. Receive email and password via POST
 * B. Verify user exists in Neon DB and retrieve password_hash
 * C. Verify password with bcrypt.compare()
 * D. Generate JWT token with customer_id
 * E. Set session via HTTP-only cookie
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const sql = neon(process.env.SPR_DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET;

// Cookie configuration
const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const JWT_EXPIRATION = '7d'; // 7 days

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Set HTTP-only cookie with JWT token
 */
function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
    'HttpOnly', // Prevents JavaScript access (XSS protection)
  ];

  // SameSite settings: Lax for development (allows cross-port cookies), Strict for production
  if (isProduction) {
    cookieOptions.push('SameSite=Strict'); // CSRF protection in production
    cookieOptions.push('Secure'); // HTTPS only in production
  } else {
    // For local development, use Lax and don't set domain (allows localhost on any port)
    cookieOptions.push('SameSite=Lax'); // More permissive for local development
    // Don't set Domain in development - allows cookie to work across localhost ports
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true'); // Required for cookies

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step A: Receive email and password
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'Email and password are required',
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
      });
    }

    // Step B: Verify user exists and retrieve password_hash
    const normalizedEmail = email.toLowerCase().trim();
    const customerResult = await sql`
      SELECT id, email, first_name, last_name, password_hash, role
      FROM customers
      WHERE email = ${normalizedEmail}
    `;

    if (!customerResult || customerResult.length === 0) {
      // Log failed login attempt
      try {
        await sql`
          INSERT INTO auth_logs (email, status, error_code, ip_address, user_agent, created_at)
          VALUES (${normalizedEmail}, 'failure', 'user_not_found', ${req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'}, NOW())
        `;
      } catch (logError) {
        // Don't fail the request if logging fails
        console.warn('[Login] Failed to log auth attempt:', logError.message);
      }
      
      // Generic error message to prevent user enumeration
      return res.status(401).json({
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
      });
    }

    const customer = customerResult[0];

    // Check if password_hash exists (account might be OAuth-only)
    if (!customer.password_hash) {
      // Log failed login attempt
      try {
        await sql`
          INSERT INTO auth_logs (email, status, error_code, ip_address, user_agent, created_at)
          VALUES (${normalizedEmail}, 'failure', 'no_password_hash', ${req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'}, NOW())
        `;
      } catch (logError) {
        // Don't fail the request if logging fails
        console.warn('[Login] Failed to log auth attempt:', logError.message);
      }
      
      return res.status(401).json({
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
      });
    }

    // Step C: Verify password with bcrypt
    if (process.env.NODE_ENV === 'development') {
      console.log('[Login] Attempting password verification for:', normalizedEmail);
      console.log('[Login] Password hash exists:', !!customer.password_hash);
      console.log('[Login] Password hash length:', customer.password_hash ? customer.password_hash.length : 0);
    }
    
    const isPasswordValid = await bcrypt.compare(password, customer.password_hash);

    if (!isPasswordValid) {
      // Log for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('[Login] Password verification FAILED for:', normalizedEmail);
        console.log('[Login] Password provided length:', password.length);
      }
      
      // Log failed login attempt
      try {
        await sql`
          INSERT INTO auth_logs (email, status, error_code, ip_address, user_agent, created_at)
          VALUES (${normalizedEmail}, 'failure', 'invalid_credentials', ${req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'}, NOW())
        `;
      } catch (logError) {
        // Don't fail the request if logging fails
        console.warn('[Login] Failed to log auth attempt:', logError.message);
      }
      
      // Step C: Return generic 401 error on password failure
      return res.status(401).json({
        error: 'Invalid credentials',
        details: 'Email or password is incorrect',
      });
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Login] Password verification SUCCESS for:', normalizedEmail);
    }

    // Step D: Generate JWT token
    if (!JWT_SECRET) {
      console.error('[Login] JWT_SECRET is not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'Authentication service is not properly configured',
      });
    }

    // Get role from customer record, default to 'user' if not set
    const role = customer.role || 'user';

    const token = jwt.sign(
      {
        customerId: customer.id,
        email: customer.email,
        type: 'customer',
        role: role, // Include role in JWT payload for RBAC
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    // Log successful login attempt
    try {
      await sql`
        INSERT INTO auth_logs (email, status, error_code, ip_address, user_agent, created_at)
        VALUES (${normalizedEmail}, 'success', NULL, ${req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'}, NOW())
      `;
    } catch (logError) {
      // Don't fail the request if logging fails
      console.warn('[Login] Failed to log auth attempt:', logError.message);
    }
    
    // Step E: Set session via HTTP-only cookie
    setAuthCookie(res, token);

    // Return success response (token is in cookie, not in response body for security)
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        role: role,
      },
      // Note: Token is stored in HTTP-only cookie, not returned in JSON
      // This prevents XSS attacks from stealing the token
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    
    // Log failed login attempt (if we have email)
    if (req.body?.email) {
      try {
        const normalizedEmail = req.body.email.toLowerCase().trim();
        await sql`
          INSERT INTO auth_logs (email, status, error_code, ip_address, user_agent, created_at)
          VALUES (${normalizedEmail}, 'failure', 'server_error', ${req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'}, ${req.headers['user-agent'] || 'unknown'}, NOW())
        `;
      } catch (logError) {
        // Don't fail the request if logging fails
        console.warn('[Login] Failed to log auth attempt:', logError.message);
      }
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process login request. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

