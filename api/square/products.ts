/**
 * Vercel Serverless Function Example
 * 
 * This is an example API route that uses the Square SDK to fetch products.
 * 
 * To use this:
 * 1. Deploy to Vercel (or similar platform that supports serverless functions)
 * 2. Add your Square credentials to Vercel environment variables
 * 3. Update VITE_PRODUCTS_SNAPSHOT_URL in .env.local to point to this endpoint
 * 
 * Example: VITE_PRODUCTS_SNAPSHOT_URL=https://your-app.vercel.app/api/square/products
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchSquareProducts, type SquareConfig } from '../../src/services/squareAdapter.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get appId from query or use default
  const appId = (req.query.appId as string) || 'spiralgroove'

  // Get Square credentials from environment variables
  const accessToken = process.env.SQUARE_ACCESS_TOKEN
  const environment = (process.env.SQUARE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
  const locationId = process.env.SQUARE_LOCATION_ID

  if (!accessToken) {
    return res.status(500).json({ 
      error: 'Square access token not configured',
      message: 'Please set SQUARE_ACCESS_TOKEN in your environment variables'
    })
  }

  if (!locationId) {
    return res.status(500).json({ 
      error: 'Square location ID not configured',
      message: 'Please set SQUARE_LOCATION_ID in your environment variables'
    })
  }

  try {
    const config: SquareConfig = {
      accessToken,
      environment,
      locationId,
    }

    // Fetch products from Square
    const products = await fetchSquareProducts(config)

    // Return products in the format expected by the app
    return res.status(200).json({
      products,
      appId,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Square API] Error fetching products:', error)
    return res.status(500).json({
      error: 'Failed to fetch products from Square',
      message: error.message || 'Unknown error',
    })
  }
}

