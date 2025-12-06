/**
 * Discogs API Adapter
 * 
 * Fetches track listings and release information from Discogs API
 * https://www.discogs.com/developers
 */

export type DiscogsConfig = {
  userToken: string
  userAgent: string
}

export type DiscogsRelease = {
  id: number
  title: string
  year?: number
  artists?: Array<{ name: string }>
  labels?: Array<{ name: string }>
  tracklist?: DiscogsTrack[]
  thumb?: string
  cover_image?: string
}

export type DiscogsTrack = {
  position: string  // "A1", "B1", "1", etc.
  title: string
  duration?: string
  type_?: string  // "heading", "track", etc.
}

export type DiscogsSearchResult = {
  id: number
  title: string
  year?: number
  thumb?: string
  cover_image?: string
  resource_url: string
}

export type DiscogsSearchResponse = {
  results: DiscogsSearchResult[]
  pagination: {
    page: number
    pages: number
    per_page: number
    items: number
  }
}

const DISCOGS_API_BASE = 'https://api.discogs.com'

/**
 * Create Discogs API headers
 */
function getDiscogsHeaders(config: DiscogsConfig): HeadersInit {
  return {
    'User-Agent': config.userAgent,
    'Authorization': `Discogs token=${config.userToken}`,
    'Accept': 'application/json',
  }
}

/**
 * Search for releases on Discogs
 * 
 * @param query - Search query (e.g., "Abbey Road The Beatles")
 * @param config - Discogs configuration
 * @returns List of matching releases
 */
export async function searchDiscogsReleases(
  query: string,
  config: DiscogsConfig
): Promise<DiscogsSearchResult[]> {
  try {
    const url = new URL(`${DISCOGS_API_BASE}/database/search`)
    url.searchParams.set('q', query)
    url.searchParams.set('type', 'release')
    url.searchParams.set('per_page', '10')  // Limit results
    
    const response = await fetch(url.toString(), {
      headers: getDiscogsHeaders(config),
    })
    
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`)
    }
    
    const data: DiscogsSearchResponse = await response.json()
    return data.results || []
  } catch (error) {
    console.error('[DiscogsAdapter] Error searching releases:', error)
    throw error
  }
}

/**
 * Get release details including tracklist
 * 
 * @param releaseId - Discogs release ID
 * @param config - Discogs configuration
 * @returns Full release details with tracklist
 */
export async function getDiscogsRelease(
  releaseId: number,
  config: DiscogsConfig
): Promise<DiscogsRelease> {
  try {
    const url = `${DISCOGS_API_BASE}/releases/${releaseId}`
    
    const response = await fetch(url, {
      headers: getDiscogsHeaders(config),
    })
    
    if (!response.ok) {
      throw new Error(`Discogs API error: ${response.status} ${response.statusText}`)
    }
    
    const data: DiscogsRelease = await response.json()
    return data
  } catch (error) {
    console.error('[DiscogsAdapter] Error fetching release:', error)
    throw error
  }
}

/**
 * Extract tracklist from release
 * 
 * @param release - Discogs release object
 * @returns Array of tracks (filtered to only actual tracks, not headings)
 */
export function extractTracklist(release: DiscogsRelease): DiscogsTrack[] {
  if (!release.tracklist) {
    return []
  }
  
  // Filter out headings and only return actual tracks
  return release.tracklist.filter(
    (track) => track.type_ !== 'heading' && track.title && track.position
  )
}

/**
 * Match a Square product to a Discogs release
 * 
 * Strategy:
 * 1. Extract artist and album from product name
 * 2. Search Discogs
 * 3. Return best match (first result, or can be improved with fuzzy matching)
 * 
 * @param productName - Square product name (e.g., "Abbey Road - The Beatles")
 * @param config - Discogs configuration
 * @returns Best matching release ID, or null if no match
 */
export async function matchProductToDiscogs(
  productName: string,
  config: DiscogsConfig
): Promise<number | null> {
  try {
    // Clean up product name for search
    // Remove common suffixes like "- Vinyl", "- LP", etc.
    const cleanName = productName
      .replace(/\s*-\s*(Vinyl|LP|CD|Cassette|Record).*$/i, '')
      .trim()
    
    console.log(`[DiscogsAdapter] Searching for: "${cleanName}"`)
    
    const results = await searchDiscogsReleases(cleanName, config)
    
    if (results.length === 0) {
      console.log(`[DiscogsAdapter] No results found for: "${cleanName}"`)
      return null
    }
    
    // Return first result (can be improved with better matching logic)
    const bestMatch = results[0]
    console.log(`[DiscogsAdapter] Found match: "${bestMatch.title}" (ID: ${bestMatch.id})`)
    
    return bestMatch.id
  } catch (error) {
    console.error('[DiscogsAdapter] Error matching product:', error)
    return null
  }
}

/**
 * Get tracklist for a product
 * 
 * @param productName - Square product name
 * @param config - Discogs configuration
 * @returns Tracklist array, or null if not found
 */
export async function getTracklistForProduct(
  productName: string,
  config: DiscogsConfig
): Promise<DiscogsTrack[] | null> {
  try {
    const releaseId = await matchProductToDiscogs(productName, config)
    
    if (!releaseId) {
      return null
    }
    
    const release = await getDiscogsRelease(releaseId, config)
    const tracklist = extractTracklist(release)
    
    return tracklist
  } catch (error) {
    console.error('[DiscogsAdapter] Error getting tracklist:', error)
    return null
  }
}

