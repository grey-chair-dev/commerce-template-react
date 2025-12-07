/**
 * Auth Provider Configuration
 * 
 * This file makes it easy to configure authentication providers.
 * Simply add your credentials to .env.local and they'll be automatically loaded.
 * 
 * To add a new provider:
 * 1. Add the provider config below
 * 2. Add the required env vars to .env.example
 * 3. Update the LoginPage/SignUpPage to show the new provider button
 */

export type AuthProvider = {
  id: string
  name: string
  icon?: React.ReactNode
  enabled: boolean
  credentials: {
    [key: string]: string | undefined
  }
}

export type AuthConfig = {
  providers: AuthProvider[]
  emailPasswordEnabled: boolean
}

/**
 * Get Neon Auth configuration from environment variables
 */
function getNeonAuthConfig(): AuthProvider {
  const env = import.meta.env as Record<string, string | undefined>
  const platformWindow = typeof window !== 'undefined' ? (window as any) : null

  const authUrl =
    env.VITE_NEON_AUTH_URL ??
    env.NEON_AUTH_URL ??
    platformWindow?.__neon_auth_url

  const projectId =
    env.VITE_STACK_PROJECT_ID ?? env.STACK_PROJECT_ID

  const publishableKey =
    env.VITE_STACK_PUBLISHABLE_CLIENT_KEY ??
    env.STACK_PUBLISHABLE_CLIENT_KEY

  return {
    id: 'neon',
    name: 'Neon Auth',
    enabled: !!authUrl && !!projectId && !!publishableKey,
    credentials: {
      authUrl,
      projectId,
      publishableKey,
    },
  }
}

/**
 * Get Supabase Auth configuration from environment variables
 */
function getSupabaseAuthConfig(): AuthProvider {
  const env = import.meta.env as Record<string, string | undefined>

  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY

  return {
    id: 'supabase',
    name: 'Supabase',
    enabled: !!url && !!anonKey,
    credentials: {
      url,
      anonKey,
    },
  }
}

/**
 * Get Auth0 configuration from environment variables
 */
function getAuth0Config(): AuthProvider {
  const env = import.meta.env as Record<string, string | undefined>

  const domain = env.VITE_AUTH0_DOMAIN
  const clientId = env.VITE_AUTH0_CLIENT_ID

  return {
    id: 'auth0',
    name: 'Auth0',
    enabled: !!domain && !!clientId,
    credentials: {
      domain,
      clientId,
    },
  }
}

/**
 * Get Clerk configuration from environment variables
 */
function getClerkConfig(): AuthProvider {
  const env = import.meta.env as Record<string, string | undefined>

  const publishableKey = env.VITE_CLERK_PUBLISHABLE_KEY

  return {
    id: 'clerk',
    name: 'Clerk',
    enabled: !!publishableKey,
    credentials: {
      publishableKey,
    },
  }
}

/**
 * Get Firebase Auth configuration from environment variables
 */
function getFirebaseConfig(): AuthProvider {
  const env = import.meta.env as Record<string, string | undefined>

  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID

  return {
    id: 'firebase',
    name: 'Firebase',
    enabled: !!apiKey && !!authDomain && !!projectId,
    credentials: {
      apiKey,
      authDomain,
      projectId,
    },
  }
}

/**
 * Get OAuth provider availability
 * OAuth providers are disabled - only email/password authentication is used
 */
function getOAuthProviders(): AuthProvider[] {
  // OAuth is disabled - only email/password authentication is available
  return []
}

/**
 * Get email/password auth configuration
 */
function getEmailPasswordConfig(): boolean {
  const env = import.meta.env as Record<string, string | undefined>
  
  // Email/password is enabled by default unless explicitly disabled
  return env.VITE_EMAIL_PASSWORD_ENABLED !== 'false'
}

/**
 * Main auth configuration
 * Automatically detects which providers are configured and enabled
 */
export function getAuthConfig(): AuthConfig {
  const authProviders: AuthProvider[] = []
  
  // Add main auth service providers
  const neon = getNeonAuthConfig()
  if (neon.enabled) {
    authProviders.push(neon)
  }

  const supabase = getSupabaseAuthConfig()
  if (supabase.enabled) {
    authProviders.push(supabase)
  }

  const auth0 = getAuth0Config()
  if (auth0.enabled) {
    authProviders.push(auth0)
  }

  const clerk = getClerkConfig()
  if (clerk.enabled) {
    authProviders.push(clerk)
  }

  const firebase = getFirebaseConfig()
  if (firebase.enabled) {
    authProviders.push(firebase)
  }

  // OAuth providers are disabled - only email/password authentication is used

  return {
    providers: authProviders,
    emailPasswordEnabled: getEmailPasswordConfig(),
  }
}

/**
 * Get the primary auth provider (first enabled provider)
 */
export function getPrimaryAuthProvider(): AuthProvider | null {
  const config = getAuthConfig()
  return config.providers.find((p) => p.id !== 'google' && p.id !== 'github' && p.id !== 'apple' && p.id !== 'microsoft') || null
}

/**
 * Get OAuth providers only
 * Returns empty array - OAuth is disabled
 */
export function getOAuthProvidersOnly(): AuthProvider[] {
  return []
}

