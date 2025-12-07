/**
 * Checkout Payload Assembly
 * Assembles the checkout data payload for order processing
 */

import type { CartItem } from '../App'

// Contact form for pickup-only orders
export type ContactForm = {
  email: string
  firstName: string
  lastName: string
  phone: string
  pickupLocation?: string
}

export type CheckoutPayload = {
  customer_id: string | null
  items: Array<{
    sku: string
    quantity: number
  }>
  customer_details: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  totals: {
    subtotal: number
    shipping: number // Always 0 for pickup
    tax: number
    total: number
  }
}

/**
 * Assembles checkout payload from cart items, contact form, and user data
 * Simplified for pickup-only orders - only collects name, email, and phone
 * @param cartItems - Array of cart items with product details and quantities
 * @param contactForm - Contact form data (name, email, phone)
 * @param cartSubtotal - Cart subtotal before tax
 * @param estimatedTax - Estimated tax amount
 * @param customerId - Signed-in customer ID (from user.id), or null if guest checkout
 * @returns Complete checkout payload ready for order processing
 */
export function assembleCheckoutPayload(
  cartItems: CartItem[],
  contactForm: ContactForm,
  cartSubtotal: number,
  estimatedTax: number,
  customerId: string | null = null,
): CheckoutPayload {
  // Assemble items array with SKU and quantity
  // Note: Using product.id as SKU (this is the square_variation_id from the database)
  const items = cartItems.map((item) => ({
    sku: item.id, // Product ID serves as SKU
    quantity: item.quantity,
  }))

  // Assemble customer details (pickup-only - no address needed)
  const customer_details = {
    firstName: contactForm.firstName,
    lastName: contactForm.lastName,
    email: contactForm.email,
    phone: contactForm.phone || '',
  }

  // Calculate totals (no shipping cost for pickup)
  const total = cartSubtotal + estimatedTax

  return {
    customer_id: customerId,
    items,
    customer_details,
    totals: {
      subtotal: cartSubtotal,
      shipping: 0, // Always 0 for pickup orders
      tax: estimatedTax,
      total,
    },
  }
}

