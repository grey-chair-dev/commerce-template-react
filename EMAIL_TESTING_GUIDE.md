# Email Testing Guide

This guide shows you how to test each transactional email type to ensure they're working correctly with Make.com.

## Prerequisites

1. ✅ Make.com scenario is **active** (green toggle)
2. ✅ Google Email connection is configured
3. ✅ Webhook URL is set in `.env.local`: `MAKE_WEBHOOK_URL=https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`
4. ✅ Application is running (local or deployed)

## Testing Methods

### Method 1: Manual Testing (Recommended)
Test each email type by performing the actual user actions in your application.

### Method 2: API Testing
Use curl or Postman to send test webhook requests directly to Make.com.

### Method 3: Make.com Test Mode
Use Make.com's "Run once" feature to test with sample data.

---

## Test 1: Welcome Email

**Email Type:** `welcome`  
**Trigger:** User signs up for a new account

### Manual Testing:
1. Go to your application's signup page
2. Fill out the registration form with a **test email address** you can access
3. Submit the form
4. Check:
   - ✅ Make.com executions (should show new execution)
   - ✅ Email inbox (should receive welcome email)
   - ✅ Email content (should have Spiral Groove Records branding)

### API Testing (Direct to Make.com):
```bash
curl -X POST https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Welcome to Spiral Groove Records!",
    "html": "<!DOCTYPE html><html><body><h1>Welcome!</h1></body></html>",
    "text": "Welcome to Spiral Groove Records!",
    "emailType": "welcome",
    "customerName": "Test User"
  }'
```

### What to Verify:
- ✅ Email arrives in inbox (check spam folder too)
- ✅ Subject line: "Welcome to Spiral Groove Records!"
- ✅ Email contains Spiral Groove Records branding
- ✅ Email includes store address and hours
- ✅ Make.com execution shows success (green)

---

## Test 2: Order Confirmation Email

**Email Type:** `order-confirmation`  
**Trigger:** Payment is approved/completed for an order

### Manual Testing:
1. Add items to cart in your application
2. Proceed to checkout
3. Complete the checkout process with a **test payment**
4. After payment is approved, check:
   - ✅ Make.com executions (should show new execution)
   - ✅ Email inbox (should receive order confirmation)
   - ✅ Email contains order details (order number, items, total)

### API Testing (Direct to Make.com):
```bash
curl -X POST https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Order Confirmation - ORD-TEST123 - Spiral Groove Records",
    "html": "<!DOCTYPE html><html><body><h1>Order Confirmation</h1><p>Order Number: ORD-TEST123</p></body></html>",
    "text": "Order Confirmation\n\nOrder Number: ORD-TEST123",
    "emailType": "order-confirmation",
    "orderNumber": "ORD-TEST123",
    "orderId": "test-order-id",
    "customerName": "Test Customer",
    "orderUrl": "https://spiralgrooverecords.greychair.io/order-confirmation?id=test-order-id"
  }'
```

### What to Verify:
- ✅ Email arrives in inbox
- ✅ Subject line: "Order Confirmation - ORD-XXXXX - Spiral Groove Records"
- ✅ Email contains order number
- ✅ Email contains order items and totals
- ✅ Email contains pickup information
- ✅ Make.com execution shows success

---

## Test 3: Order Status Update Email

**Email Type:** `order-status-update`  
**Trigger:** Order status changes (especially to "Ready", "Picked Up", etc.)

### Manual Testing:
1. Create a test order (or use an existing order)
2. Update the order status in Square Dashboard to **"Ready"** (or another status)
3. The Square webhook should trigger the status update
4. Check:
   - ✅ Make.com executions (should show new execution)
   - ✅ Email inbox (should receive status update)
   - ✅ Email contains new status information

### API Testing (Direct to Make.com):
```bash
curl -X POST https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Order ORD-TEST123 - Ready - Spiral Groove Records",
    "html": "<!DOCTYPE html><html><body><h1>Order Status Update</h1><p>Your order ORD-TEST123 is Ready for Pickup!</p></body></html>",
    "text": "Order Status Update\n\nYour order ORD-TEST123 is Ready for Pickup!",
    "emailType": "order-status-update",
    "orderNumber": "ORD-TEST123",
    "orderId": "test-order-id",
    "status": "Ready",
    "previousStatus": "In Progress",
    "customerName": "Test Customer"
  }'
```

### What to Verify:
- ✅ Email arrives in inbox
- ✅ Subject line: "Order ORD-XXXXX - [Status] - Spiral Groove Records"
- ✅ Email contains order number
- ✅ Email contains new status
- ✅ If status is "Ready", email contains pickup instructions
- ✅ Make.com execution shows success

### Testing Different Statuses:
- **Ready:** Should include pickup instructions
- **Picked Up:** Should confirm pickup
- **Canceled:** Should explain cancellation
- **Refunded:** Should explain refund process

---

## Test 4: Password Reset Email

**Email Type:** `password-reset`  
**Trigger:** User requests password reset

### Manual Testing:
1. Go to your application's "Forgot Password" page
2. Enter a **test email address** you can access
3. Submit the form
4. Check:
   - ✅ Make.com executions (should show new execution)
   - ✅ Email inbox (should receive password reset email)
   - ✅ Email contains reset link

### API Testing (Direct to Make.com):
```bash
curl -X POST https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Reset Your Password - Spiral Groove Records",
    "html": "<!DOCTYPE html><html><body><h1>Reset Your Password</h1><p><a href=\"https://spiralgrooverecords.greychair.io/reset-password?token=test-token\">Reset Password</a></p></body></html>",
    "text": "Reset Your Password\n\nClick here: https://spiralgrooverecords.greychair.io/reset-password?token=test-token",
    "emailType": "password-reset",
    "customerName": "Test User",
    "resetUrl": "https://spiralgrooverecords.greychair.io/reset-password?token=test-token"
  }'
```

### What to Verify:
- ✅ Email arrives in inbox
- ✅ Subject line: "Reset Your Password - Spiral Groove Records"
- ✅ Email contains reset link
- ✅ Reset link is clickable and works
- ✅ Email mentions 1-hour expiration
- ✅ Make.com execution shows success

---

## Monitoring in Make.com

### Check Executions:
1. Go to Make.com dashboard
2. Click **"Operations"** → **"Executions"**
3. Look for recent executions
4. Click on an execution to see:
   - ✅ Execution status (green = success, red = error)
   - ✅ Data flow between modules
   - ✅ Error messages (if any)

### Check Webhook Data:
1. Click on the webhook module in an execution
2. Verify the data structure:
   ```json
   {
     "to": "test@example.com",
     "subject": "...",
     "html": "...",
     "text": "...",
     "emailType": "welcome|order-confirmation|order-status-update|password-reset",
     ...
   }
   ```

### Check Email Module:
1. Click on the Google Email module in an execution
2. Verify:
   - ✅ To field is mapped correctly
   - ✅ Subject is mapped correctly
   - ✅ Content is mapped correctly
   - ✅ Email was sent successfully

---

## Troubleshooting

### Email Not Arriving

1. **Check Make.com executions:**
   - Is the execution successful (green)?
   - Are there any error messages?

2. **Check spam folder:**
   - Emails might go to spam
   - Mark as "Not Spam" if found

3. **Check Gmail connection:**
   - Is the Google Email connection active?
   - Try re-authenticating the connection

4. **Check webhook URL:**
   - Verify `MAKE_WEBHOOK_URL` in `.env.local`
   - Make sure it matches your Make.com webhook URL

### Make.com Execution Failing

1. **Check webhook module:**
   - Is data being received?
   - Check the webhook data structure

2. **Check email module:**
   - Are fields mapped correctly?
   - Is the connection active?
   - Check for error messages

3. **Check field mappings:**
   - Verify `{{1.to}}`, `{{1.subject}}`, `{{1.html}}` are correct
   - Use Make.com's data mapper to verify field names

### Wrong Email Content

1. **Check email templates:**
   - Verify templates in `api/utils/email-templates.js`
   - Check that correct template is being used

2. **Check emailType:**
   - Verify `emailType` is being set correctly
   - Check webhook data to see what `emailType` is sent

---

## Quick Test Script

Create a test script to test all email types at once:

```bash
#!/bin/bash

WEBHOOK_URL="https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h"
TEST_EMAIL="your-test-email@example.com"

echo "Testing Welcome Email..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Welcome to Spiral Groove Records!\",
    \"html\": \"<h1>Welcome!</h1>\",
    \"text\": \"Welcome!\",
    \"emailType\": \"welcome\",
    \"customerName\": \"Test User\"
  }"

echo -e "\n\nTesting Order Confirmation..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Order Confirmation - ORD-TEST - Spiral Groove Records\",
    \"html\": \"<h1>Order Confirmed</h1>\",
    \"text\": \"Order Confirmed\",
    \"emailType\": \"order-confirmation\",
    \"orderNumber\": \"ORD-TEST\"
  }"

echo -e "\n\nTesting Order Status Update..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Order ORD-TEST - Ready - Spiral Groove Records\",
    \"html\": \"<h1>Order Ready</h1>\",
    \"text\": \"Order Ready\",
    \"emailType\": \"order-status-update\",
    \"orderNumber\": \"ORD-TEST\",
    \"status\": \"Ready\"
  }"

echo -e "\n\nTesting Password Reset..."
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"to\": \"$TEST_EMAIL\",
    \"subject\": \"Reset Your Password - Spiral Groove Records\",
    \"html\": \"<h1>Reset Password</h1>\",
    \"text\": \"Reset Password\",
    \"emailType\": \"password-reset\",
    \"resetUrl\": \"https://spiralgrooverecords.greychair.io/reset-password?token=test\"
  }"

echo -e "\n\nAll tests sent! Check your email inbox and Make.com executions."
```

Save as `test-emails.sh`, make executable (`chmod +x test-emails.sh`), and run it.

---

## Testing Checklist

Use this checklist to verify all email types are working:

- [ ] Welcome email sent on user signup
- [ ] Order confirmation email sent on payment approval
- [ ] Order status update email sent when status changes to "Ready"
- [ ] Order status update email sent when status changes to "Picked Up"
- [ ] Password reset email sent on password reset request
- [ ] All emails arrive in inbox (not spam)
- [ ] All emails have correct Spiral Groove Records branding
- [ ] All emails have correct subject lines
- [ ] All Make.com executions show success (green)
- [ ] All email links work correctly

---

## Next Steps

After testing:
1. ✅ Monitor Make.com executions regularly
2. ✅ Set up error notifications in Make.com
3. ✅ Test with real user accounts
4. ✅ Monitor email deliverability
5. ✅ Check spam rates

---

**Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

**Make.com Dashboard:** https://www.make.com/en/scenarios

