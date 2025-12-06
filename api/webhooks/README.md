# Square Webhooks

Vercel serverless functions that handle Square webhook events for real-time inventory and order updates.

## Endpoints

### Inventory Webhook
**URL:** `https://your-domain.vercel.app/api/webhooks/square-inventory`

### Order/Payment Webhook
**URL:** `https://your-domain.vercel.app/api/webhooks/square-order-paid`

## Setup Instructions

### 1. Deploy to Vercel

The function is automatically deployed when you push to your Vercel-connected repository.

### 2. Configure Environment Variables in Vercel

Add these environment variables in your Vercel project settings:

**For Inventory Webhook:**
- `INVENTORY_WEBHOOK_SIGNATURE_KEY` - Your Square inventory webhook signature key (from subscription ID `wbhk_a66f297ffa924d0fa0dbc0f599165aa0`)

**For Order/Payment Webhook:**
- `ORDER_WEBHOOK_SIGNATURE_KEY` - Your Square order webhook signature key (from subscription ID `wbhk_7ac9280960c548149af3bc96293cfcf1`)

**Note:** Each webhook subscription has its own unique signature key. Make sure to use the correct key for each webhook handler.

**Shared:**
- `SPR_NEON_DATABSE_URL` (or `DATABASE_URL` or `SPR_POSTGRES_URL`) - Your Neon database connection string

### 3. Configure Webhooks in Square Dashboard

#### Inventory Webhook
1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to **Webhooks** section
4. Click **Add Webhook Subscription**
5. Enter your webhook URL: `https://your-domain.vercel.app/api/webhooks/square-inventory`
6. Subscribe to: `inventory.count.updated`
7. Copy the **Webhook Signature Key** and add it to Vercel as `INVENTORY_WEBHOOK_SIGNATURE_KEY` or `SQUARE_SIGNATURE_KEY`

#### Order/Payment Webhook
1. In the same Square Dashboard, add another webhook subscription
2. Enter your webhook URL: `https://your-domain.vercel.app/api/webhooks/square-order-paid`
3. Subscribe to:
   - `order.updated`
   - `payment.created`
   - `payment.updated`
4. Copy the **Webhook Signature Key** and add it to Vercel as `ORDER_WEBHOOK_SIGNATURE_KEY`

### 4. Test the Webhook

After deployment, Square will send a test webhook. Check Vercel function logs to verify it's working.

## How It Works

### Inventory Webhook (`/api/webhooks/square-inventory`)

1. **Signature Verification**: Verifies the webhook signature using HMAC SHA256
2. **Event Processing**: Processes `inventory.count.updated` events
3. **Database Update**: 
   - Updates `products.stock_count` with the new quantity
   - Creates an `inventory` record for audit trail
   - Calculates `quantity_change` (positive for restocks, negative for sales)

### Order/Payment Webhook (`/api/webhooks/square-order-paid`)

1. **Signature Verification**: Verifies the webhook signature using HMAC SHA256
2. **Event Processing**: Processes `order.updated`, `payment.created`, and `payment.updated` events
3. **Database Update**:
   - Updates order status based on Square order state
   - Links payments to orders via `square_payment_id`
   - Updates order status when payments are approved/completed

## Webhook Payload Structure

Square sends webhooks in this format:

```json
{
  "type": "inventory.count.updated",
  "merchant_id": "MERCHANT_ID",
  "event_id": "EVENT_ID",
  "created_at": "2025-12-06T00:00:00Z",
  "data": {
    "type": "inventory.count",
    "id": "COUNT_ID",
    "object": {
      "catalog_object_id": "VARIATION_ID",
      "catalog_object_type": "ITEM_VARIATION",
      "state": "CUSTOM",
      "location_id": "LOCATION_ID",
      "quantity": "123"
    }
  }
}
```

## Response Format

Success response (200):
```json
{
  "success": true,
  "event_type": "inventory.count.updated",
  "processed": 1,
  "results": [
    {
      "productId": "VARIATION_ID",
      "previousStock": 100,
      "newStock": 123,
      "change": 23
    }
  ]
}
```

Error responses:
- `401`: Invalid or missing signature
- `400`: Invalid payload structure
- `405`: Method not allowed (only POST is accepted)
- `500`: Server error (database connection, etc.)

## Monitoring

Check Vercel function logs to monitor webhook activity:
- Go to Vercel Dashboard > Your Project > Functions
- Click on `/api/webhooks/square-inventory`
- View real-time logs

## Troubleshooting

### Signature Verification Fails

- Verify `SQUARE_SIGNATURE_KEY` is set correctly in Vercel
- Ensure the signature key matches the one in Square Dashboard
- Check that the webhook URL in Square matches your Vercel deployment URL

### Product Not Found

- Ensure products were loaded using `npm run square:fetch`
- Verify `catalog_object_id` in webhook matches `square_variation_id` in database

### Database Connection Errors

- Verify database URL is set in Vercel environment variables
- Check that the database is accessible from Vercel's network

