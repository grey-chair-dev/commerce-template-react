import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './globals.css'
import App from './App.tsx'
import { StackAuthProvider } from './auth/StackAuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StackAuthProvider>
    <App />
      </StackAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
