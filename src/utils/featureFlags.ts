/**
 * Feature Flags Utility
 * 
 * Centralized feature flag management for frontend components.
 * All feature flags are controlled via environment variables.
 * 
 * Usage:
 *   import { useDiscogsEnabled } from '@/utils/featureFlags'
 *   const isDiscogsEnabled = useDiscogsEnabled()
 *   if (!isDiscogsEnabled) {
 *     return null // Don't render Discogs UI
 *   }
 */

/**
 * Check if Discogs functionality is enabled
 * 
 * Reads from VITE_FEATURE_FLAG_DISCOGS_ENABLED environment variable.
 * Defaults to false if not set.
 * 
 * @returns {boolean} true if VITE_FEATURE_FLAG_DISCOGS_ENABLED is set to 'true', false otherwise
 */
export function useDiscogsEnabled(): boolean {
  // In browser environment, read from import.meta.env
  if (typeof window !== 'undefined') {
    const flag = import.meta.env.VITE_FEATURE_FLAG_DISCOGS_ENABLED
    return flag === 'true' || flag === '1'
  }
  
  // Server-side or build-time: default to false
  return false
}

/**
 * Constant version for use outside React components
 * Use this in non-component code or when you need a synchronous check
 */
export const isDiscogsEnabled = (): boolean => {
  if (typeof window !== 'undefined') {
    const flag = import.meta.env.VITE_FEATURE_FLAG_DISCOGS_ENABLED
    return flag === 'true' || flag === '1'
  }
  return false
}
