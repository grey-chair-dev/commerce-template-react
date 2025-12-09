import {
  type ReactNode,
  createContext,
  useContext,
  useState,
} from 'react'
import type { CartItem } from './CartContext'

type ContactForm = {
  email: string
  firstName: string
  lastName: string
  phone: string
}

type OrderConfirmation = {
  orderNumber: string
  cartItems: CartItem[]
  contactForm: ContactForm
  cartSubtotal: number
  estimatedTax: number
}

type PaymentError = {
  code: string
  message: string
}

type CheckoutContextValue = {
  checkoutStep: 'account' | 'contact' | 'review' | null
  contactForm: ContactForm | null
  orderConfirmation: OrderConfirmation | null
  paymentError: PaymentError | null
  orderStatusView: OrderConfirmation | null
  isProcessing: boolean
  setCheckoutStep: (step: 'account' | 'contact' | 'review' | null) => void
  setContactForm: (form: ContactForm | null) => void
  setOrderConfirmation: (confirmation: OrderConfirmation | null) => void
  setPaymentError: (error: PaymentError | null) => void
  setOrderStatusView: (view: OrderConfirmation | null) => void
  setIsProcessing: (processing: boolean) => void
}

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined)

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [checkoutStep, setCheckoutStep] = useState<'account' | 'contact' | 'review' | null>(null)
  const [contactForm, setContactForm] = useState<ContactForm | null>(null)
  const [orderConfirmation, setOrderConfirmation] = useState<OrderConfirmation | null>(null)
  const [paymentError, setPaymentError] = useState<PaymentError | null>(null)
  const [orderStatusView, setOrderStatusView] = useState<OrderConfirmation | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const value: CheckoutContextValue = {
    checkoutStep,
    contactForm,
    orderConfirmation,
    paymentError,
    orderStatusView,
    isProcessing,
    setCheckoutStep,
    setContactForm,
    setOrderConfirmation,
    setPaymentError,
    setOrderStatusView,
    setIsProcessing,
  }

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>
}

export function useCheckout(): CheckoutContextValue {
  const context = useContext(CheckoutContext)
  if (!context) {
    throw new Error('useCheckout must be used within CheckoutProvider')
  }
  return context
}
