# Make.com Blueprint Setup Guide

This guide explains how to use the provided blueprint to set up a simple transactional email scenario in Make.com.

## Blueprint Overview

The blueprint includes:
- **Module 1:** Custom Webhook (receives all email requests)
- **Module 2:** Gmail (sends emails)

This simple setup handles all email types (welcome, order confirmation, status updates, password reset) using a single Gmail module.

## Setup Instructions

### Option 1: Import Blueprint (Recommended)

1. Log in to [Make.com](https://www.make.com)
2. Click **"Create a new scenario"**
3. Click **"Import"** or **"Import from file"**
4. Upload the `make-com-blueprint.json` file
5. The scenario will be created with the webhook and Gmail modules

### Option 2: Manual Setup

If you prefer to set it up manually:

1. **Create New Scenario:**
   - Log in to Make.com
   - Click **"Create a new scenario"**
   - Name it: **"Spiral Groove Records - Transactional Emails"**

2. **Add Webhook Module:**
   - Click **"Add a module"** or the **"+"** button
   - Search for **"Webhooks"** → Select **"Custom webhook"**
   - Click **"Add"**
   - Choose **"Instant"** (for real-time processing)
   - Click **"Save"** to create the webhook
   - **Copy the webhook URL** - it should match: `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`
   - Click **"OK"**

3. **Add Gmail Module:**
   - Click **"Add a module"** after the webhook
   - Search for **"Gmail"** → Select **"Send an email"**
   - Click **"Add"**
   - **First time setup:**
     - Click **"Create a connection"**
     - Sign in with your Gmail account (support@greychair.io)
     - Grant permissions
     - Click **"Save"**

4. **Configure Gmail Module:**
   - **To:** Click the mapping icon (📋) → Select `to` from webhook data (`{{1.to}}`)
   - **From:** `"Spiral Groove Records" <support@greychair.io>`
   - **Subject:** Click mapping → Select `subject` (`{{1.subject}}`)
   - **Content:** Click mapping → Select `html` (`{{1.html}}`)
   - **Body type:** Select **"Raw HTML"**
   - Click **"OK"**

## Configuration Details

### Webhook Module
- **Type:** Custom webhook (instant)
- **Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`
- **Receives:** All email types with this structure:
  ```json
  {
    "to": "customer@example.com",
    "subject": "Email Subject",
    "html": "<!DOCTYPE html>...",
    "text": "Plain text version...",
    "emailType": "welcome|order-confirmation|order-status-update|password-reset",
    "customerName": "John Doe",
    "orderNumber": "ORD-12345",
    "orderId": "uuid-here",
    "status": "Ready",
    "resetUrl": "https://..."
  }
  ```

### Gmail Module
- **Connection:** Gmail account (support@greychair.io)
- **From:** `"Spiral Groove Records" <support@greychair.io>`
- **To:** Mapped from webhook `{{1.to}}`
- **Subject:** Mapped from webhook `{{1.subject}}`
- **Content:** Mapped from webhook `{{1.html}}` (Raw HTML)
- **Body Type:** Raw HTML

## Email Types Handled

This single setup handles all email types:

1. **Welcome Email** (`emailType: "welcome"`)
   - Sent when user signs up
   - Subject: "Welcome to Spiral Groove Records!"

2. **Order Confirmation** (`emailType: "order-confirmation"`)
   - Sent when payment is approved
   - Subject: "Order Confirmation - ORD-XXXXX - Spiral Groove Records"

3. **Order Status Update** (`emailType: "order-status-update"`)
   - Sent when order status changes (Ready, Picked Up, etc.)
   - Subject: "Order ORD-XXXXX - [Status] - Spiral Groove Records"

4. **Password Reset** (`emailType: "password-reset"`)
   - Sent when user requests password reset
   - Subject: "Reset Your Password - Spiral Groove Records"

## Testing

### Test Welcome Email:
1. Sign up a new account in your application
2. Check Make.com executions - should see execution with `emailType: "welcome"`
3. Check email inbox for welcome email

### Test Order Confirmation:
1. Complete a test order
2. Check Make.com executions - should see execution with `emailType: "order-confirmation"`
3. Check email inbox for order confirmation

### Test Order Status Update:
1. Update an order status to "Ready" in Square
2. Check Make.com executions - should see execution with `emailType: "order-status-update"`
3. Check email inbox for status update email

### Test Password Reset:
1. Request a password reset
2. Check Make.com executions - should see execution with `emailType: "password-reset"`
3. Check email inbox for password reset email

## Activate Scenario

1. Click **"Save"** to save your scenario
2. Toggle the scenario to **"Active"** (green switch at the bottom)
3. Status should show **"Active"** (green)

## Troubleshooting

### Webhook Not Receiving Data

1. **Check webhook URL in `.env.local`:**
   ```env
   MAKE_WEBHOOK_URL=https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h
   ```

2. **Verify scenario is active** (toggle switch should be ON)

3. **Check webhook logs in Make.com:**
   - Go to **"Operations"** → **"Executions"**
   - Look for failed executions
   - Click on an execution to see error details

### Gmail Not Sending

1. **Check Gmail connection:**
   - Verify connection is active in Make.com
   - Re-authenticate if needed

2. **Check Gmail sending limits:**
   - Gmail has daily sending limits (500 emails/day for free accounts)
   - Consider using a Google Workspace account for higher limits

3. **Check spam folder:**
   - Emails might go to spam
   - Verify sender email is authenticated

4. **Check field mappings:**
   - Verify `to`, `subject`, and `html` are correctly mapped
   - Use the data mapper to verify field names

### Emails Not Arriving

1. **Check Make.com executions:**
   - Go to **"Operations"** → **"Executions"**
   - Check if executions are successful (green) or failed (red)
   - Click on execution to see details

2. **Check email service logs:**
   - Review Gmail sending logs
   - Check for bounce messages

3. **Verify recipient email:**
   - Make sure recipient email is valid
   - Check for typos in email addresses

## Environment Variables

Make sure these are set in your `.env.local` and Vercel:

```env
MAKE_WEBHOOK_URL=https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h
```

## Advantages of This Simple Setup

✅ **Simple:** One webhook, one email module  
✅ **Easy to maintain:** No complex routing logic  
✅ **Works for all email types:** Same structure for all emails  
✅ **Fast setup:** Can be configured in minutes  

## When to Use Router Instead

Consider adding a Router module if you need:
- Different email templates per type
- Different processing per email type
- Analytics per email type
- Conditional logic based on email type

For most use cases, this simple setup is sufficient!

## Support

- **Make.com Documentation:** https://www.make.com/en/help
- **Make.com Community:** https://community.make.com
- **Gmail API Limits:** https://developers.google.com/gmail/api/reference/quota

---

**Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

**Environment Variable:** `MAKE_WEBHOOK_URL` in `.env.local` and Vercel

