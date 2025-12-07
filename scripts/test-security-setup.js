/**
 * Test Security Setup
 * 
 * Verifies that JWT_SECRET, bcrypt, and jsonwebtoken are properly configured
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const JWT_SECRET = process.env.JWT_SECRET;

console.log('\n🔒 Testing Security Setup\n');
console.log('='.repeat(80));

// Test 1: Check JWT_SECRET is set
console.log('\n1️⃣  Testing JWT_SECRET environment variable...');
if (!JWT_SECRET) {
  console.error('❌ FAILED: JWT_SECRET is not set in environment variables');
  console.error('   Please add JWT_SECRET to your .env.local file');
  console.error('   Run: node scripts/generate-jwt-secret.js to generate one');
  process.exit(1);
} else {
  console.log('✅ PASSED: JWT_SECRET is set');
  console.log(`   Secret length: ${JWT_SECRET.length} characters`);
  console.log(`   Secret preview: ${JWT_SECRET.substring(0, 20)}...`);
}

// Test 2: Test JWT signing
console.log('\n2️⃣  Testing JWT token signing...');
try {
  const testPayload = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'customer',
  };
  
  const token = jwt.sign(testPayload, JWT_SECRET, { expiresIn: '1h' });
  
  if (!token || token.length === 0) {
    throw new Error('Token generation failed');
  }
  
  console.log('✅ PASSED: JWT token signed successfully');
  console.log(`   Token length: ${token.length} characters`);
  console.log(`   Token preview: ${token.substring(0, 30)}...`);
  
  // Test 3: Test JWT verification
  console.log('\n3️⃣  Testing JWT token verification...');
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.userId !== testPayload.userId) {
      throw new Error('Token payload mismatch');
    }
    
    console.log('✅ PASSED: JWT token verified successfully');
    console.log(`   Decoded payload:`, {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
    });
  } catch (verifyError) {
    console.error('❌ FAILED: JWT token verification failed');
    console.error('   Error:', verifyError.message);
    process.exit(1);
  }
  
  // Test 4: Test invalid token rejection
  console.log('\n4️⃣  Testing invalid token rejection...');
  try {
    jwt.verify('invalid-token', JWT_SECRET);
    console.error('❌ FAILED: Invalid token was accepted (should be rejected)');
    process.exit(1);
  } catch (invalidError) {
    console.log('✅ PASSED: Invalid token correctly rejected');
    console.log(`   Error type: ${invalidError.name}`);
  }
  
} catch (signError) {
  console.error('❌ FAILED: JWT token signing failed');
  console.error('   Error:', signError.message);
  process.exit(1);
}

// Test 5: Test bcrypt password hashing
console.log('\n5️⃣  Testing bcrypt password hashing...');
try {
  const testPassword = 'TestPassword123!';
  const saltRounds = 10;
  
  const hash = await bcrypt.hash(testPassword, saltRounds);
  
  if (!hash || hash.length === 0) {
    throw new Error('Hash generation failed');
  }
  
  console.log('✅ PASSED: Password hashed successfully');
  console.log(`   Hash length: ${hash.length} characters`);
  console.log(`   Hash preview: ${hash.substring(0, 30)}...`);
  
  // Test 6: Test bcrypt password verification
  console.log('\n6️⃣  Testing bcrypt password verification...');
  try {
    const isValid = await bcrypt.compare(testPassword, hash);
    
    if (!isValid) {
      throw new Error('Password verification failed');
    }
    
    console.log('✅ PASSED: Password verified successfully');
    
    // Test wrong password rejection
    const isWrongPasswordValid = await bcrypt.compare('WrongPassword', hash);
    if (isWrongPasswordValid) {
      throw new Error('Wrong password was accepted (should be rejected)');
    }
    
    console.log('✅ PASSED: Wrong password correctly rejected');
    
  } catch (verifyError) {
    console.error('❌ FAILED: Password verification failed');
    console.error('   Error:', verifyError.message);
    process.exit(1);
  }
  
} catch (hashError) {
  console.error('❌ FAILED: Password hashing failed');
  console.error('   Error:', hashError.message);
  process.exit(1);
}

// Test 7: Test token expiration
console.log('\n7️⃣  Testing JWT token expiration...');
try {
  const shortLivedToken = jwt.sign(
    { userId: 'test-user-456' },
    JWT_SECRET,
    { expiresIn: '1s' } // Expires in 1 second
  );
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    jwt.verify(shortLivedToken, JWT_SECRET);
    console.error('❌ FAILED: Expired token was accepted (should be rejected)');
    process.exit(1);
  } catch (expiredError) {
    if (expiredError.name === 'TokenExpiredError') {
      console.log('✅ PASSED: Expired token correctly rejected');
      console.log(`   Expired at: ${expiredError.expiredAt}`);
    } else {
      throw expiredError;
    }
  }
} catch (expirationError) {
  console.error('❌ FAILED: Token expiration test failed');
  console.error('   Error:', expirationError.message);
  process.exit(1);
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('\n✅ ALL TESTS PASSED!');
console.log('\n📋 Security Setup Summary:');
console.log('   ✓ JWT_SECRET is configured');
console.log('   ✓ JWT signing and verification working');
console.log('   ✓ Invalid tokens are rejected');
console.log('   ✓ Token expiration is enforced');
console.log('   ✓ Password hashing with bcrypt working');
console.log('   ✓ Password verification working');
console.log('   ✓ Wrong passwords are rejected');
console.log('\n🎉 Your security setup is ready to use!\n');

process.exit(0);

