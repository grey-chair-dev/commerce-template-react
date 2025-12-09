import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  createAuthClient,
  SupabaseAuthAdapter,
  type User,
} from '@neondatabase/neon-auth'

type PlatformWindow = Window & {
  __initial_auth_token?: string
  __app_id?: string
  __neon_auth_url?: string
}

type StackAuthContextValue = {
  user: User | null
  isLoading: boolean
  signInWithOAuth: (provider?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const StackAuthContext = createContext<StackAuthContextValue | undefined>(undefined)

const buildAuthHeaders = (
  projectId: string | undefined,
  publishableKey: string | undefined,
  token: string,
) => {
  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (projectId) {
    headers['x-stack-project-id'] = projectId
  }

  if (publishableKey) {
    headers['x-stack-publishable-key'] = publishableKey
  }

  return headers
}

export const StackAuthProvider = ({ children }: { children: ReactNode }) => {
  const envVars = import.meta.env as Record<string, string | undefined>
  const platformWindow =
    typeof window === 'undefined' ? null : (window as PlatformWindow)

  const authUrl =
    envVars.VITE_NEON_AUTH_URL ??
    envVars.NEON_AUTH_URL ??
    platformWindow?.__neon_auth_url
  const projectId =
    envVars.VITE_STACK_PROJECT_ID ?? envVars.STACK_PROJECT_ID ?? undefined
  const publishableKey =
    envVars.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
    envVars.STACK_PUBLISHABLE_CLIENT_KEY ??
    undefined
  const initialToken = platformWindow?.__initial_auth_token ?? ''

  const authClient = useMemo(() => {
    if (!authUrl) {
      // OAuth is optional - email/password auth works without it
      // Only log in verbose mode if needed for debugging
      // if (import.meta.env.DEV && import.meta.env.VITE_VERBOSE_AUTH_LOGS === 'true') {
      //   console.log('[StackAuthProvider] OAuth not configured. Using email/password auth only.')
      // }
      return null
    }

    return createAuthClient(authUrl, {
      adapter: SupabaseAuthAdapter({
        fetchOptions: {
          headers: buildAuthHeaders(projectId, publishableKey, initialToken),
        },
      }),
    })
  }, [authUrl, projectId, publishableKey, initialToken])

  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Extract bootstrap logic to a reusable function
  const checkEmailPasswordAuth = useCallback(async () => {
    try {
      // Note: 401 is expected for unauthenticated users - this is not an error
      const { DataGateway } = await import('../services/DataGateway')
      const response = await DataGateway.getCurrentUser()

      if (response.error) {
        // Not authenticated (401 is expected for guest users - not an error)
        // The browser console may show this as an error, but it's normal behavior
        if (process.env.NODE_ENV === 'development' && import.meta.env.VITE_VERBOSE_AUTH_LOGS === 'true') {
          console.log('[StackAuthProvider] Email/password auth check: NOT AUTHENTICATED - This is normal for guest users')
        }
        setUser(createLocalDevUser(initialToken))
        return false
      }

      if (response.data) {
        console.log('[StackAuthProvider] Email/password auth check: SUCCESS', response.data.email)
        setUser(response.data)
        return true
      }

      // No user data
      setUser(createLocalDevUser(initialToken))
      return false
    } catch (error) {
      console.error('[StackAuthProvider] Failed to check email/password auth:', error)
      setUser(createLocalDevUser(initialToken))
      return false
    }
  }, [initialToken])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!authClient) {
        // No OAuth client - check email/password authentication
        if (!cancelled) {
          await checkEmailPasswordAuth()
          setIsLoading(false)
        }
        return
      }

      try {
        const { data, error } = await authClient.getSession()
        if (!cancelled) {
          if (error) {
            console.error('[StackAuthProvider] getSession error', error)
          }
          setUser(data.session?.user ?? null)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('[StackAuthProvider] Failed to bootstrap session', error)
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    bootstrap()

    if (!authClient) {
      return () => {
        cancelled = true
      }
    }

    const {
      data: { subscription },
    } = authClient.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [authClient, initialToken, checkEmailPasswordAuth])

  const handleRefreshAuth = useCallback(async () => {
    if (!authClient) {
      setIsLoading(true)
      await checkEmailPasswordAuth()
      setIsLoading(false)
    } else {
      // For OAuth, refresh the session
      try {
        const { data } = await authClient.getSession()
        setUser(data.session?.user ?? null)
      } catch (error) {
        console.error('[StackAuthProvider] Failed to refresh auth:', error)
      }
    }
  }, [authClient, checkEmailPasswordAuth])

  const handleSignIn = useCallback(
    async (provider?: string) => {
      // OAuth is disabled - this function is kept for API compatibility but does nothing
      console.warn('[StackAuthProvider] OAuth sign-in is disabled. Use email/password authentication instead.')
    },
    [],
  )

  const handleSignOut = useCallback(async () => {
    // Clear cart from localStorage when signing out
    try {
      const CART_STORAGE_KEY = 'lct_cart' // Match the key used in App.tsx
      localStorage.removeItem(CART_STORAGE_KEY)
      console.log('[StackAuthProvider] Cleared cart from localStorage on sign out')
    } catch (error) {
      console.error('[StackAuthProvider] Failed to clear cart:', error)
    }
    
    if (!authClient) {
      // For email/password auth, we need to clear the cookie
      // The cookie is HttpOnly, so we can't delete it from JS
      // Instead, we'll call a logout endpoint or just clear the local state
      // For now, just clear the user state
      setUser(null)
      
      // Optionally call a logout endpoint to clear the cookie server-side
      try {
        const { DataGateway } = await import('../services/DataGateway')
        await DataGateway.logout()
      } catch (error) {
        // Logout endpoint might not exist yet, that's okay
        console.log('[StackAuthProvider] Logout endpoint not available')
      }
      return
    }
    await authClient.signOut()
  }, [authClient])

  const value: StackAuthContextValue = {
    user,
    isLoading,
    signInWithOAuth: handleSignIn,
    signOut: handleSignOut,
    refreshAuth: handleRefreshAuth,
  }

  return <StackAuthContext.Provider value={value}>{children}</StackAuthContext.Provider>
}

export const useStackAuth = (): StackAuthContextValue => {
  const ctx = useContext(StackAuthContext)
  if (!ctx) {
    throw new Error('useStackAuth must be used within StackAuthProvider')
  }

  return ctx
}

export const useUser = () => {
  const { user, isLoading } = useStackAuth()
  return { user, isLoading }
}

function createLocalDevUser(token: string): User | null {
  if (!token) {
    return null
  }

  const now = new Date().toISOString()

  return {
    id: `dev-${token.slice(0, 8)}`,
    app_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: now,
    confirmed_at: now,
    created_at: now,
    email: 'dev@local.test',
    phone: '',
    factor_count: 0,
    identities: [],
    invited_at: now,
    last_sign_in_at: now,
    phone_change_sent_at: now,
    role: 'authenticated',
    updated_at: now,
    user_metadata: { displayName: 'Dev User' },
  } as User
}

