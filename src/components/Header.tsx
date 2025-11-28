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
  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Promo Bar */}
      {featureFlags.enablePromoBar && siteConfig.promoBar?.enabled && (
        <div className="bg-primary/90 text-center py-2 text-xs text-white">
          <p className="font-semibold">{siteConfig.promoBar.message}</p>
        </div>
      )}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-surface/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col px-6">
        {/* Top row - Branding and User actions */}
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          {/* Branding */}
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Powered by Square · Neon · Upstash
                </p>
                <h1 className="text-2xl font-semibold text-text">{siteConfig.brandName}</h1>
                <p className="text-sm text-slate-300">{siteConfig.tagline}</p>
              </div>
            </Link>
          </div>

          {/* Right side - User info and actions */}
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:gap-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Bar */}
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
                className="w-48 rounded-full border border-white/20 bg-white/5 px-4 py-2 pr-10 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none md:w-64"
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
                onSelect={handleProductSelect}
                onClose={() => setDropdownOpen(false)}
              />
            </div>

            {/* Wishlist */}
            {wishlistFeatureEnabled && (
              <button
                className="relative rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
                onClick={onWishlist}
              >
                Wishlist
                {wishlistCount > 0 ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-surface">
                    {wishlistCount}
                  </span>
                ) : null}
              </button>
            )}

            {/* Cart */}
            <button
              className="relative rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:border-white/40"
              onClick={onCart}
            >
              Cart
              {cartCount > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-surface">
                  {cartCount}
                </span>
              ) : null}
            </button>

            {/* Auth */}
            {user ? (
              <>
                <button
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:border-white/40"
                  onClick={onAccount}
                >
                  Account
                </button>
                <button
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200 hover:border-white/40"
                  onClick={onSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                className="rounded-full bg-primary px-4 py-2 text-sm text-white shadow-brand"
                onClick={() => {
                  onSignIn()
                  navigate('/login')
                }}
              >
                {isLoading ? 'Checking session…' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Navigation Menu - Below the line */}
        <nav className="flex items-center gap-6 border-t border-white/10 py-3">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              isActive('/') ? 'text-primary' : 'text-slate-300 hover:text-white'
            }`}
          >
            Home
          </Link>
          <Link
            to="/catalog"
            className={`text-sm font-medium transition-colors ${
              isActive('/catalog') ? 'text-primary' : 'text-slate-300 hover:text-white'
            }`}
          >
            Catalog
          </Link>
          <Link
            to="/about"
            className={`text-sm font-medium transition-colors ${
              isActive('/about') ? 'text-primary' : 'text-slate-300 hover:text-white'
            }`}
          >
            About
          </Link>
          <Link
            to="/contact"
            className={`text-sm font-medium transition-colors ${
              isActive('/contact') ? 'text-primary' : 'text-slate-300 hover:text-white'
            }`}
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
    </>
  )
}

