/**
 * Email Templates for Spiral Groove Records
 * 
 * All templates use the Spiral Groove Records branding
 */

/**
 * Base email template wrapper
 */
function getEmailBase(content) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <!-- Wrapper -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tbody>
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!-- Main Container -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; margin: 0 auto; background-color: #000000;">
                <tbody>
                  <!-- Header with Logo -->
                  <tr>
                    <td align="center" style="padding: 0 0 40px 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; line-height: 1.2;">
                        SPIRAL GROOVE<br>
                        <span style="color: #00B3A4;">RECORDS</span>
                      </h1>
                    </td>
                  </tr>

                  <!-- Gradient Accent Line -->
                  <tr>
                    <td align="center" style="padding: 0 0 30px 0;">
                      <div style="height: 3px; width: 100px; background: linear-gradient(90deg, #EC4899 0%, #A855F7 50%, #06B6D4 100%); border-radius: 2px; margin: 0 auto;"></div>
                    </td>
                  </tr>

                  ${content}

                  <!-- Visit Us Section -->
                  <tr>
                    <td style="padding: 30px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 20px;">
                        <tbody>
                          <tr>
                            <td align="center" style="padding: 0 0 15px 0;">
                              <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Visit Us</h3>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding: 0 0 10px 0;">
                              <p style="margin: 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
                                215B Main St<br>
                                Milford, OH 45150
                              </p>
                            </td>
                          </tr>
                          <tr>
                            <td align="center" style="padding: 0 0 10px 0;">
                              <a href="tel:+15136008018" style="color: #00B3A4; text-decoration: none; font-size: 16px;">(513) 600-8018</a>
                            </td>
                          </tr>
                          <tr>
                            <td align="center">
                              <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 14px; font-style: italic;">Open 12–9 PM daily</p>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <!-- Social Media Links -->
                  <tr>
                    <td align="center" style="padding: 30px 0 20px 0;">
                      <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">Follow us for updates:</p>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tbody>
                          <tr>
                            <td style="padding: 0 15px;">
                              <a href="https://www.facebook.com/spiralgrooverecords/" style="color: #00B3A4; text-decoration: none; font-size: 14px;">Facebook</a>
                            </td>
                            <td style="padding: 0 15px;">
                              <a href="https://www.instagram.com/spiral_groove_records_/?hl=en" style="color: #00B3A4; text-decoration: none; font-size: 14px;">Instagram</a>
                            </td>
                            <td style="padding: 0 15px;">
                              <a href="https://www.tiktok.com/@spiral_groove" style="color: #00B3A4; text-decoration: none; font-size: 14px;">TikTok</a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td align="center" style="padding: 30px 0 20px 0; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                      <p style="margin: 0 0 10px 0; color: rgba(255, 255, 255, 0.6); font-size: 14px; line-height: 1.6;">
                        You're receiving this email from<br>
                        <a href="https://spiralgrooverecords.com" style="color: #00B3A4; text-decoration: none;">spiralgrooverecords.com</a>
                      </p>
                      <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 12px;">
                        <a href="https://spiralgrooverecords.com/privacy" style="color: rgba(255, 255, 255, 0.5); text-decoration: underline;">Privacy Policy</a>
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * Welcome/Confirmation Email Template
 */
export function getWelcomeEmail({ firstName, lastName, email }) {
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : firstName || email.split('@')[0];
  
  const content = `
    <!-- Welcome Message -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; line-height: 1.4;">
          Welcome, ${firstName || fullName}!
        </h2>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          Thanks for joining us! We're thrilled to have you on board as we build something special.
        </p>
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          You'll be the first to know when our new website launches, plus you'll get exclusive updates on:
        </p>
        <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #ffffff; font-size: 16px; line-height: 1.8;">
          <li style="margin-bottom: 10px;">New arrivals and rare finds</li>
          <li style="margin-bottom: 10px;">Exclusive events and in-store performances</li>
          <li style="margin-bottom: 10px;">Special sales and promotions</li>
          <li style="margin-bottom: 10px;">Behind-the-scenes content</li>
        </ul>
      </td>
    </tr>
  `;

  return {
    html: getEmailBase(content),
    text: `Welcome to Spiral Groove Records!

Thanks for joining us! We're thrilled to have you on board.

You'll be the first to know when our new website launches, plus you'll get exclusive updates on:
- New arrivals and rare finds
- Exclusive events and in-store performances
- Special sales and promotions
- Behind-the-scenes content

Visit Us:
215B Main St
Milford, OH 45150
(513) 600-8018
Open 12–9 PM daily

Follow us:
Facebook: https://www.facebook.com/spiralgrooverecords/
Instagram: https://www.instagram.com/spiral_groove_records_/?hl=en
TikTok: https://www.tiktok.com/@spiral_groove

https://spiralgrooverecords.com`,
  };
}

/**
 * Order Confirmation Email Template
 */
export function getOrderConfirmationEmail({ orderNumber, customerName, customerEmail, items, subtotal, tax, total, orderDate, pickupDetails }) {
  const itemsList = items.map(item => 
    `  • ${item.name} (Qty: ${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}`
  ).join('\n');

  const content = `
    <!-- Order Confirmation Message -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; line-height: 1.4;">
          Order Confirmation
        </h2>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          Hi ${customerName},
        </p>
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          Thank you for your order! We've received your order and will begin processing it shortly.
        </p>
        <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
          Order Number: <span style="color: #00B3A4;">${orderNumber}</span>
        </p>
        <p style="margin: 0 0 20px 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
          Order Date: ${orderDate}
        </p>
      </td>
    </tr>

    <!-- Order Items -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <div style="background-color: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 18px; font-weight: 600;">Order Items</h3>
          ${items.map(item => `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
              <p style="margin: 0 0 5px 0; color: #ffffff; font-size: 16px; font-weight: 600;">${item.name}</p>
              <p style="margin: 0; color: rgba(255, 255, 255, 0.7); font-size: 14px;">
                Quantity: ${item.quantity} × $${item.price.toFixed(2)} = $${(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          `).join('')}
        </div>
      </td>
    </tr>

    <!-- Order Summary -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <div style="background-color: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 18px; font-weight: 600;">Order Summary</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: rgba(255, 255, 255, 0.7); font-size: 16px;">Subtotal:</span>
            <span style="color: #ffffff; font-size: 16px;">$${subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span style="color: rgba(255, 255, 255, 0.7); font-size: 16px;">Tax:</span>
            <span style="color: #ffffff; font-size: 16px;">$${tax.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding-top: 15px; border-top: 2px solid rgba(255, 255, 255, 0.2); margin-top: 10px;">
            <span style="color: #ffffff; font-size: 18px; font-weight: 600;">Total:</span>
            <span style="color: #00B3A4; font-size: 18px; font-weight: 600;">$${total.toFixed(2)}</span>
          </div>
        </div>
      </td>
    </tr>

    <!-- Pickup Information -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <div style="background-color: rgba(0, 179, 164, 0.1); border: 1px solid rgba(0, 179, 164, 0.3); border-radius: 8px; padding: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #00B3A4; font-size: 18px; font-weight: 600;">Pickup Information</h3>
          <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
            <strong>Store Location:</strong><br>
            215B Main St<br>
            Milford, OH 45150
          </p>
          <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
            <strong>Hours:</strong> Open 12–9 PM daily
          </p>
          <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
            <strong>Phone:</strong> <a href="tel:+15136008018" style="color: #00B3A4; text-decoration: none;">(513) 600-8018</a>
          </p>
          <p style="margin: 15px 0 0 0; color: rgba(255, 255, 255, 0.8); font-size: 14px; line-height: 1.6;">
            <strong>What to Bring:</strong><br>
            • Your Order ID: <strong>${orderNumber}</strong><br>
            • Valid Photo ID for verification
          </p>
        </div>
      </td>
    </tr>

    <!-- Next Steps -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px; font-weight: 600;">What's Next?</p>
        <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-size: 16px; line-height: 1.8;">
          <li style="margin-bottom: 10px;">We'll process your order within 1-2 business days</li>
          <li style="margin-bottom: 10px;">You'll receive an email notification when your order is ready for pickup</li>
          <li style="margin-bottom: 10px;">You can track your order status anytime in your account</li>
        </ul>
      </td>
    </tr>
  `;

  return {
    html: getEmailBase(content),
    text: `Order Confirmation - Spiral Groove Records

Hi ${customerName},

Thank you for your order! We've received your order and will begin processing it shortly.

Order Number: ${orderNumber}
Order Date: ${orderDate}

Order Items:
${itemsList}

Order Summary:
Subtotal: $${subtotal.toFixed(2)}
Tax: $${tax.toFixed(2)}
Total: $${total.toFixed(2)}

Pickup Information:
Store Location: 215B Main St, Milford, OH 45150
Hours: Open 12–9 PM daily
Phone: (513) 600-8018

What to Bring:
• Your Order ID: ${orderNumber}
• Valid Photo ID for verification

What's Next?
• We'll process your order within 1-2 business days
• You'll receive an email notification when your order is ready for pickup
• You can track your order status anytime in your account

Visit Us:
215B Main St
Milford, OH 45150
(513) 600-8018

https://spiralgrooverecords.com`,
  };
}

/**
 * Order Status Update Email Template
 */
export function getOrderStatusUpdateEmail({ orderNumber, customerName, status, statusMessage, items, orderUrl }) {
  const statusLabels = {
    'New': 'Order Received',
    'In Progress': 'Order Processing',
    'Ready': 'Ready for Pickup',
    'Picked Up': 'Order Picked Up',
    'Completed': 'Order Completed',
    'Canceled': 'Order Canceled',
    'Refunded': 'Order Refunded',
  };

  const statusColor = {
    'New': '#06B6D4',
    'In Progress': '#A855F7',
    'Ready': '#00B3A4',
    'Picked Up': '#00B3A4',
    'Completed': '#00B3A4',
    'Canceled': '#EF4444',
    'Refunded': '#F59E0B',
  }[status] || '#ffffff';

  const content = `
    <!-- Status Update Message -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; line-height: 1.4;">
          Order Status Update
        </h2>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          Hi ${customerName},
        </p>
        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
          Your order status has been updated:
        </p>
        <div style="background-color: rgba(255, 255, 255, 0.05); border-left: 4px solid ${statusColor}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0; color: ${statusColor}; font-size: 18px; font-weight: 600;">
            Order ${orderNumber}: ${statusLabels[status] || status}
          </p>
          ${statusMessage ? `<p style="margin: 0; color: rgba(255, 255, 255, 0.8); font-size: 16px; line-height: 1.6;">${statusMessage}</p>` : ''}
        </div>
      </td>
    </tr>

    ${status === 'Ready' ? `
    <!-- Ready for Pickup Notice -->
    <tr>
      <td style="padding: 0 0 30px 0;">
        <div style="background-color: rgba(0, 179, 164, 0.1); border: 1px solid rgba(0, 179, 164, 0.3); border-radius: 8px; padding: 20px;">
          <h3 style="margin: 0 0 15px 0; color: #00B3A4; font-size: 18px; font-weight: 600;">Your Order is Ready for Pickup!</h3>
          <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
            <strong>Store Location:</strong><br>
            215B Main St<br>
            Milford, OH 45150
          </p>
          <p style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px; line-height: 1.6;">
            <strong>Hours:</strong> Open 12–9 PM daily
          </p>
          <p style="margin: 15px 0 0 0; color: rgba(255, 255, 255, 0.8); font-size: 14px; line-height: 1.6;">
            <strong>What to Bring:</strong><br>
            • Your Order ID: <strong>${orderNumber}</strong><br>
            • Valid Photo ID for verification
          </p>
        </div>
      </td>
    </tr>
    ` : ''}

    ${orderUrl ? `
    <!-- View Order Button -->
    <tr>
      <td align="center" style="padding: 0 0 30px 0;">
        <a href="${orderUrl}" style="display: inline-block; background: linear-gradient(90deg, #EC4899 0%, #A855F7 50%, #06B6D4 100%); color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
          View Order Details
        </a>
      </td>
    </tr>
    ` : ''}
  `;

  return {
    html: getEmailBase(content),
    text: `Order Status Update - Spiral Groove Records

Hi ${customerName},

Your order status has been updated:

Order ${orderNumber}: ${statusLabels[status] || status}
${statusMessage ? statusMessage : ''}

${status === 'Ready' ? `
Your Order is Ready for Pickup!

Store Location:
215B Main St
Milford, OH 45150

Hours: Open 12–9 PM daily

What to Bring:
• Your Order ID: ${orderNumber}
• Valid Photo ID for verification
` : ''}

${orderUrl ? `View Order Details: ${orderUrl}` : ''}

Visit Us:
215B Main St
Milford, OH 45150
(513) 600-8018

https://spiralgrooverecords.com`,
  };
}

