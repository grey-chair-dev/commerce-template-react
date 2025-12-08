/**
 * Discogs Fetch API Endpoint
 * 
 * Fetch release details and tracklist from Discogs and store in database
 * 
 * POST /api/discogs/fetch
 * Body: { productId: string, releaseId?: number }
 */

// Vercel serverless function types
type VercelRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  body?: any
  query?: Record<string, string | string[] | undefined>
}
type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (data: any) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}
import { getDiscogsRelease, extractTracklist, matchProductToDiscogs } from '../../src/services/discogsAdapter.js'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { productId, releaseId, productName } = req.body

  if (!productId && !productName) {
    return res.status(400).json({ error: 'productId or productName is required' })
  }

  const userToken = process.env.DISCOGS_USER_TOKEN
  const userAgent = process.env.DISCOGS_USER_AGENT || 'SpiralGroove/1.0'
  const databaseUrl = process.env.DATABASE_URL

  if (!userToken) {
    return res.status(500).json({
      error: 'Discogs credentials not configured',
      message: 'Please set DISCOGS_USER_TOKEN in environment variables',
    })
  }

  if (!databaseUrl) {
    return res.status(500).json({
      error: 'Database not configured',
      message: 'Please set DATABASE_URL in environment variables',
    })
  }

  try {
    const sql = neon(databaseUrl)
    let finalReleaseId = releaseId

    // If no releaseId provided, search for it
    if (!finalReleaseId && productName) {
      const matchedId = await matchProductToDiscogs(productName, {
        userToken,
        userAgent,
      })

      if (!matchedId) {
        return res.status(404).json({
          error: 'No matching Discogs release found',
          message: `Could not find a Discogs release for: ${productName}`,
        })
      }

      finalReleaseId = matchedId
    }

    if (!finalReleaseId) {
      return res.status(400).json({
        error: 'releaseId is required',
        message: 'Either provide releaseId or productName to search',
      })
    }

    // Fetch release from Discogs
    console.log(`[Discogs Fetch] Fetching release ${finalReleaseId}`)
    const release = await getDiscogsRelease(finalReleaseId, {
      userToken,
      userAgent,
    })

    const tracklist = extractTracklist(release)

    // Store in Product_Detail table (only if productId is provided and valid)
    if (productId && productId !== 'TEST_PRODUCT_ID') {
      try {
        await sql`
          INSERT INTO "Product_Detail" (
            square_item_id,
            tracklist,
            discogs_release_id,
            discogs_year,
            discogs_label,
            discogs_updated_at,
            updated_at
          )
          VALUES (
            ${productId},
            ${JSON.stringify(tracklist)}::jsonb,
            ${finalReleaseId},
            ${release.year || null},
            ${release.labels?.[0]?.name || null},
            NOW(),
            NOW()
          )
          ON CONFLICT (square_item_id)
          DO UPDATE SET
            tracklist = ${JSON.stringify(tracklist)}::jsonb,
            discogs_release_id = ${finalReleaseId},
            discogs_year = ${release.year || null},
            discogs_label = ${release.labels?.[0]?.name || null},
            discogs_updated_at = NOW(),
            updated_at = NOW()
        `
        console.log(`[Discogs Fetch] Stored tracklist for product ${productId}`)
      } catch (error: any) {
        // If foreign key constraint fails, just log and continue
        // This allows testing without requiring the product to exist in Square_Item
        if (error.message?.includes('foreign key') || error.message?.includes('violates foreign key')) {
          console.warn(`[Discogs Fetch] Could not store tracklist: product ${productId} does not exist in Square_Item table`)
          console.warn(`[Discogs Fetch] Returning tracklist without storing (for testing purposes)`)
        } else {
          throw error
        }
      }
    } else {
      console.log(`[Discogs Fetch] Skipping database storage (test mode or no productId)`)
    }

    return res.status(200).json({
      success: true,
      release: {
        id: release.id,
        title: release.title,
        year: release.year,
        label: release.labels?.[0]?.name,
      },
      tracklist,
      trackCount: tracklist.length,
    })
  } catch (error: any) {
    console.error('[Discogs Fetch] Error:', error)
    return res.status(500).json({
      error: 'Failed to fetch Discogs data',
      message: error.message,
    })
  }
}

