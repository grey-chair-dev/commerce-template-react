# Make.com Email Webhook Setup Guide

This guide will walk you through setting up Make.com to handle password reset emails for Spiral Groove Records.

## Prerequisites

- Make.com account (free tier works)
- Email service provider account (SendGrid, Mailgun, Resend, etc.)
- Your Make.com webhook URL: `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

## Step 1: Create a New Scenario

1. Log in to [Make.com](https://www.make.com)
2. Click **"Create a new scenario"**
3. Name it: **"Spiral Groove - Password Reset Emails"**

## Step 2: Add Webhook Module (Trigger)

1. Click **"Add a module"** or the **"+"** button
2. Search for **"Webhooks"** → Select **"Custom webhook"**
3. Click **"Add"**
4. Choose **"Instant"** (for real-time processing)
5. Click **"Save"** to create the webhook
6. **Copy the webhook URL** - it should match: `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`
7. Click **"OK"**

## Step 3: Test the Webhook (Optional)

1. Click **"Run once"** to test the webhook
2. Make.com will show you a sample payload structure
3. You can use this to see what data structure to expect

## Step 4: Add Email Module

Choose one of the following email services:

### Option A: SendGrid (Recommended)

1. Click **"Add a module"** after the webhook
2. Search for **"SendGrid"** → Select **"Send an email"**
3. Click **"Add"**
4. **First time setup:**
   - Click **"Create a connection"**
   - Enter your SendGrid API Key
   - Click **"Save"**
5. **Configure the email:**
   - **From email:** `noreply@spiralgrooverecords.com` (or your verified domain)
   - **From name:** `Spiral Groove Records`
   - **To:** Click the mapping icon → Select `to` from webhook data
   - **Subject:** Click mapping → Select `subject` from webhook data
   - **HTML content:** Click mapping → Select `html` from webhook data
   - **Plain text content:** Click mapping → Select `text` from webhook data
6. Click **"OK"**

### Option B: Mailgun

1. Click **"Add a module"** after the webhook
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

1. Click **"Add a module"** after the webhook
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

### Option D: Generic SMTP (Gmail, Outlook, etc.)

1. Click **"Add a module"** after the webhook
2. Search for **"Email"** → Select **"Send an email"**
3. Click **"Add"**
4. **First time setup:**
   - Click **"Create a connection"**
   - Enter your SMTP settings:
     - **Server:** `smtp.gmail.com` (or your SMTP server)
     - **Port:** `587` (or `465` for SSL)
     - **Username:** Your email address
     - **Password:** Your email password or app password
   - Click **"Save"**
5. **Configure the email:**
   - **From:** `noreply@spiralgrooverecords.com`
   - **To:** Map `to` from webhook
   - **Subject:** Map `subject` from webhook
   - **HTML:** Map `html` from webhook
   - **Text:** Map `text` from webhook
6. Click **"OK"**

## Step 5: Data Mapping

When mapping fields from the webhook to the email module, you'll see a data structure like this:

```json
{
  "to": "customer@example.com",
  "subject": "Reset Your Password - Spiral Groove Records",
  "html": "<!DOCTYPE html>...",
  "text": "SPIRAL GROOVE RECORDS...",
  "customerName": "John",
  "resetUrl": "https://spiralgrooverecords.com/reset-password?token=...",
  "emailType": "password-reset"
}
```

**Map these fields:**
- `to` → Email "To" field
- `subject` → Email "Subject" field
- `html` → Email "HTML content" field
- `text` → Email "Plain text content" field

The other fields (`customerName`, `resetUrl`, `emailType`) are available if you need them for conditional logic or additional processing.

## Step 6: Error Handling (Optional but Recommended)

1. Add an **"Error handler"** module after the email module
2. Configure it to:
   - Log errors to a file/database
   - Send you a notification if email fails
   - Or retry the email

## Step 7: Activate the Scenario

1. Click the **"Toggle"** switch at the bottom to activate the scenario
2. The scenario will now listen for webhook requests
3. Status should show **"Active"** (green)

## Step 8: Test the Integration

1. Go to your application
2. Navigate to the "Forgot Password" page
3. Enter a test email address
4. Submit the form
5. Check Make.com:
   - Go to **"Operations"** → **"Executions"**
   - You should see a new execution with status **"Success"** (green)
6. Check the email inbox for the password reset email

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
   - Password reset emails sometimes go to spam
   - Verify sender domain is authenticated

### Data Mapping Issues

1. **Check webhook data structure:**
   - Run the scenario once manually
   - Check the webhook module output
   - Verify field names match what you're mapping

2. **Use Make.com's data mapper:**
   - Click the mapping icon (📋) next to each field
   - Select the correct field from the webhook data
   - Make.com will show available fields

## Advanced: Multiple Email Types

If you want to handle different email types (password reset, welcome, order confirmation, etc.):

1. Add a **"Router"** module after the webhook
2. Add conditions based on `emailType`:
   - Route 1: `emailType` = `"password-reset"` → Password reset email template
   - Route 2: `emailType` = `"welcome"` → Welcome email template
   - Route 3: `emailType` = `"order-confirmation"` → Order confirmation template

## Best Practices

1. **Monitor executions:** Regularly check Make.com executions for errors
2. **Set up alerts:** Configure Make.com to notify you of failures
3. **Test regularly:** Test the webhook after code deployments
4. **Keep webhook URL secure:** Don't commit `.env.local` to git
5. **Use verified domains:** Authenticate your sending domain for better deliverability

## Next Steps

Once Make.com is set up:

1. ✅ Test password reset flow end-to-end
2. ✅ Verify emails are being delivered
3. ✅ Check spam folder if emails aren't arriving
4. ✅ Monitor Make.com executions for any issues
5. ✅ Set up additional email types (welcome, order confirmation, etc.) as needed

## Support

- **Make.com Documentation:** https://www.make.com/en/help
- **Make.com Community:** https://community.make.com
- **Webhook Testing:** Use tools like Postman or curl to test the webhook directly

---

**Webhook URL:** `https://hook.us2.make.com/u6a3bje1oeo8j5ttpsms7adiy3pggz9h`

**Environment Variable:** `MAKE_WEBHOOK_URL` in `.env.local`


