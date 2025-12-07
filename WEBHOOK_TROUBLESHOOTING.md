# Make.com Webhook Troubleshooting Guide

## Error: 410 Gone

If you see a **410 Gone** error when testing the webhook, it means:

### Possible Causes:
1. **Scenario is not active** - The Make.com scenario must be turned ON
2. **Webhook URL expired** - Make.com webhook URLs can expire if the scenario is inactive for too long
3. **Webhook was deleted** - The webhook module was removed from the scenario
4. **Scenario was deleted** - The entire scenario was deleted

### Solution:

#### Step 1: Check Make.com Scenario
1. Log in to [Make.com](https://www.make.com)
2. Go to **"Scenarios"**
3. Find your scenario: **"Spiral Groove - Password Reset Emails"**
4. Check if it exists and is **ACTIVE** (green toggle switch)

#### Step 2: Verify Webhook Module
1. Open the scenario
2. Check if the **"Custom webhook"** module exists
3. If missing, add it:
   - Click **"Add a module"**
   - Search for **"Webhooks"** → **"Custom webhook"**
   - Click **"Add"**
   - Choose **"Instant"**
   - Click **"Save"**

#### Step 3: Get New Webhook URL
1. Click on the webhook module
2. **Copy the webhook URL** (it will be different from the old one)
3. It should look like: `https://hook.us2.make.com/...`

#### Step 4: Update Environment Variable
1. Open `.env.local`
2. Update `MAKE_WEBHOOK_URL` with the new webhook URL:
   ```env
   MAKE_WEBHOOK_URL=https://hook.us2.make.com/YOUR_NEW_WEBHOOK_ID
   ```
3. Save the file

#### Step 5: Activate Scenario
1. In Make.com, make sure the scenario toggle is **ON** (green)
2. The scenario should show **"Active"** status

#### Step 6: Test Again
1. Run the test script:
   ```bash
   node scripts/test-make-webhook.js
   ```
2. Or trigger a password reset from the app
3. Check Make.com executions to verify the webhook received data

## Error: 404 Not Found

If you see a **404 Not Found** error:

- The webhook URL is incorrect
- Double-check the URL in `.env.local`
- Make sure there are no extra spaces or quotes
- Verify the URL in Make.com matches exactly

## Error: Network/Connection Issues

If you see connection errors:

1. **Check internet connectivity**
2. **Verify Make.com service status** - Check if Make.com is experiencing outages
3. **Check firewall/proxy settings** - Make sure outbound HTTPS connections are allowed
4. **Test webhook directly**:
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"test": "true"}'
   ```

## Webhook Not Receiving Data

If the webhook call succeeds (200 OK) but Make.com doesn't process it:

1. **Check Make.com executions:**
   - Go to **"Operations"** → **"Executions"**
   - Look for recent executions
   - Check if they show errors

2. **Verify webhook is "Instant":**
   - The webhook must be set to **"Instant"** mode (not "Scheduled")
   - This ensures real-time processing

3. **Check scenario errors:**
   - Open the execution details
   - Look for error messages in the email module
   - Fix any configuration issues

## Testing the Webhook

### Quick Test Script
```bash
node scripts/test-make-webhook.js
```

### Manual Test
```bash
curl -X POST "https://hook.us2.make.com/YOUR_WEBHOOK_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test",
    "html": "<h1>Test</h1>",
    "text": "Test",
    "emailType": "password-reset"
  }'
```

## Best Practices

1. **Keep scenario active** - Don't deactivate the scenario for long periods
2. **Monitor executions** - Regularly check Make.com executions for errors
3. **Set up error notifications** - Configure Make.com to notify you of failures
4. **Test after changes** - Always test the webhook after updating the scenario
5. **Backup webhook URL** - Save the webhook URL in a secure location

## Getting a New Webhook URL

If you need to create a new webhook:

1. **Add Custom Webhook module:**
   - Click **"Add a module"** in your scenario
   - Search for **"Webhooks"** → **"Custom webhook"**
   - Click **"Add"**

2. **Configure webhook:**
   - Choose **"Instant"** (for real-time processing)
   - Click **"Save"**
   - Copy the webhook URL

3. **Update environment:**
   - Update `MAKE_WEBHOOK_URL` in `.env.local`
   - Restart Vercel dev server if running

4. **Test:**
   - Run `node scripts/test-make-webhook.js`
   - Verify the webhook receives data

---

**Current Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

**Status:** ⚠️ Returns 410 Gone - Needs to be recreated in Make.com


