# Discogs Feature Flag Implementation

## Overview

A global feature flag system has been implemented to enable or disable all Discogs-related functionality across both the API and Frontend. This allows the Discogs feature set to be developed, merged, and deployed to production while remaining disabled until ready for launch.

## Environment Variables

### Backend
- **`FEATURE_FLAG_DISCOGS_ENABLED`** (default: `false`)
  - Controls all backend Discogs API endpoints
  - Set to `'true'` or `'1'` to enable

### Frontend
- **`VITE_FEATURE_FLAG_DISCOGS_ENABLED`** (default: `false`)
  - Controls Discogs UI rendering in frontend components
  - Set to `'true'` or `'1'` to enable

## Implementation Details

### Backend

#### Feature Flag Utility
**File:** `api/utils/featureFlags.js`
- Centralized feature flag management for backend API endpoints
- Exports `isDiscogsEnabled()` function that checks `FEATURE_FLAG_DISCOGS_ENABLED`

#### Protected Endpoints

1. **`api/discogs/fetch.ts`**
   - Returns `503 Service Unavailable` if feature flag is disabled
   - Error message: "Discogs feature is disabled"

2. **`api/discogs/search.ts`**
   - Returns `503 Service Unavailable` if feature flag is disabled
   - Error message: "Discogs feature is disabled"

3. **`api/webhooks/square.ts`**
   - `processNewItemsForDiscogs()` function checks feature flag before processing
   - If disabled, logs message and returns early (does not fail webhook)

### Frontend

#### Feature Flag Utility
**File:** `src/utils/featureFlags.ts`
- Exports `useDiscogsEnabled()` hook for React components
- Exports `isDiscogsEnabled()` constant function for non-component code
- Reads from `VITE_FEATURE_FLAG_DISCOGS_ENABLED` environment variable

#### Protected Components

1. **`src/components/ProductDetailPage.tsx`**
   - Uses `useDiscogsEnabled()` hook to check feature flag
   - Conditionally renders Discogs tracklist section when:
     - Feature flag is enabled (`isDiscogsEnabled === true`)
     - Product has tracklist data (`product.tracklist && product.tracklist.length > 0`)
   - Tracklist is displayed in the Description tab as a separate section

## Usage

### Enabling Discogs Feature

1. **Backend (Vercel Environment Variables):**
   ```
   FEATURE_FLAG_DISCOGS_ENABLED=true
   ```

2. **Frontend (Vercel Environment Variables or `.env.local`):**
   ```
   VITE_FEATURE_FLAG_DISCOGS_ENABLED=true
   ```

3. **Local Development:**
   Add to `.env.local`:
   ```
   FEATURE_FLAG_DISCOGS_ENABLED=true
   VITE_FEATURE_FLAG_DISCOGS_ENABLED=true
   ```

### Disabling Discogs Feature

Simply set both variables to `false` or remove them (defaults to `false`):
```
FEATURE_FLAG_DISCOGS_ENABLED=false
VITE_FEATURE_FLAG_DISCOGS_ENABLED=false
```

## Behavior When Disabled

### Backend
- All Discogs API endpoints return `503 Service Unavailable` with a clear error message
- Webhook processing skips Discogs data fetching (webhook still succeeds)
- No Discogs API calls are made

### Frontend
- Discogs tracklist UI is not rendered
- Product detail page shows only core product information
- No Discogs-related UI elements are displayed

## Testing

### Test Disabled State (Default)
1. Ensure environment variables are not set or set to `false`
2. Call `/api/discogs/fetch` - should return `503`
3. Call `/api/discogs/search` - should return `503`
4. View product detail page - no tracklist section should appear

### Test Enabled State
1. Set `FEATURE_FLAG_DISCOGS_ENABLED=true` and `VITE_FEATURE_FLAG_DISCOGS_ENABLED=true`
2. Call `/api/discogs/fetch` - should work normally
3. Call `/api/discogs/search` - should work normally
4. View product detail page with tracklist data - tracklist section should appear

## Files Modified

### Created
- `api/utils/featureFlags.js` - Backend feature flag utility
- `src/utils/featureFlags.ts` - Frontend feature flag utility
- `DISCOGS_FEATURE_FLAG.md` - This documentation

### Modified
- `api/discogs/fetch.ts` - Added feature flag check
- `api/discogs/search.ts` - Added feature flag check
- `api/webhooks/square.ts` - Added feature flag check in `processNewItemsForDiscogs()`
- `src/components/ProductDetailPage.tsx` - Added feature flag check and conditional tracklist rendering
- `.env.example` - Added feature flag documentation

## Future Enhancements

When additional Discogs UI elements are added (e.g., admin dashboard settings, Discogs info panels), they should:
1. Import `useDiscogsEnabled()` or `isDiscogsEnabled()` from `src/utils/featureFlags.ts`
2. Conditionally render based on the flag value
3. Follow the same pattern established in `ProductDetailPage.tsx`
