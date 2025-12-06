/**
 * Music Product Detection
 * 
 * Determines if a product is a music-related item (album, CD, vinyl, etc.)
 * that should be queried in Discogs
 */

import { RecordFormat } from '../types/productEnums.js'

/**
 * Check if a product is music-related
 */
export function isMusicProduct(product: {
  name: string
  description?: string
  category?: string
  format?: string | RecordFormat
}): boolean {
  const name = (product.name || '').toLowerCase()
  const description = (product.description || '').toLowerCase()
  const category = (product.category || '').toLowerCase()
  const format = (product.format || '').toLowerCase()

  // Check format - music formats
  const musicFormats = [
    'lp', '12"', '7"', '10"', 'cd', 'cassette', 'vinyl', 'record',
    'single', 'ep', 'album'
  ]
  
  if (format && musicFormats.some(f => format.includes(f))) {
    return true
  }

  // Check category - exclude non-music categories
  const nonMusicCategories = [
    't-shirt', 'shirt', 'poster', 'book', 'puzzle', 'turntable',
    'receiver', 'speakers', 'cleaner', 'crates', 'sleeves', 'dvd',
    'misc', 'equipment', 'accessories', 'merchandise'
  ]
  
  if (category && nonMusicCategories.some(c => category.includes(c))) {
    return false
  }

  // Check name patterns - exclude non-music items
  const nonMusicPatterns = [
    /t-shirt/i,
    /shirt/i,
    /poster/i,
    /book/i,
    /puzzle/i,
    /turntable/i,
    /receiver/i,
    /speakers/i,
    /cleaner/i,
    /crates/i,
    /sleeves/i,
    /dvd/i,
    /equipment/i,
    /accessories/i,
  ]
  
  if (nonMusicPatterns.some(pattern => pattern.test(name))) {
    return false
  }

  // Check for music patterns - artist - album format
  // Common pattern: "Artist - Album" or "Artist - Album [Format]"
  const musicPattern = /^[^-]+ - [^-]+/i
  if (musicPattern.test(name)) {
    // Additional check: make sure it's not "1 - 33" or similar
    if (!/^\d+\s*-\s*\d+/.test(name)) {
      return true
    }
  }

  // Check description for music-related keywords
  const musicKeywords = [
    'album', 'release', 'vinyl', 'record', 'lp', 'cd', 'cassette',
    'track', 'song', 'artist', 'band', 'label', 'release date'
  ]
  
  if (description && musicKeywords.some(keyword => description.includes(keyword))) {
    return true
  }

  // If category is a music genre, it's likely music
  const musicGenres = [
    'rock', 'jazz', 'blues', 'hip-hop', 'rap', 'r&b', 'soul', 'funk',
    'electronic', 'house', 'techno', 'dance', 'pop', 'country', 'folk',
    'classical', 'soundtrack', 'metal', 'punk', 'indie', 'alternative'
  ]
  
  if (category && musicGenres.some(genre => category.includes(genre))) {
    return true
  }

  // Default: if we can't determine, assume it's NOT music to avoid unnecessary API calls
  return false
}

/**
 * Check if product already has Discogs data
 */
export function hasDiscogsData(product: {
  discogsReleaseId?: number | null
  tracklist?: any[] | null
}): boolean {
  return !!(product.discogsReleaseId || (product.tracklist && product.tracklist.length > 0))
}

