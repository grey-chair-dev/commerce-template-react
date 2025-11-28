/**
 * Client Portal Authentication
 * 
 * Development-only authentication system for Spiral Groove client access.
 * Uses bcrypt for password hashing and JWT for session management.
 */

import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const CLIENT_PASSWORD = import.meta.env.VITE_CLIENT_PASSWORD || ''
const CLIENT_PASSWORD_HASH = import.meta.env.VITE_CLIENT_PASSWORD_HASH || ''
const AUTH_SECRET = import.meta.env.VITE_AUTH_SECRET || 'dev-secret-change-in-production'

const CLIENT_TOKEN_KEY = 'spiralgroove_client_token'
const CLIENT_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

export type ClientAuthResult = {
  success: boolean
  token?: string
  error?: string
}

/**
 * Verify client password and create session token
 */
export async function authenticateClient(password: string): Promise<ClientAuthResult> {
  if (!CLIENT_PASSWORD && !CLIENT_PASSWORD_HASH) {
    return {
      success: false,
      error: 'Client authentication not configured',
    }
  }

  try {
    let isValid = false

    // Try hash first if available
    if (CLIENT_PASSWORD_HASH) {
      try {
        // Use precomputed hash
        isValid = await bcrypt.compare(password, CLIENT_PASSWORD_HASH)
      } catch (hashError) {
        // Hash comparison failed, fall back to plain text if available
        console.warn('[ClientAuth] Hash comparison failed, falling back to plain text')
        if (CLIENT_PASSWORD) {
          isValid = password === CLIENT_PASSWORD
        }
      }
    }
    
    // Fall back to plain text if hash wasn't used or failed
    if (!isValid && CLIENT_PASSWORD && !CLIENT_PASSWORD_HASH) {
      isValid = password === CLIENT_PASSWORD
    }

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid password',
      }
    }

    // Create JWT token using jose (browser-compatible)
    const secret = new TextEncoder().encode(AUTH_SECRET)
    const token = await new SignJWT({
      client: 'spiralgroove',
      authenticated: true,
      timestamp: Date.now(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)

    // Store token in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(CLIENT_TOKEN_KEY, token)
    }

    return {
      success: true,
      token,
    }
  } catch (error) {
    console.error('[ClientAuth] Authentication error:', error)
    return {
      success: false,
      error: 'Authentication failed',
    }
  }
}

/**
 * Verify client session token
 */
export async function verifyClientSession(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }

  const token = localStorage.getItem(CLIENT_TOKEN_KEY)
  if (!token) {
    return false
  }

  try {
    const secret = new TextEncoder().encode(AUTH_SECRET)
    const { payload } = await jwtVerify(token, secret)
    return payload?.authenticated === true && payload?.client === 'spiralgroove'
  } catch (error) {
    // Token expired or invalid
    localStorage.removeItem(CLIENT_TOKEN_KEY)
    return false
  }
}

/**
 * Clear client session
 */
export function clearClientSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CLIENT_TOKEN_KEY)
  }
}

/**
 * Check if client authentication is required
 */
export function isClientAuthRequired(): boolean {
  // Only require client auth in development or if explicitly enabled
  const isDev = import.meta.env.DEV
  const requireAuth = import.meta.env.VITE_REQUIRE_CLIENT_AUTH === 'true'
  
  return isDev || requireAuth
}

/**
 * Generate bcrypt hash for a password (utility function)
 * Use this to generate CLIENT_PASSWORD_HASH
 */
export async function generatePasswordHash(password: string): Promise<string> {
  const saltRounds = 10
  return await bcrypt.hash(password, saltRounds)
}

