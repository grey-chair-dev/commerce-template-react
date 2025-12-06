/**
 * Discogs API Rate Limiter
 * 
 * Discogs API rate limits:
 * - 60 requests per minute for authenticated users
 * - We'll use a conservative 50 requests per minute to be safe
 */

type QueuedRequest = {
  resolve: (value: any) => void
  reject: (error: any) => void
  fn: () => Promise<any>
}

class DiscogsRateLimiter {
  private queue: QueuedRequest[] = []
  private processing = false
  private requestsPerMinute = 50 // Conservative limit (Discogs allows 60)
  private requestInterval = 60000 / this.requestsPerMinute // ~1200ms between requests
  private lastRequestTime = 0

  /**
   * Execute a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ resolve, reject, fn })
      this.processQueue()
    })
  }

  /**
   * Process the queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const request = this.queue.shift()!
      
      try {
        // Wait if needed to respect rate limit
        const now = Date.now()
        const timeSinceLastRequest = now - this.lastRequestTime
        
        if (timeSinceLastRequest < this.requestInterval) {
          const waitTime = this.requestInterval - timeSinceLastRequest
          await this.sleep(waitTime)
        }

        // Execute the request
        this.lastRequestTime = Date.now()
        const result = await request.fn()
        request.resolve(result)
      } catch (error) {
        request.reject(error)
      }
    }

    this.processing = false
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = []
  }
}

// Singleton instance
export const discogsRateLimiter = new DiscogsRateLimiter()

