import { useState, useEffect } from 'react'
import { authenticateClient, verifyClientSession, isClientAuthRequired } from '../services/clientAuth'

type ClientLoginPageProps = {
  onAuthenticated: () => void
}

export function ClientLoginPage({ onAuthenticated }: ClientLoginPageProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      if (!isClientAuthRequired()) {
        // Client auth not required, allow access
        onAuthenticated()
        return
      }

      const isAuthenticated = await verifyClientSession()
      if (isAuthenticated) {
        // Already authenticated
        onAuthenticated()
      } else {
        setIsChecking(false)
      }
    }

    checkAuth()
  }, [onAuthenticated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await authenticateClient(password)
      
      if (result.success) {
        onAuthenticated()
      } else {
        setError(result.error || 'Authentication failed')
      }
    } catch (err) {
      setError('An error occurred during authentication')
      console.error('[ClientLogin] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface">
        <div className="text-white">Checking authentication...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-brand">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Spiral Groove</h1>
          <p className="mt-2 text-sm text-slate-400">Client Portal Access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter client password"
              className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-brand transition hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Authenticating...' : 'Access Portal'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Development access only
        </p>
      </div>
    </div>
  )
}

