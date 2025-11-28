import { useState } from 'react'
import { siteConfig } from '../config'

type ComingSoonPageProps = {
  message?: string
  expectedLaunch?: string
  onNotifyMe?: (email: string) => void
}

export function ComingSoonPage({
  message = "We're building something amazing! Stay tuned for our grand opening.",
  expectedLaunch,
  onNotifyMe,
}: ComingSoonPageProps) {
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
        {/* Coming Soon Icon */}
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">Coming Soon</h1>
          <p className="text-lg text-slate-300">{message}</p>
        </div>

        {/* Expected Launch Date */}
        {expectedLaunch && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-400">Expected launch date</p>
            <p className="mt-2 text-xl font-semibold text-white">{expectedLaunch}</p>
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
                <p className="text-sm font-semibold text-white">You're on the list!</p>
                <p className="text-xs text-slate-300">
                  We'll notify you at <span className="font-semibold text-white">{email}</span> when
                  we launch.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-300">
                  Be the first to know when we launch. Enter your email below.
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
          <p className="mb-4 text-sm font-semibold text-white">Have questions?</p>
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

