/**
 * User Registration Endpoint
 * 
 * Handles new user registration with email/password authentication
 * Steps:
 * A. Receive email and password via POST
 * B. Validate email uniqueness and password requirements
 * C. Hash password with bcrypt
 * D. Insert into customers table with UUID
 * E. Return success (optionally with JWT token for immediate login)
 */

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const sql = neon(process.env.SPR_DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET;

// Cookie configuration
const COOKIE_NAME = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const JWT_EXPIRATION = '7d'; // 7 days

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

// Password requirements
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false, // Optional for now
};

/**
 * Validate password meets security requirements
 */
function validatePassword(password) {
  const errors = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
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
    // Step A: Receive and validate input
    // Support both camelCase and snake_case field names
    const { 
      email, 
      password, 
      firstName, 
      lastName,
      first_name,
      last_name
    } = req.body;
    
    // Use camelCase or snake_case, preferring camelCase
    const finalFirstName = firstName || first_name || null;
    const finalLastName = lastName || last_name || null;

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

    // Validate password requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password does not meet requirements',
        details: passwordValidation.errors,
      });
    }

    // Check if email already exists (Step A: Validate uniqueness)
    const existingCustomer = await sql`
      SELECT id, email FROM customers WHERE email = ${email.toLowerCase().trim()}
    `;

    if (existingCustomer && existingCustomer.length > 0) {
      return res.status(409).json({
        error: 'Email already registered',
        details: 'An account with this email already exists. Please sign in instead.',
      });
    }

    // Step B: Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Step C: Generate UUID and insert into customers table
    const customerId = randomUUID();
    const normalizedEmail = email.toLowerCase().trim();

    // Step C: Insert into customers table with UUID and hashed password
    await sql`
      INSERT INTO customers (
        id,
        email,
        first_name,
        last_name,
        password_hash,
        created_at,
        updated_at
      ) VALUES (
        ${customerId},
        ${normalizedEmail},
        ${finalFirstName},
        ${finalLastName},
        ${passwordHash},
        NOW(),
        NOW()
      )
    `;

    // Step D: Generate JWT token for immediate login (optional)
    let token = null;
    if (JWT_SECRET) {
      try {
        token = jwt.sign(
          {
            customerId,
            email: normalizedEmail,
            type: 'customer',
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRATION }
        );

        // Set HTTP-only cookie for automatic login
        setAuthCookie(res, token);
      } catch (tokenError) {
        console.error('[Register] Failed to generate JWT token:', tokenError);
        // Continue without token - user can sign in separately
      }
    }

    // Step E: Return success response
    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      customer: {
        id: customerId,
        email: normalizedEmail,
        firstName: finalFirstName,
        lastName: finalLastName,
      },
      // Note: Token is stored in HTTP-only cookie, not returned in JSON for security
    });
  } catch (error) {
    console.error('[Register] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create account. Please try again later.',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
}

