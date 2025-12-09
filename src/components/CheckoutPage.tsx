import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckoutAccountPage } from './CheckoutAccountPage'
import { CheckoutContactPage } from './CheckoutContactPage'
import { CheckoutReviewPage } from './CheckoutReviewPage'
import { SpinningRecord } from './SpinningRecord'
import type { Product } from '../dataAdapter'
import type { ContactForm } from '../utils/checkoutPayload'
import type { User } from '@neondatabase/neon-auth'

type CheckoutPageProps = {
  cartItems: Array<Product & { quantity: number }>
  contactForm: ContactForm | null
  cartSubtotal: number
  estimatedTax: number
  user?: User | null
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  orderTrackingEnabled?: boolean
  onSetContactForm: (form: ContactForm) => void
  onComplete: (payload?: any) => void
  onCancel: () => void
  onSignIn: () => void
  onSignUp: () => void
  onSignOut?: () => void
  onAccount?: () => void
  onCart?: () => void
  onWishlist?: () => void
  onSearch?: () => void
  onProductSelect?: (product: Product) => void
  onTrackOrder?: () => void
  onContactUs?: () => void
  onAboutUs?: () => void
  onShippingReturns?: () => void
  onPrivacyPolicy?: () => void
  onTermsOfService?: () => void
}

export function CheckoutPage({
  cartItems,
  contactForm,
  cartSubtotal,
  estimatedTax,
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  orderTrackingEnabled = false,
  onSetContactForm,
  onComplete,
  onCancel,
  onSignIn,
  onSignUp,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onSearch,
  onProductSelect,
  onTrackOrder,
  onContactUs,
  onAboutUs,
  onShippingReturns,
  onPrivacyPolicy,
  onTermsOfService,
}: CheckoutPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const step = searchParams.get('step') || 'account'
  const redirectingRef = useRef(false)
  const hasSetContactFormRef = useRef(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevStepRef = useRef(step)

  // Redirect to account step if cart is empty
  useEffect(() => {
    if (cartItems.length === 0 && step !== 'account' && !redirectingRef.current) {
      redirectingRef.current = true
      setIsTransitioning(true)
      navigate('/checkout?step=account', { replace: true })
      setTimeout(() => {
        redirectingRef.current = false
      }, 300)
    }
  }, [cartItems.length, step, navigate])

  // If user is logged in and on account step, redirect to review
  useEffect(() => {
    if (user && !isLoading && step === 'account' && !redirectingRef.current) {
      redirectingRef.current = true
      hasSetContactFormRef.current = true
      setIsTransitioning(true)
      // Pre-fill contact form with user data
      const contactFormData = {
        email: user.email || '',
        firstName: user.user_metadata?.firstName || '',
        lastName: user.user_metadata?.lastName || '',
        phone: user.phone || '',
      }
      onSetContactForm(contactFormData)
      // Small delay to ensure contact form state is updated
      setTimeout(() => {
        navigate('/checkout?step=review', { replace: true })
        setTimeout(() => {
          redirectingRef.current = false
        }, 300)
      }, 100)
    }
  }, [user, isLoading, step, navigate, onSetContactForm])

  // Reset hasSetContactFormRef when step changes away from account
  useEffect(() => {
    if (step !== 'account') {
      hasSetContactFormRef.current = false
    }
  }, [step])

  // Track step transitions for loading state
  useEffect(() => {
    if (prevStepRef.current !== step) {
      setIsTransitioning(true)
      prevStepRef.current = step
      // Hide loading after a short delay to allow component to render
      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [step])

  // If review step but no contact form, redirect to account
  // BUT: Don't redirect if we just set the contact form for a logged-in user
  useEffect(() => {
    if (step === 'review' && !contactForm && !redirectingRef.current) {
      // If user is logged in and we just set the contact form, wait longer
      if (user && !isLoading && hasSetContactFormRef.current) {
        const timer = setTimeout(() => {
          // If contact form still not set after delay, redirect to account
          if (!contactForm && !redirectingRef.current) {
            redirectingRef.current = true
            hasSetContactFormRef.current = false
            setIsTransitioning(true)
            navigate('/checkout?step=account', { replace: true })
            setTimeout(() => {
              redirectingRef.current = false
            }, 300)
          }
        }, 300)
        return () => clearTimeout(timer)
      } else if (!user || isLoading) {
        // Guest user or still loading - redirect immediately
        redirectingRef.current = true
        setIsTransitioning(true)
        navigate('/checkout?step=account', { replace: true })
        setTimeout(() => {
          redirectingRef.current = false
        }, 300)
      }
    }
  }, [step, contactForm, navigate, user, isLoading])

  // Default: redirect to account for invalid steps
  useEffect(() => {
    if (step !== 'account' && step !== 'contact' && step !== 'review') {
      navigate('/checkout?step=account', { replace: true })
    }
  }, [step, navigate])

  // Handle step navigation
  const goToStep = (newStep: 'account' | 'contact' | 'review') => {
    setIsTransitioning(true)
    navigate(`/checkout?step=${newStep}`)
  }

  // Render appropriate step
  if (step === 'account') {
    return (
      <CheckoutAccountPage
        cartSubtotal={cartSubtotal}
        estimatedTax={estimatedTax}
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        orderTrackingEnabled={orderTrackingEnabled}
        onContinueAsGuest={() => goToStep('contact')}
        onRedirectToReview={async () => {
          if (user) {
            try {
              const { DataGateway } = await import('../services/DataGateway')
              const response = await DataGateway.getCurrentUser()
              if (!response.error && response.data) {
                const userData = response.data
                onSetContactForm({
                  email: userData.email,
                  firstName: userData.user_metadata?.firstName || '',
                  lastName: userData.user_metadata?.lastName || '',
                  phone: userData.phone || '',
                })
                goToStep('review')
              }
            } catch (error) {
              console.error('[CheckoutPage] Failed to fetch user data:', error)
            }
          }
        }}
        onSignIn={() => {
          sessionStorage.setItem('return_to_checkout', 'true')
          sessionStorage.setItem('return_to_checkout_step', 'review')
          onSignIn()
        }}
        onSignUp={() => {
          sessionStorage.setItem('return_to_checkout', 'true')
          sessionStorage.setItem('return_to_checkout_step', 'review')
          onSignUp()
        }}
        onCancel={onCancel}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    )
  }

  if (step === 'contact') {
    return (
      <CheckoutContactPage
        cartSubtotal={cartSubtotal}
        estimatedTax={estimatedTax}
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        orderTrackingEnabled={orderTrackingEnabled}
        onNext={(form) => {
          onSetContactForm(form)
          goToStep('review')
        }}
        onCancel={() => {
          goToStep('account')
          onSetContactForm(null)
        }}
        onSignIn={() => {
          sessionStorage.setItem('return_to_checkout', 'true')
          sessionStorage.setItem('return_to_checkout_step', 'review')
          onSignIn()
        }}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    )
  }

  if (step === 'review' && contactForm) {
    return (
      <CheckoutReviewPage
        cartItems={cartItems}
        contactForm={contactForm}
        paymentForm={null}
        cartSubtotal={cartSubtotal}
        estimatedTax={estimatedTax}
        customerId={user?.id || null}
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        orderTrackingEnabled={orderTrackingEnabled}
        onBack={() => {
          if (user) {
            goToStep('account')
          } else {
            goToStep('contact')
          }
        }}
        onComplete={onComplete}
        onCancel={onCancel}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    )
  }

  // If review step but no contact form, show nothing (redirect handled by useEffect above)
  if (step === 'review' && !contactForm) {
    return null
  }

  // Default: show nothing for invalid steps (redirect handled by useEffect above)
  if (step !== 'account' && step !== 'contact' && step !== 'review') {
    return null
  }
  
  return null
}

