type MetricPayload = {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp: number
}

type ErrorPayload = {
  context: string
  message: string
  stack?: string
  timestamp: number
}

const errorEndpoint =
  import.meta.env.VITE_ERROR_WEBHOOK_URL ?? import.meta.env.ERROR_WEBHOOK_URL
const metricEndpoint =
  import.meta.env.VITE_METRICS_WEBHOOK_URL ?? import.meta.env.METRICS_WEBHOOK_URL

/**
 * Registers global listeners for runtime errors and unhandled rejections.
 * Returns a cleanup function to remove the listeners.
 */
export function initClientMonitors(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const handleError = (event: ErrorEvent) => {
    reportClientError(event.error ?? event.message ?? 'Unknown error', 'window.error')
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason ?? 'Unhandled rejection', 'unhandledrejection')
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  // Capture a basic TTI-style metric once the monitors are initialized.
  trackMetric('time_to_interactive_ms', Math.round(performance.now()))

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}

export function reportClientError(error: unknown, context = 'client'): void {
  if (!errorEndpoint || typeof navigator === 'undefined') {
    return
  }

  const payload: ErrorPayload = {
    context,
    message:
      typeof error === 'string'
        ? error
        : error instanceof Error
          ? error.message
          : JSON.stringify(error),
    stack: error instanceof Error ? error.stack ?? undefined : undefined,
    timestamp: Date.now(),
  }

  postJson(errorEndpoint, payload)
}

export function trackMetric(
  name: string,
  value: number,
  tags?: Record<string, string>,
): void {
  if (!metricEndpoint || typeof navigator === 'undefined') {
    return
  }

  const payload: MetricPayload = {
    name,
    value,
    tags,
    timestamp: Date.now(),
  }

  postJson(metricEndpoint, payload)
}

function postJson(url: string, payload: unknown) {
  const body = JSON.stringify(payload)
  const blob = new Blob([body], { type: 'application/json' })

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, blob)
    return
  }

  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch((error) => {
    console.error('[monitoring] Failed to send payload', error)
  })
}

