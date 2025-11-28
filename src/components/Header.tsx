import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { siteConfig, featureFlags } from '../config'
import { SearchDropdown } from './SearchDropdown'
import type { Product } from '../dataAdapter'

type HeaderProps = {
  user: any
  isLoading: boolean
  cartCount: number
  wishlistCount: number
  wishlistFeatureEnabled: boolean
  products: Product[]
  onSignIn: () => void
  onSignOut: () => void
  onAccount: () => void
  onCart: () => void
  onWishlist: () => void
  onSearch: () => void
  onProductSelect: (product: Product) => void
}

export function Header({
  user,
  isLoading,
  cartCount,
  wishlistCount,
  wishlistFeatureEnabled,
  products,
  onSignIn,
  onSignOut,
  onAccount,
  onCart,
  onWishlist,
  onSearch,
  onProductSelect,
}: HeaderProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setDropdownOpen(value.trim().length > 0)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onSearch()
      setDropdownOpen(false)
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      setSearchQuery('')
    }
  }

  const handleProductSelect = (product: Product) => {
    onProductSelect(product)
    setSearchQuery('')
    setDropdownOpen(false)
  }

  const location = useLocation()
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    // For sub-routes like /events/book, /events/past, highlight the parent
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 w-full">
      {/* Promo Bar */}
      {featureFlags.enablePromoBar && siteConfig.promoBar?.enabled && (
          <div className="bg-gradient-to-r from-primary/95 to-primary/90 text-center py-2.5 px-4 text-xs text-white shadow-md">
            <p className="font-semibold tracking-wide">{siteConfig.promoBar.message}</p>
        </div>
      )}
        <header className="w-full border-b border-white/10 bg-surface/80 backdrop-blur-md shadow-lg">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6">
          {/* Top row - Mobile first layout */}
          <div className="flex items-center justify-between gap-2 py-3 sm:gap-3 sm:py-3.5 md:py-4">
            {/* Branding - Mobile first: minimal, then expand */}
            <Link 
              to="/" 
              className="hover:opacity-90 transition-all duration-200 flex-shrink-0 min-w-0 group"
              onClick={(e) => {
                if (location.pathname === '/') {
                  e.preventDefault()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
            >
              <div className="min-w-0">
                <p className="hidden md:block text-xs uppercase tracking-[0.3em] text-slate-400/80 mb-0.5">
                  Powered by Square · Neon · Upstash
                </p>
                <h1 className="text-base font-bold text-white truncate sm:text-lg md:text-2xl group-hover:text-primary transition-colors">{siteConfig.brandName}</h1>
                <p className="hidden md:block text-xs sm:text-sm text-slate-300/90 mt-0.5">{siteConfig.tagline}</p>
              </div>
            </Link>

            {/* Search - Hidden on mobile (in menu), visible on tablet+ */}
            <div className="hidden sm:block sm:flex-none sm:max-w-xs md:max-w-none">
            <div ref={searchRef} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setDropdownOpen(true)
                  }
                }}
                placeholder="Search products..."
                  className="w-full rounded-full border border-white/20 bg-white/10 px-3 py-2 pr-9 text-sm text-white placeholder-slate-400 focus:border-primary focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all sm:w-40 md:w-48 lg:w-64 sm:px-4 sm:pr-10"
              />
              <svg
                  className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:right-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <SearchDropdown
                products={products}
                query={searchQuery}
                isOpen={isDropdownOpen}
                onSelect={handleProductSelect}
                onClose={() => setDropdownOpen(false)}
              />
              </div>
            </div>

            {/* Action Buttons - Mobile first: compact icons, then expand */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Mobile: Compact icon buttons */}
            {wishlistFeatureEnabled && (
                <button
                  onClick={onWishlist}
                  className="sm:hidden relative w-9 h-9 flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:border-primary/50 hover:bg-white/15 active:scale-95 transition-all"
                  aria-label="Wishlist"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {wishlistCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white shadow-lg">
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
                </button>
              )}

              <button
                onClick={onCart}
                className="sm:hidden relative w-9 h-9 flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:border-primary/50 hover:bg-white/15 active:scale-95 transition-all"
                aria-label="Cart"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-white shadow-lg">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>

              {/* Tablet/Desktop: Buttons with progressive enhancement */}
              {wishlistFeatureEnabled && (
                <button
                  className="hidden sm:flex relative items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-xs text-white hover:border-primary/50 hover:bg-white/15 min-h-[40px] md:gap-2 md:px-3 md:text-sm md:min-h-[44px] transition-all"
                  onClick={onWishlist}
                >
                  <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="hidden lg:inline">Wishlist</span>
                  {wishlistCount > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2">
                      {wishlistCount > 9 ? '9+' : wishlistCount}
                    </span>
                  )}
              </button>
            )}

            <button
                className="hidden sm:flex relative items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-xs text-white hover:border-primary/50 hover:bg-white/15 min-h-[40px] md:gap-2 md:px-3 md:text-sm md:min-h-[44px] transition-all"
              onClick={onCart}
            >
                <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="hidden lg:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md md:px-2">
                    {cartCount > 9 ? '9+' : cartCount}
                </span>
                )}
            </button>

              {/* Auth - Hidden on mobile (in menu), visible on tablet+ */}
            {user ? (
              <>
                  <button
                    className="hidden sm:flex rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-xs text-white hover:border-primary/50 hover:bg-white/15 min-h-[40px] md:px-3 md:text-sm md:min-h-[44px] transition-all"
                    onClick={onAccount}
                  >
                    <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="hidden lg:inline ml-1.5 md:ml-2">Account</span>
                  </button>
                  <button
                    className="hidden sm:flex rounded-full border border-white/20 bg-white/10 px-2.5 py-2 text-xs text-white hover:border-primary/50 hover:bg-white/15 min-h-[40px] md:px-3 md:text-sm md:min-h-[44px] transition-all"
                    onClick={onSignOut}
                  >
                    <span className="hidden md:inline">Sign out</span>
                    <span className="md:hidden">Out</span>
                  </button>
                </>
              ) : (
                <button
                  className="hidden sm:flex rounded-full bg-primary px-3 py-2 text-xs text-white shadow-lg hover:bg-primary/90 hover:shadow-xl min-h-[40px] md:px-4 md:text-sm md:min-h-[44px] transition-all font-semibold"
                  onClick={() => {
                    onSignIn()
                    navigate('/login')
                  }}
                >
                  {isLoading ? 'Checking…' : 'Sign in'}
                </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden w-9 h-9 flex items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:border-primary/50 hover:bg-white/15 active:scale-95 transition-all"
                aria-label="Menu"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 sm:hidden ${
              isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Menu Panel - Slide in from right */}
          <div className={`sm:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] z-[110] bg-black backdrop-blur-lg border-l border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}>
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-black backdrop-blur-lg border-b border-white/10 flex-shrink-0">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">Menu</h2>
                <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 hover:border-white/40"
                    aria-label="Close menu"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {/* Search in Menu */}
                <div ref={searchRef} className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => {
                      if (searchQuery.trim()) {
                        setDropdownOpen(true)
                      }
                    }}
                    placeholder="Search products..."
                    className="w-full rounded-full border border-white/20 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    autoFocus={false}
                  />
                  <svg
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <SearchDropdown
                    products={products}
                    query={searchQuery}
                    isOpen={isDropdownOpen}
                    onSelect={(product) => {
                      handleProductSelect(product)
                      setIsMobileMenuOpen(false)
                    }}
                    onClose={() => setDropdownOpen(false)}
                  />
                </div>
              </div>
            </div>
            
            {/* Navigation Links - Simple List */}
            <div className="flex-1 px-4 py-4 bg-black/80">
              <nav className="flex flex-col gap-1">
                <Link
                  to="/"
                  onClick={(e) => {
                    setIsMobileMenuOpen(false)
                    if (location.pathname === '/') {
                      e.preventDefault()
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Home
                </Link>
                <Link
                  to="/shop"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/shop') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Shop Records
                </Link>
                <Link
                  to="/events"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/events') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Events
                </Link>
                <Link
                  to="/editorial"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/editorial') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Editorial
                </Link>
                <Link
                  to="/about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/about') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  About
                </Link>
                <Link
                  to="/contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] flex items-center ${
                    isActive('/contact') ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Contact
                </Link>
              </nav>
              
              <div className="pt-4 border-t border-white/10 space-y-2 mt-4 bg-black/80 rounded-t-lg -mx-4 px-4 pb-4">
                {user ? (
                  <>
                    <button
                      onClick={() => {
                        onAccount()
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full px-4 py-3 rounded-lg text-base font-medium text-slate-200 hover:bg-white/5 min-h-[44px] text-left"
                    >
                      Account
                    </button>
                    <button
                      onClick={() => {
                        onSignOut()
                        setIsMobileMenuOpen(false)
                      }}
                      className="w-full px-4 py-3 rounded-lg text-base font-medium text-slate-200 hover:bg-white/5 min-h-[44px] text-left"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  onSignIn()
                  navigate('/login')
                      setIsMobileMenuOpen(false)
                }}
                    className="w-full px-4 py-3 rounded-lg text-base font-semibold bg-primary text-white shadow-brand hover:bg-primary/80 min-h-[44px]"
              >
                {isLoading ? 'Checking session…' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
        </div>

          {/* Desktop Navigation Menu - Hidden on mobile */}
          <nav className="hidden sm:flex items-center gap-1 border-t border-white/10 py-2.5 lg:py-3">
          <Link
            to="/"
            onClick={(e) => {
              if (location.pathname === '/') {
                e.preventDefault()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }
            }}
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Home
          </Link>
          <Link
            to="/shop"
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/shop') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Shop Records
          </Link>
          <Link
            to="/events"
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/events') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Events
          </Link>
          <Link
            to="/editorial"
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/editorial') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Editorial
          </Link>
          <Link
            to="/about"
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/about') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            About
          </Link>
          <Link
            to="/contact"
              className={`text-sm font-medium transition-all px-3 py-2 rounded-lg min-h-[44px] flex items-center ${
                isActive('/contact') 
                  ? 'text-primary bg-primary/10 font-semibold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
      </div>
    </>
  )
}

