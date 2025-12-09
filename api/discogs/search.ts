/**
 * Discogs Search API Endpoint
 * 
 * Search Discogs for releases matching a product name
 * 
 * GET /api/discogs/search?productName={name}
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { searchDiscogsReleases } from '../../src/services/discogsAdapter.js'
import { isDiscogsEnabled } from '../utils/featureFlags.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check feature flag - if disabled, return immediately
  if (!isDiscogsEnabled()) {
    return res.status(503).json({
      error: 'Discogs feature is disabled',
      message: 'The Discogs feature is currently disabled. Set FEATURE_FLAG_DISCOGS_ENABLED=true to enable.',
    })
  }

  const productName = req.query.productName as string

  if (!productName) {
    return res.status(400).json({ error: 'productName query parameter is required' })
  }

  const userToken = process.env.DISCOGS_USER_TOKEN
  const userAgent = process.env.DISCOGS_USER_AGENT || 'SpiralGroove/1.0'

  if (!userToken) {
    return res.status(500).json({
      error: 'Discogs credentials not configured',
      message: 'Please set DISCOGS_USER_TOKEN in environment variables',
    })
  }

  try {
    const results = await searchDiscogsReleases(productName, {
      userToken,
      userAgent,
    })

    return res.status(200).json({
      success: true,
      results,
      count: results.length,
    })
  } catch (error: any) {
    console.error('[Discogs Search] Error:', error)
    return res.status(500).json({
      error: 'Failed to search Discogs',
      message: error.message,
    })
  }
}

