# Make.com Email Webhook Setup Guide

This guide will walk you through setting up Make.com to handle **all transactional emails** for Spiral Groove Records using a single webhook URL with routing.

## Overview

We use **one webhook URL** that receives all email types, then route them in Make.com based on the `emailType` field. This is simpler than managing multiple webhook URLs.

**Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

## Email Types

The system sends emails with an `emailType` field that you can use for routing:

1. **`welcome`** - Welcome email when user signs up
2. **`order-confirmation`** - Order confirmation when payment is approved
3. **`order-status-update`** - Order status updates (Ready for Pickup, etc.)
4. **`password-reset`** - Password reset emails

## Step 1: Create a New Scenario

1. Log in to [Make.com](https://www.make.com)
2. Click **"Create a new scenario"**
3. Name it: **"Spiral Groove - All Transactional Emails"**

## Step 2: Add Webhook Module (Trigger)

1. Click **"Add a module"** or the **"+"** button
2. Search for **"Webhooks"** → Select **"Custom webhook"**
3. Click **"Add"**
4. Choose **"Instant"** (for real-time processing)
5. Click **"Save"** to create the webhook
6. **Copy the webhook URL** - it should match: `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`
7. Click **"OK"**

## Step 3: Add Router Module

1. Click **"Add a module"** after the webhook
2. Search for **"Router"** → Select **"Router"**
3. Click **"Add"**
4. Configure routes based on `emailType`:

### Route 1: Welcome Emails
- **Condition:** `emailType` equals `welcome`
- **Route name:** "Welcome Email"

### Route 2: Order Confirmation
- **Condition:** `emailType` equals `order-confirmation`
- **Route name:** "Order Confirmation"

### Route 3: Order Status Updates
- **Condition:** `emailType` equals `order-status-update`
- **Route name:** "Order Status Update"

### Route 4: Password Reset
- **Condition:** `emailType` equals `password-reset`
- **Route name:** "Password Reset"

### Route 5: Default/Catch-all
- **Condition:** No condition (default route)
- **Route name:** "Generic Email"

## Step 4: Add Email Module to Each Route

For each route, add an email module (SendGrid, Mailgun, Resend, or SMTP):

### Option A: SendGrid (Recommended)

1. Click **"Add a module"** in each route
2. Search for **"SendGrid"** → Select **"Send an email"**
3. Click **"Add"**
4. **First time setup:**
   - Click **"Create a connection"**
   - Enter your SendGrid API Key
   - Click **"Save"**
5. **Configure the email:**
   - **From email:** `noreply@spiralgrooverecords.com` (or your verified domain)
   - **From name:** `Spiral Groove Records`
   - **To:** Map `to` from webhook data
   - **Subject:** Map `subject` from webhook data
   - **HTML content:** Map `html` from webhook data
   - **Plain text content:** Map `text` from webhook data
6. Click **"OK"**

### Option B: Mailgun

1. Click **"Add a module"** in each route
2. Search for **"Mailgun"** → Select **"Send an email"**
3. Click **"Add"**
4. **First time setup:**
   - Click **"Create a connection"**
   - Enter your Mailgun API Key and Domain
   - Click **"Save"**
5. **Configure the email:**
   - **From:** `noreply@yourdomain.com`
   - **To:** Map `to` from webhook
   - **Subject:** Map `subject` from webhook
   - **HTML:** Map `html` from webhook
   - **Text:** Map `text` from webhook
6. Click **"OK"**

### Option C: Resend

1. Click **"Add a module"** in each route
2. Search for **"Resend"** → Select **"Send an email"**
3. Click **"Add"**
4. **First time setup:**
   - Click **"Create a connection"**
   - Enter your Resend API Key
   - Click **"Save"**
5. **Configure the email:**
   - **From:** `Spiral Groove Records <noreply@spiralgrooverecords.com>`
   - **To:** Map `to` from webhook
   - **Subject:** Map `subject` from webhook
   - **HTML:** Map `html` from webhook
   - **Text:** Map `text` from webhook
6. Click **"OK"**

## Step 5: Data Mapping

When mapping fields from the webhook to the email module, you'll see a data structure like this:

### Welcome Email Payload:
```json
{
  "to": "customer@example.com",
  "subject": "Welcome to Spiral Groove Records!",
  "html": "<!DOCTYPE html>...",
  "text": "Welcome to Spiral Groove Records!...",
  "emailType": "welcome",
  "customerName": "John"
}
```

### Order Confirmation Payload:
```json
{
  "to": "customer@example.com",
  "subject": "Order Confirmation - ORD-12345 - Spiral Groove Records",
  "html": "<!DOCTYPE html>...",
  "text": "Order Confirmation...",
  "emailType": "order-confirmation",
  "orderNumber": "ORD-12345",
  "orderId": "uuid-here",
  "customerName": "John Doe",
  "orderUrl": "https://spiralgrooverecords.greychair.io/order-confirmation?id=..."
}
```

### Order Status Update Payload:
```json
{
  "to": "customer@example.com",
  "subject": "Order ORD-12345 - Ready - Spiral Groove Records",
  "html": "<!DOCTYPE html>...",
  "text": "Order Status Update...",
  "emailType": "order-status-update",
  "orderNumber": "ORD-12345",
  "orderId": "uuid-here",
  "status": "Ready",
  "previousStatus": "In Progress",
  "customerName": "John Doe"
}
```

### Password Reset Payload:
```json
{
  "to": "customer@example.com",
  "subject": "Reset Your Password - Spiral Groove Records",
  "html": "<!DOCTYPE html>...",
  "text": "Reset Your Password...",
  "emailType": "password-reset",
  "customerName": "John",
  "resetUrl": "https://spiralgrooverecords.greychair.io/reset-password?token=..."
}
```

**Map these fields in each email module:**
- `to` → Email "To" field
- `subject` → Email "Subject" field
- `html` → Email "HTML content" field
- `text` → Email "Plain text content" field

## Step 6: Error Handling (Optional but Recommended)

1. Add an **"Error handler"** module after each email module
2. Configure it to:
   - Log errors to a file/database
   - Send you a notification if email fails
   - Or retry the email

## Step 7: Activate the Scenario

1. Click the **"Toggle"** switch at the bottom to activate the scenario
2. The scenario will now listen for webhook requests
3. Status should show **"Active"** (green)

## Step 8: Test Each Email Type

### Test Welcome Email:
1. Sign up a new account in your application
2. Check Make.com executions - should see `emailType: "welcome"`
3. Check email inbox for welcome email

### Test Order Confirmation:
1. Complete a test order
2. Check Make.com executions - should see `emailType: "order-confirmation"`
3. Check email inbox for order confirmation

### Test Order Status Update:
1. Update an order status to "Ready" in Square
2. Check Make.com executions - should see `emailType: "order-status-update"`
3. Check email inbox for status update email

### Test Password Reset:
1. Request a password reset
2. Check Make.com executions - should see `emailType: "password-reset"`
3. Check email inbox for password reset email

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

### Email Not Sending

1. **Check email service connection:**
   - Verify API keys are correct
   - Test the connection in Make.com

2. **Check email service limits:**
   - Free tiers have sending limits
   - Verify you haven't exceeded limits

3. **Check spam folder:**
   - Transactional emails sometimes go to spam
   - Verify sender domain is authenticated

### Router Not Working

1. **Check emailType field:**
   - Run the scenario once manually
   - Check the webhook module output
   - Verify `emailType` field is present

2. **Verify router conditions:**
   - Make sure conditions match exactly: `emailType` equals `"welcome"` (with quotes)
   - Use the data mapper to select the field

## Advanced: Custom Email Templates

If you want to customize email templates for different types:

1. Add a **"Set variable"** module before the email module in each route
2. Customize the HTML/text content based on `emailType`
3. Use Make.com's template engine or HTML builder

## Best Practices

1. **Monitor executions:** Regularly check Make.com executions for errors
2. **Set up alerts:** Configure Make.com to notify you of failures
3. **Test regularly:** Test the webhook after code deployments
4. **Keep webhook URL secure:** Don't commit `.env.local` to git
5. **Use verified domains:** Authenticate your sending domain for better deliverability
6. **Rate limiting:** Be aware of email service rate limits

## Email Types Reference

| Email Type | When Sent | Key Fields |
|------------|-----------|------------|
| `welcome` | User signs up | `customerName` |
| `order-confirmation` | Payment approved | `orderNumber`, `orderId`, `orderUrl` |
| `order-status-update` | Order status changes | `orderNumber`, `status`, `previousStatus` |
| `password-reset` | Password reset requested | `resetUrl`, `customerName` |

## Support

- **Make.com Documentation:** https://www.make.com/en/help
- **Make.com Community:** https://community.make.com
- **Webhook Testing:** Use tools like Postman or curl to test the webhook directly

---

**Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

**Environment Variable:** `MAKE_WEBHOOK_URL` in `.env.local` and Vercel

