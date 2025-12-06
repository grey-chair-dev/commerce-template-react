/**
 * Checkout Payload Assembly
 * Assembles the checkout data payload for order processing
 */

import type { CartItem } from '../App'

export type ShippingForm = {
  deliveryMethod?: 'delivery' | 'pickup'
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  pickupLocation?: string
}

export type CheckoutPayload = {
  customer_id: string | null
  items: Array<{
    sku: string
    quantity: number
  }>
  shipping_details: {
    address: {
      firstName: string
      lastName: string
      email: string
      phone: string
      street: string
      city: string
      state: string
      zipCode: string
      country?: string
    }
    deliveryMethod: 'delivery' | 'pickup'
    cost: number
    pickupLocation?: string
  }
  totals: {
    subtotal: number
    shipping: number
    tax: number
    total: number
  }
}

/**
 * Assembles checkout payload from cart items, shipping form, and user data
 * @param cartItems - Array of cart items with product details and quantities
 * @param shippingForm - Shipping form data with address and delivery method
 * @param cartSubtotal - Cart subtotal before shipping and tax
 * @param estimatedShipping - Estimated shipping cost
 * @param estimatedTax - Estimated tax amount
 * @param customerId - Signed-in customer ID (from user.id), or null if guest checkout
 * @returns Complete checkout payload ready for order processing
 */
export function assembleCheckoutPayload(
  cartItems: CartItem[],
  shippingForm: ShippingForm,
  cartSubtotal: number,
  estimatedShipping: number,
  estimatedTax: number,
  customerId: string | null = null,
): CheckoutPayload {
  // Assemble items array with SKU and quantity
  // Note: Using product.id as SKU (this is the square_variation_id from the database)
  const items = cartItems.map((item) => ({
    sku: item.id, // Product ID serves as SKU
    quantity: item.quantity,
  }))

  // Assemble shipping details
  const shipping_details = {
    address: {
      firstName: shippingForm.firstName,
      lastName: shippingForm.lastName,
      email: shippingForm.email,
      phone: shippingForm.phone || '',
      street: shippingForm.address || '',
      city: shippingForm.city || '',
      state: shippingForm.state || '',
      zipCode: shippingForm.zipCode || '',
      country: 'US', // Default to US, can be made configurable
    },
    deliveryMethod: (shippingForm.deliveryMethod || 'delivery') as 'delivery' | 'pickup',
    cost: estimatedShipping,
    ...(shippingForm.pickupLocation && { pickupLocation: shippingForm.pickupLocation }),
  }

  // Calculate totals
  const total = cartSubtotal + estimatedShipping + estimatedTax

  return {
    customer_id: customerId,
    items,
    shipping_details,
    totals: {
      subtotal: cartSubtotal,
      shipping: estimatedShipping,
      tax: estimatedTax,
      total,
    },
  }
}

