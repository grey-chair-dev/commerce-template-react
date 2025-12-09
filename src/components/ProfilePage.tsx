import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import type { Product } from '../dataAdapter'

type ProfilePageProps = {
  user?: { id: string; email: string; firstName?: string; lastName?: string } | null
  isLoading?: boolean
  cartCount?: number
  wishlistCount?: number
  wishlistFeatureEnabled?: boolean
  products?: Product[]
  productsLoading?: boolean
  productsError?: Error | null
  orderTrackingEnabled?: boolean
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


export function ProfilePage({
  user,
  isLoading = false,
  cartCount = 0,
  wishlistCount = 0,
  wishlistFeatureEnabled = false,
  products = [],
  productsLoading = false,
  productsError = null,
  orderTrackingEnabled = false,
  onSignOut = () => {},
  onAccount = () => {},
  onCart = () => {},
  onWishlist = () => {},
  onSearch = () => {},
  onProductSelect = () => {},
  onTrackOrder = () => {},
  onContactUs = () => {},
  onAboutUs = () => {},
  onShippingReturns = () => {},
  onPrivacyPolicy = () => {},
  onTermsOfService = () => {},
}: ProfilePageProps) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  })
  const [originalEmail, setOriginalEmail] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    password: '',
    confirmText: '',
  })
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [showDeleteAccountSection, setShowDeleteAccountSection] = useState(false)

  // Load profile data
  useEffect(() => {
    if (!user?.id) {
      navigate('/login')
      return
    }

    const fetchProfile = async () => {
      try {
        setIsLoadingProfile(true)
        const response = await fetch('/api/user/profile', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.customer) {
            setProfile({
              firstName: data.customer.firstName || '',
              lastName: data.customer.lastName || '',
              email: data.customer.email || '',
              phone: data.customer.phone || '',
            })
            setOriginalEmail(data.customer.email || '')
          }
        } else {
          setError('Failed to load profile')
        }
      } catch (err) {
        console.error('[Profile] Error loading profile:', err)
        setError('Failed to load profile')
      } finally {
        setIsLoadingProfile(false)
      }
    }

    fetchProfile()
  }, [user, navigate])


  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setIsSavingProfile(true)

    try {
      // Check if email changed - for now, we'll allow it but could add verification later
      const emailChanged = profile.email !== originalEmail

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(emailChanged 
          ? 'Profile updated successfully! Please check your new email for verification.' 
          : 'Profile updated successfully!')
        setOriginalEmail(profile.email)
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError(data.message || 'Failed to update profile')
      }
    } catch (err) {
      console.error('[Profile] Error updating profile:', err)
      setError('Failed to update profile. Please try again.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validate passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    // Validate password requirements
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setPasswordSuccess('Password changed successfully!')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        setShowPasswordSection(false)
        setTimeout(() => setPasswordSuccess(null), 3000)
      } else {
        setPasswordError(data.message || data.details?.[0] || 'Failed to change password')
      }
    } catch (err) {
      console.error('[Profile] Error changing password:', err)
      setPasswordError('Failed to change password. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (deleteAccountForm.confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion')
      return
    }

    if (!deleteAccountForm.password) {
      setError('Please enter your password to confirm account deletion')
      return
    }

    if (!window.confirm('Are you sure you want to delete your account? This action cannot be undone. Your order history will be anonymized.')) {
      return
    }

    setIsDeletingAccount(true)
    setError(null)

    try {
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: deleteAccountForm.password,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Account deleted - sign out and redirect
        await onSignOut()
        navigate('/')
        alert('Your account has been deleted successfully.')
      } else {
        setError(data.message || 'Failed to delete account')
      }
    } catch (err) {
      console.error('[Profile] Error deleting account:', err)
      setError('Failed to delete account. Please try again.')
    } finally {
      setIsDeletingAccount(false)
    }
  }



  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-surface text-white">
        <Header
          user={user}
          isLoading={isLoading}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          wishlistFeatureEnabled={wishlistFeatureEnabled}
          products={products}
          onSignIn={() => navigate('/login')}
          onSignOut={onSignOut}
          onAccount={onAccount}
          onCart={onCart}
          onWishlist={onWishlist}
          onSearch={onSearch}
          onProductSelect={onProductSelect}
        />
        <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 pt-40 pb-8 sm:px-6 sm:pt-48 lg:px-8 lg:pt-56">
          <p className="text-slate-400">Loading profile...</p>
        </div>
        <Footer
          orderTrackingEnabled={orderTrackingEnabled}
          onTrackOrder={onTrackOrder}
          onContactUs={onContactUs}
          onAboutUs={onAboutUs}
          onShippingReturns={onShippingReturns}
          onPrivacyPolicy={onPrivacyPolicy}
          onTermsOfService={onTermsOfService}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface text-white">
      <Header
        user={user}
        isLoading={isLoading}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        wishlistFeatureEnabled={wishlistFeatureEnabled}
        products={products}
        onSignIn={() => navigate('/login')}
        onSignOut={onSignOut}
        onAccount={onAccount}
        onCart={onCart}
        onWishlist={onWishlist}
        onSearch={onSearch}
        onProductSelect={onProductSelect}
      />
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 pt-24 pb-8 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">My Profile</h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage your account information, security, and view your order history
            </p>
          </div>
          <button
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
            onClick={() => navigate('/')}
          >
            Back
          </button>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-400">
            {success}
          </div>
        )}

        <div className="space-y-8">
          {/* Account Management Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Account Management</h2>

            {/* Personal Information */}
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="mb-4 text-xl font-semibold">Personal Information</h3>
                <p className="mb-4 text-sm text-slate-400">
                  Used for pickup verification and order correspondence
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-slate-300">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-slate-300">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      required
                    />
                    {profile.email !== originalEmail && (
                      <p className="mt-1 text-xs text-yellow-400">
                        Warning: Email changed. Please check your new email for verification.
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-300">
                      Phone Number <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      placeholder="(513) 600-8018"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Used for local communication if there are issues with your order
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>

            {/* Security Section */}
            <div className="space-y-6">
              {/* Change Password */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Change Password</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Update your account password securely
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordSection(!showPasswordSection)
                      setPasswordError(null)
                      setPasswordSuccess(null)
                    }}
                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
                  >
                    {showPasswordSection ? 'Cancel' : 'Change Password'}
                  </button>
                </div>

                {showPasswordSection && (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    {passwordError && (
                      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                        {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-400">
                        {passwordSuccess}
                      </div>
                    )}

                    <div>
                      <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-slate-300">
                        Current Password *
                      </label>
                      <input
                        type="password"
                        id="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-slate-300">
                        New Password *
                      </label>
                      <input
                        type="password"
                        id="newPassword"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required
                        minLength={8}
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        Must be at least 8 characters with uppercase, lowercase, and number
                      </p>
                    </div>

                    <div>
                      <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-300">
                        Confirm New Password *
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                        required
                        minLength={8}
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="w-full rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Delete Account */}
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-red-400">Delete Account</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Permanently delete your account and anonymize your order data (GDPR compliant)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteAccountSection(!showDeleteAccountSection)
                      setError(null)
                    }}
                    className="rounded-full border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:border-red-500/80"
                  >
                    {showDeleteAccountSection ? 'Cancel' : 'Delete Account'}
                  </button>
                </div>

                {showDeleteAccountSection && (
                  <form onSubmit={handleDeleteAccount} className="space-y-4">
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-300">
                      <p className="font-semibold mb-2">Warning: This action cannot be undone!</p>
                      <p className="mb-2">Deleting your account will:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Permanently delete your account and personal information</li>
                        <li>Anonymize your past order data (orders will be kept for business records)</li>
                        <li>Remove access to your order history</li>
                      </ul>
                    </div>

                    <div>
                      <label htmlFor="deletePassword" className="mb-2 block text-sm font-medium text-slate-300">
                        Enter Your Password *
                      </label>
                      <input
                        type="password"
                        id="deletePassword"
                        value={deleteAccountForm.password}
                        onChange={(e) => setDeleteAccountForm({ ...deleteAccountForm, password: e.target.value })}
                        className="w-full rounded-lg border border-red-500/50 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="confirmDelete" className="mb-2 block text-sm font-medium text-slate-300">
                        Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm *
                      </label>
                      <input
                        type="text"
                        id="confirmDelete"
                        value={deleteAccountForm.confirmText}
                        onChange={(e) => setDeleteAccountForm({ ...deleteAccountForm, confirmText: e.target.value })}
                        className="w-full rounded-lg border border-red-500/50 bg-white/5 px-4 py-2 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none font-mono"
                        placeholder="DELETE"
                        required
                      />
                    </div>

                    <div>
                      <button
                        type="submit"
                        disabled={isDeletingAccount || deleteAccountForm.confirmText !== 'DELETE'}
                        className="w-full rounded-full border-2 border-red-500 bg-red-500/20 px-6 py-3 font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeletingAccount ? 'Deleting Account...' : 'Permanently Delete Account'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {/* Link to Order History */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-xl font-semibold">Order History</h2>
            <p className="mb-4 text-sm text-slate-400">
              View and track all your past pickup orders
            </p>
            <button
              onClick={() => navigate('/orders')}
              className="w-full rounded-full bg-primary px-6 py-3 font-semibold text-white shadow-brand hover:bg-primary/80"
            >
              View All Orders
            </button>
          </div>
        </div>
      </div>
      <Footer
        orderTrackingEnabled={orderTrackingEnabled}
        onTrackOrder={onTrackOrder}
        onContactUs={onContactUs}
        onAboutUs={onAboutUs}
        onShippingReturns={onShippingReturns}
        onPrivacyPolicy={onPrivacyPolicy}
        onTermsOfService={onTermsOfService}
      />
    </div>
  )
}
