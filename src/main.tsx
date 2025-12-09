import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './globals.css'
import App from './App.tsx'
import { StackAuthProvider } from './auth/StackAuthProvider.tsx'
import { ProductsProvider } from './contexts/ProductsContext.tsx'
import { CartProvider } from './contexts/CartContext.tsx'
import { WishlistProvider } from './contexts/WishlistContext.tsx'
import { CheckoutProvider } from './contexts/CheckoutContext.tsx'
import { UIProvider } from './contexts/UIContext.tsx'
import { useProducts } from './contexts/ProductsContext.tsx'

// Wrapper component to provide products to CartProvider
// This must be inside ProductsProvider to use useProducts hook
function AppWithProviders() {
  const { products } = useProducts()
  
  return (
    <CartProvider products={products}>
      <WishlistProvider>
        <CheckoutProvider>
          <UIProvider>
            <App />
          </UIProvider>
        </CheckoutProvider>
      </WishlistProvider>
    </CartProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StackAuthProvider>
        <ProductsProvider>
          <AppWithProviders />
        </ProductsProvider>
      </StackAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
