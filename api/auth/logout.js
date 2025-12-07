/**
 * User Logout Endpoint
 * 
 * Clears the authentication cookie
 */

const COOKIE_NAME = 'auth_token';

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
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear the auth cookie by setting it to expire immediately
  const cookieOptions = [
    `${COOKIE_NAME}=`,
    'Max-Age=0', // Expire immediately
    'Path=/',
    'HttpOnly',
  ];

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    cookieOptions.push('SameSite=Strict');
    cookieOptions.push('Secure');
  } else {
    cookieOptions.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', cookieOptions.join('; '));

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

