import {
  type ReactNode,
  createContext,
  useContext,
  useState,
} from 'react'
import type { Product } from '../dataAdapter'

type UIContextValue = {
  isSearchOpen: boolean
  quickViewProduct: Product | null
  pdpProduct: Product | null
  isDashboardOpen: boolean
  authPage: 'login' | 'signup' | 'forgot-password' | null
  showCookieBanner: boolean
  setSearchOpen: (open: boolean) => void
  setQuickViewProduct: (product: Product | null) => void
  setPdpProduct: (product: Product | null) => void
  setDashboardOpen: (open: boolean) => void
  setAuthPage: (page: 'login' | 'signup' | 'forgot-password' | null) => void
  setShowCookieBanner: (show: boolean) => void
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [isSearchOpen, setSearchOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [pdpProduct, setPdpProduct] = useState<Product | null>(null)
  const [isDashboardOpen, setDashboardOpen] = useState(false)
  const [authPage, setAuthPage] = useState<'login' | 'signup' | 'forgot-password' | null>(null)
  const [showCookieBanner, setShowCookieBanner] = useState(false)

  const value: UIContextValue = {
    isSearchOpen,
    quickViewProduct,
    pdpProduct,
    isDashboardOpen,
    authPage,
    showCookieBanner,
    setSearchOpen,
    setQuickViewProduct,
    setPdpProduct,
    setDashboardOpen,
    setAuthPage,
    setShowCookieBanner,
  }

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext)
  if (!context) {
    throw new Error('useUI must be used within UIProvider')
  }
  return context
}
