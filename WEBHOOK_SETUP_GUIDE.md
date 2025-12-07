# Square Order Webhook Setup Guide

This guide will help you set up the Square Order webhook so that order status updates in Square automatically sync to your database.

## Step 1: Deploy Your Application

Make sure your application is deployed to Vercel and accessible at a public URL (not localhost).

## Step 2: Configure Webhook in Square Dashboard

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to **Webhooks** section
4. Click **Add Webhook Subscription** or **Create Webhook**
5. Enter your webhook URL:
   ```
   https://your-domain.vercel.app/api/webhooks/square-order-paid
   ```
   Replace `your-domain.vercel.app` with your actual Vercel deployment URL.

6. Subscribe to these events:
   - `order.updated` - Triggers when order status changes
   - `payment.created` - Triggers when payment is created
   - `payment.updated` - Triggers when payment status changes

7. **Important**: Copy the **Webhook Signature Key** that Square provides. You'll need this in the next step.

## Step 3: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:
   - **Name**: `ORDER_WEBHOOK_SIGNATURE_KEY`
   - **Value**: The webhook signature key you copied from Square Dashboard
   - **Environment**: Production, Preview, Development (select all)

4. Also verify these variables are set:
   - `SPR_DATABASE_URL` or `DATABASE_URL` - Your Neon database connection string
   - `SQUARE_ACCESS_TOKEN` - Your Square API access token
   - `SQUARE_LOCATION_ID` - Your Square location ID

## Step 4: Test Your Webhook Setup

1. Visit your test endpoint:
   ```
   https://your-domain.vercel.app/api/webhooks/test-square-order
   ```

2. This will show you:
   - Whether your webhook signature key is configured
   - Whether your database URL is configured
   - Your webhook URL
   - Setup instructions
   - Troubleshooting tips

## Step 5: Verify Webhook is Working

1. **Check Vercel Logs**:
   ```bash
   vercel logs --follow
   ```
   Or check logs in Vercel Dashboard → Your Project → Logs

2. **Update an order in Square**:
   - Go to Square Dashboard → Orders
   - Find an order
   - Change its fulfillment status (e.g., mark as "Ready")
   - Watch your Vercel logs for `[Webhook]` messages

3. **Check your database**:
   - The order status should update automatically
   - Check the `orders` table in your Neon database
   - The `status` column should reflect the new status

## Troubleshooting

### Webhook Not Firing

**Symptoms**: No logs appear when you update an order in Square

**Solutions**:
- Verify webhook URL is correct in Square Dashboard
- Check that webhook is **enabled** in Square Dashboard
- Verify events are subscribed (`order.updated`, `payment.created`, `payment.updated`)
- Make sure webhook URL is publicly accessible (not localhost)
- Check Square Dashboard → Webhooks → Recent Events for delivery status

### Signature Verification Failing

**Symptoms**: Logs show "Invalid webhook signature" or 403 errors

**Solutions**:
- Verify `ORDER_WEBHOOK_SIGNATURE_KEY` matches the key from Square Dashboard
- Check that signature key has no extra spaces or quotes
- Ensure you're using the signature key from the **order webhook subscription** (not inventory)
- Re-deploy your Vercel app after adding the environment variable

### Database Not Updating

**Symptoms**: Webhook is received but database status doesn't change

**Solutions**:
- Check Vercel logs for `[Webhook]` messages to see what's happening
- Verify order exists in database with correct `square_order_id`
- Check database connection string is correct
- Look for error messages in logs

### Status Stays "Confirmed"

**Symptoms**: Order status doesn't change when updated in Square

**Solutions**:
- Check webhook logs to see what fulfillment state Square is sending
- Verify fulfillment state mapping is correct (RESERVED → processing, PREPARED → ready for pickup, etc.)
- Check if webhook is actually being called (look for `[Webhook]` log messages)

## Manual Testing

If webhooks aren't working, you can manually update order status using the admin API:

```bash
curl -X PUT https://your-domain.vercel.app/api/admin/orders/ORDER_ID/status \
  -H "Authorization: Bearer YOUR_ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"status": "in progress"}'
```

## Need Help?

1. Check the test endpoint: `/api/webhooks/test-square-order`
2. Review Vercel logs for detailed error messages
3. Check Square Dashboard → Webhooks → Recent Events for delivery status
4. Verify all environment variables are set correctly

