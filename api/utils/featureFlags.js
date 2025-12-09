/**
 * Feature Flags Utility
 * 
 * Centralized feature flag management for backend API endpoints.
 * All feature flags are controlled via environment variables.
 * 
 * Usage:
 *   const { isDiscogsEnabled } = require('./utils/featureFlags')
 *   if (!isDiscogsEnabled()) {
 *     return res.status(503).json({ error: 'Discogs feature is disabled' })
 *   }
 */

/**
 * Check if Discogs functionality is enabled
 * 
 * @returns {boolean} true if FEATURE_FLAG_DISCOGS_ENABLED is set to 'true', false otherwise
 */
function isDiscogsEnabled() {
  const flag = process.env.FEATURE_FLAG_DISCOGS_ENABLED
  // Default to false if not set
  return flag === 'true' || flag === '1'
}

module.exports = {
  isDiscogsEnabled,
}
