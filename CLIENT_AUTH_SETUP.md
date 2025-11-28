# Client Portal Authentication Setup

This guide explains how to set up client authentication for Spiral Groove during development.

## Overview

The client portal authentication system provides a password-protected gate that restricts access to the application during development. It uses:

- **bcrypt** for password hashing
- **JWT** for session management
- **localStorage** for token storage

## Quick Setup

### 1. Generate Password Hash

```bash
npm run client:generate-hash "your-secure-password"
```

This will output a bcrypt hash. Copy it to your `.env.local` file.

### 2. Generate Auth Secret

```bash
npm run client:generate-secret
```

This will output a random 32-byte hex string. Copy it to your `.env.local` file.

### 3. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Option 1: Use plain text password (development only)
VITE_CLIENT_PASSWORD=your-secure-password

# Option 2: Use bcrypt hash (recommended)
VITE_CLIENT_PASSWORD_HASH=$2a$10$your-generated-hash-here

# JWT signing secret
VITE_AUTH_SECRET=your-generated-secret-here

# Enable client auth (set to 'true' for production)
VITE_REQUIRE_CLIENT_AUTH=false
```

## How It Works

### Development Mode (Default)

- Client authentication is **automatically enabled** in development mode (`npm run dev`)
- Users must enter the password to access the application
- Session tokens are stored in localStorage and last for 7 days

### Production Mode

- Client authentication is **disabled by default** in production
- To enable in production, set `VITE_REQUIRE_CLIENT_AUTH=true`
- This allows you to protect the site even in production if needed

## Security Notes

1. **Never commit passwords or secrets to version control**
   - Add `.env.local` to `.gitignore` (already done)
   - Use environment variables in your deployment platform

2. **Use bcrypt hash in production**
   - Plain text passwords (`VITE_CLIENT_PASSWORD`) should only be used in development
   - Always use `VITE_CLIENT_PASSWORD_HASH` in production

3. **Generate strong secrets**
   - Use `npm run client:generate-secret` to generate a random 32-byte secret
   - Never reuse secrets across environments

4. **Session management**
   - Tokens expire after 7 days
   - Tokens are stored in localStorage (cleared on logout)
   - JWT tokens are signed with your `AUTH_SECRET`

## Usage

### For Developers

1. Start the development server: `npm run dev`
2. You'll see the client login page
3. Enter the password configured in `.env.local`
4. You'll be authenticated for 7 days (or until you clear localStorage)

### For Clients

1. Share the password securely with your client
2. They'll see the login page when accessing the site
3. After entering the password, they'll have access for 7 days

## Troubleshooting

### "Client authentication not configured"

- Make sure you've set either `VITE_CLIENT_PASSWORD` or `VITE_CLIENT_PASSWORD_HASH` in `.env.local`
- Restart your development server after changing environment variables

### "Invalid password"

- Check that the password matches what's in your `.env.local` file
- If using a hash, make sure it was generated correctly with `npm run client:generate-hash`

### Session not persisting

- Check browser localStorage is enabled
- Clear localStorage and try logging in again
- Check that `VITE_AUTH_SECRET` is set correctly

## Disabling Client Auth

To disable client authentication:

1. Remove or comment out `VITE_CLIENT_PASSWORD` and `VITE_CLIENT_PASSWORD_HASH`
2. Set `VITE_REQUIRE_CLIENT_AUTH=false` (or remove it)
3. Restart your development server

## Production Deployment

When deploying to production:

1. **Set environment variables in your deployment platform** (Vercel, Netlify, etc.)
2. **Use bcrypt hash** (`VITE_CLIENT_PASSWORD_HASH`) instead of plain text
3. **Set `VITE_REQUIRE_CLIENT_AUTH=true`** if you want to enable it in production
4. **Never commit secrets** to your repository

Example Vercel environment variables:
```
VITE_CLIENT_PASSWORD_HASH=$2a$10$your-hash
VITE_AUTH_SECRET=your-secret
VITE_REQUIRE_CLIENT_AUTH=true
```

