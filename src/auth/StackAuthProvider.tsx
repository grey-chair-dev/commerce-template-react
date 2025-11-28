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
      // Only warn in development mode to reduce console noise
      if (import.meta.env.DEV) {
        console.warn(
          '[StackAuthProvider] Missing VITE_NEON_AUTH_URL. Falling back to local session.',
        )
      }
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

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!authClient) {
        if (!cancelled) {
          setUser(createLocalDevUser(initialToken))
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
  }, [authClient, initialToken])

  const handleSignIn = useCallback(
    async (provider = 'google') => {
      if (!authClient) {
        if (import.meta.env.DEV) {
          console.warn('[StackAuthProvider] signInWithOAuth skipped; no auth client')
        }
        return
      }

      await authClient.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: window.location.origin,
        },
      })
    },
    [authClient],
  )

  const handleSignOut = useCallback(async () => {
    if (!authClient) {
      setUser(createLocalDevUser(''))
      return
    }
    await authClient.signOut()
  }, [authClient])

  const value: StackAuthContextValue = {
    user,
    isLoading,
    signInWithOAuth: handleSignIn,
    signOut: handleSignOut,
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

