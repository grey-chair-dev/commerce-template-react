/**
 * Generate a secure JWT secret for session/token signing
 * Run this script to generate a cryptographically secure secret key
 */

import { randomBytes } from 'crypto';

function generateJWTSecret() {
  // Generate a 64-byte (512-bit) random secret
  const secret = randomBytes(64).toString('base64');
  
  console.log('\n✅ Generated JWT Secret:');
  console.log('='.repeat(80));
  console.log(secret);
  console.log('='.repeat(80));
  console.log('\n📋 Next steps:');
  console.log('1. Copy the secret above');
  console.log('2. Add it to Vercel environment variables:');
  console.log('   - Variable name: JWT_SECRET');
  console.log('   - Value: (paste the secret above)');
  console.log('   - Mark as sensitive: Yes');
  console.log('\n3. For local development, add to .env.local:');
  console.log('   JWT_SECRET=<paste-secret-here>');
  console.log('\n⚠️  Keep this secret secure and never commit it to version control!\n');
  
  return secret;
}

generateJWTSecret();

