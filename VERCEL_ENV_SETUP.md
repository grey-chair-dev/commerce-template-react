# Vercel Environment Variables Setup

This guide explains how to set up Square API credentials in Vercel.

## Required Environment Variables

You need to set the following environment variables in Vercel:

1. **`SQUARE_ACCESS_TOKEN`** - Your Square API access token
2. **`SQUARE_LOCATION_ID`** - Your Square location ID
3. **`SQUARE_ENVIRONMENT`** (optional) - Either `sandbox` or `production` (defaults to `sandbox`)

## How to Set Environment Variables in Vercel

### Method 1: Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard: https://vercel.com/dashboard
2. Select your project (`commerce-template-react` or similar)
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Click **Add New**
   - Enter the variable name (e.g., `SQUARE_ACCESS_TOKEN`)
   - Enter the value
   - Select the environments where it should be available:
     - ✅ Production
     - ✅ Preview
     - ✅ Development (optional)
   - Click **Save**
5. Repeat for all required variables

### Method 2: Vercel CLI

```bash
# Set SQUARE_ACCESS_TOKEN
vercel env add SQUARE_ACCESS_TOKEN production
# When prompted, paste your Square access token

# Set SQUARE_LOCATION_ID
vercel env add SQUARE_LOCATION_ID production
# When prompted, paste your Square location ID

# Set SQUARE_ENVIRONMENT (optional)
vercel env add SQUARE_ENVIRONMENT production
# Enter: production or sandbox
```

## Getting Your Square Credentials

### Square Access Token

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Go to **Credentials** → **Access Tokens**
4. Copy your **Production** or **Sandbox** access token
   - Use **Production** token for live site
   - Use **Sandbox** token for testing

### Square Location ID

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Go to **Locations**
4. Copy the **Location ID** (starts with `L`)

## Verifying Your Setup

After setting the environment variables:

1. **Redeploy your application** (Vercel will automatically redeploy when you add environment variables, or you can trigger a manual redeploy)

2. **Test the configuration** by visiting:
   ```
   https://your-domain.vercel.app/api/monitoring/debug
   ```
   This endpoint will show you which environment variables are configured (without exposing their values).

3. **Check the logs** in Vercel Dashboard → **Deployments** → Select a deployment → **Functions** → Check for any errors about missing environment variables.

## Important Notes

- **Environment variables are case-sensitive** - Use exact names: `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`
- **Redeploy after adding variables** - Changes to environment variables require a new deployment
- **Don't commit secrets** - Never commit `.env.local` or `.env` files with real credentials to git
- **Use different tokens for different environments** - Consider using Sandbox tokens for preview deployments and Production tokens for production

## Troubleshooting

### "SQUARE_ACCESS_TOKEN not configured" error

1. Check that the variable name is exactly `SQUARE_ACCESS_TOKEN` (case-sensitive)
2. Verify it's set for the correct environment (Production/Preview/Development)
3. Redeploy your application after adding the variable
4. Check Vercel logs for any errors

### "Invalid or expired Square access token" error

1. Verify your token is still valid in Square Developer Dashboard
2. Check that you're using the correct token (Production vs Sandbox)
3. Ensure `SQUARE_ENVIRONMENT` matches your token type
4. Regenerate the token if needed

### Variables not appearing in functions

1. Make sure you've redeployed after adding the variables
2. Check that variables are set for the correct environment
3. Verify the variable names match exactly (no typos, correct case)

## Related Files

- `api/checkout/create.js` - Uses `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID`
- `api/webhooks/square-order-paid.js` - Uses `SQUARE_ACCESS_TOKEN` for fetching order details
- `api/monitoring/debug.js` - Can verify environment variable configuration

