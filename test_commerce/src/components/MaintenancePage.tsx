import { useState } from 'react'
import { siteConfig } from '../config'

type MaintenancePageProps = {
  reason?: string
  expectedReturn?: string
  onNotifyMe?: (email: string) => void
}

export function MaintenancePage({
  reason = 'We are currently performing scheduled maintenance to improve your experience.',
  expectedReturn,
  onNotifyMe,
}: MaintenancePageProps) {
  const [email, setEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (onNotifyMe && email.trim()) {
      onNotifyMe(email.trim())
      setIsSubscribed(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <div className="max-w-2xl space-y-8">
        {/* Maintenance Icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/20">
          <svg
            className="h-12 w-12 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">We'll Be Back Soon</h1>
          <p className="text-lg text-slate-300">{reason}</p>
        </div>

        {/* Expected Return Time */}
        {expectedReturn && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400">Expected return time</p>
            <p className="mt-2 text-xl font-semibold text-white">{expectedReturn}</p>
          </div>
        )}

        {/* Email Notification */}
        {onNotifyMe && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            {isSubscribed ? (
              <div className="space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
                  <svg
                    className="h-6 w-6 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-white">You're all set!</p>
                <p className="text-xs text-slate-300">
                  We'll notify you at <span className="font-semibold text-white">{email}</span> when
                  we're back online.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-300">
                  Enter your email to be notified when we're back online
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 rounded-full border border-white/20 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-brand hover:bg-primary/80"
                  >
                    Notify Me
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Contact Information */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="mb-4 text-sm font-semibold text-white">Need immediate assistance?</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 hover:border-white/40"
            >
              Email Us
            </a>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 hover:border-white/40"
            >
              Call Us
            </a>
          </div>
        </div>

        {/* Brand Info */}
        <div className="pt-4">
          <p className="text-xs text-slate-500">{siteConfig.brandName}</p>
        </div>
      </div>
    </div>
  )
}

