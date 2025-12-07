/**
 * Authentication Middleware for Vercel Serverless Functions
 * 
 * This middleware:
 * A. Reads JWT token from HTTP-only cookie
 * B. Validates token using jsonwebtoken.verify() with JWT_SECRET
 * C. Extracts customer_id from token payload and attaches to request
 * 
 * Usage:
 *   import { authenticateRequest } from '../middleware/auth.js';
 *   
 *   export default async function handler(req, res) {
 *     const authResult = await authenticateRequest(req, res);
 *     if (!authResult.success) {
 *       return; // Response already sent
 *     }
 *     const { customerId, email } = authResult;
 *     // Use customerId in your endpoint logic
 *   }
 */

import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'auth_token';

/**
 * Extract JWT token from HTTP-only cookie
 */
function extractTokenFromCookie(req) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  try {
    const cookies = parse(cookieHeader);
    return cookies[COOKIE_NAME] || null;
  } catch (error) {
    console.error('[Auth Middleware] Error parsing cookies:', error);
    return null;
  }
}

/**
 * Authenticate request by validating JWT token from cookie (optional mode)
 * Does not send response on failure - just returns error
 * 
 * @param {Object} req - Vercel request object
 * @param {Object} res - Vercel response object (optional, only used if required=true)
 * @param {boolean} required - If true, sends 401 response on failure. If false, just returns error.
 * @returns {Object} - { success: boolean, customerId?: string, email?: string, error?: string }
 */
export async function authenticateRequest(req, res, required = true) {
  // Step A: Extract token from cookie
  const token = extractTokenFromCookie(req);

  if (!token) {
    if (required && res) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required. Please sign in.',
        details: 'No authentication token found in request',
      });
    }
    return { success: false, error: 'No token' };
  }

  // Check if JWT_SECRET is configured
  if (!JWT_SECRET) {
    console.error('[Auth Middleware] JWT_SECRET is not configured');
    if (required && res) {
      res.status(500).json({
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured',
      });
    }
    return { success: false, error: 'JWT_SECRET not configured' };
  }

  // Step B: Validate token using jsonwebtoken.verify()
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify token structure
    if (!decoded.customerId || decoded.type !== 'customer') {
      if (required && res) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid authentication token',
          details: 'Token payload is invalid',
        });
      }
      return { success: false, error: 'Invalid token payload' };
    }

    // Step C: Extract customer_id and attach to request
    // The decoded token contains: { customerId, email, type, iat, exp }
    return {
      success: true,
      customerId: decoded.customerId,
      email: decoded.email,
      tokenData: decoded,
    };
  } catch (error) {
    // Step B: Return 401 if token is invalid or expired (only if required)
    if (error.name === 'TokenExpiredError') {
      if (required && res) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Your session has expired. Please sign in again.',
          details: 'Token expired',
        });
      }
      return { success: false, error: 'Token expired' };
    }

    if (error.name === 'JsonWebTokenError') {
      if (required && res) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid authentication token',
          details: 'Token verification failed',
        });
      }
      return { success: false, error: 'Invalid token' };
    }

    // Other errors (e.g., JWT_SECRET issues)
    console.error('[Auth Middleware] Token verification error:', error);
    if (required && res) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed',
        details: 'Token verification error',
      });
    }
    return { success: false, error: error.message };
  }
}

/**
 * Optional: Middleware wrapper for cleaner endpoint code
 * 
 * Usage:
 *   export default authenticateMiddleware(async (req, res, { customerId, email }) => {
 *     // Your endpoint logic here
 *     // customerId and email are available
 *   });
 */
export function authenticateMiddleware(handler) {
  return async (req, res) => {
    const authResult = await authenticateRequest(req, res);
    
    if (!authResult.success) {
      return; // Response already sent by authenticateRequest
    }

    // Call the handler with authenticated user data
    return handler(req, res, authResult);
  };
}

