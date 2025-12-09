# Discogs API Timeout & Graceful Degradation Implementation

## Overview

The product detail endpoint (`/api/catalog/[productId]`) has been enhanced with strict timeout protection and graceful degradation for Discogs API calls. This ensures the application remains fast and fully functional even if the external Discogs API is slow, down, or rate-limiting.

## Key Features

### 1. Strict Timeout (500ms)
- All Discogs API calls have a maximum timeout of 500ms
- Implemented using `Promise.race()` between the Discogs request and a timeout promise
- If timeout occurs, the request is immediately cancelled and core product data is returned

### 2. Graceful Degradation
- If Discogs API fails, times out, or returns non-200 status:
  - Core product data is still returned immediately
  - Discogs fields (`tracklist`, `discogs_release_id`, etc.) are simply omitted
  - No error is thrown to the frontend
  - Product page loads normally with core data only

### 3. Error Handling & Monitoring
- All Discogs failures trigger Slack alerts via `slackAlerter.js`
- Priority levels:
  - **Medium**: Timeout errors (500ms exceeded)
  - **Low**: Network errors, API errors, or other failures
- Alerts include:
  - Product ID and name
  - Error type (timeout, network, API error)
  - Recommended actions
  - Links to relevant resources

### 4. Database Caching
- Discogs data is cached in `Product_Detail` table
- If cached data exists, it's returned immediately (no API call)
- New data is fetched and stored for future requests
- This significantly reduces API calls and improves performance

## Implementation Details

### Endpoint: `/api/catalog/[productId]`

**Flow:**
1. Fetch core product data from `products` table
2. Check if Discogs feature flag is enabled
3. If enabled:
   - Check for cached Discogs data in `Product_Detail` table
   - If cached, return immediately
   - If not cached, fetch from Discogs API with 500ms timeout
   - Store result in database for future requests
4. Return response with core data + Discogs data (if available)

**Error Handling:**
```javascript
try {
  const discogsData = await fetchDiscogsDataWithTimeout(product.id, product.name)
  if (discogsData) {
    // Add Discogs fields to response
  }
  // If discogsData is null, continue with core data only
} catch (error) {
  // Send Slack alert
  // Log warning
  // Continue with core data only (no error thrown)
}
```

### Timeout Implementation

```javascript
const DISCOGS_TIMEOUT_MS = 500

function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
  })
}

// Race between Discogs call and timeout
const result = await Promise.race([
  discogsPromise,
  createTimeout(DISCOGS_TIMEOUT_MS),
])
```

### Slack Alert Format

**Timeout Alert (Medium Priority):**
```javascript
{
  priority: 'medium',
  title: 'Discogs API Request Failed',
  message: 'Discogs API request timed out after 500ms for product "..."',
  context: 'Request timeout after 500ms',
  fields: {
    'Product ID': '...',
    'Product Name': '...',
    'Error Type': 'Timeout',
    'Timeout (ms)': '500'
  }
}
```

**Network/API Error Alert (Low Priority):**
```javascript
{
  priority: 'low',
  title: 'Discogs API Request Failed',
  message: 'Discogs API request failed for product "..."',
  context: 'ECONNREFUSED / ENOTFOUND / API Error',
  fields: {
    'Product ID': '...',
    'Product Name': '...',
    'Error Type': 'Network Error' or 'API Error'
  }
}
```

## Frontend Handling

The frontend (`ProductDetailPage.tsx`) already handles null/undefined Discogs data gracefully:

```typescript
{isDiscogsEnabled && product.tracklist && product.tracklist.length > 0 && (
  // Render tracklist section
)}
```

- If `tracklist` is `null` or `undefined`, the section simply doesn't render
- No errors are thrown
- Product page displays normally with core product information

## Testing

### Test Success Case
1. Ensure `FEATURE_FLAG_DISCOGS_ENABLED=true` and `VITE_FEATURE_FLAG_DISCOGS_ENABLED=true`
2. Call `/api/catalog/[productId]` for a product with Discogs data
3. Verify:
   - Response includes `tracklist`, `discogs_release_id`, etc.
   - Response time is < 500ms (if cached) or < 1000ms (if fetched)
   - Product page displays tracklist section

### Test Timeout Case
1. Set Discogs API URL to invalid address or use Nock to force timeout
2. Call `/api/catalog/[productId]`
3. Verify:
   - Response returns immediately (< 600ms total)
   - Response includes core product data only
   - No Discogs fields in response
   - Slack alert received (medium priority)
   - Product page loads normally without tracklist section

### Test Network Error Case
1. Block network access to Discogs API or use Nock to return 500/504
2. Call `/api/catalog/[productId]`
3. Verify:
   - Response returns immediately
   - Response includes core product data only
   - Slack alert received (low priority)
   - Product page loads normally

## Performance Metrics

**Target Performance:**
- Core product data fetch: < 100ms
- Discogs cached data fetch: < 50ms
- Discogs API call (with timeout): < 500ms
- Total endpoint response (with Discogs): < 600ms
- Total endpoint response (Discogs timeout): < 600ms

**Monitoring:**
- Response time logged to console
- Warnings logged if response > 300ms
- Slack alerts sent for all Discogs failures

## Files Modified

### Created
- `api/catalog/[productId].js` - New product detail endpoint with timeout protection
- `DISCOGS_TIMEOUT_IMPLEMENTATION.md` - This documentation

### Modified
- `src/services/DataGateway.ts` - Updated `getProduct()` to use new endpoint
- `src/components/ProductDetailPage.tsx` - Already handles null Discogs data (no changes needed)

## Environment Variables

No new environment variables required. Uses existing:
- `FEATURE_FLAG_DISCOGS_ENABLED` - Backend feature flag
- `VITE_FEATURE_FLAG_DISCOGS_ENABLED` - Frontend feature flag
- `DISCOGS_USER_TOKEN` - Discogs API token
- `DISCOGS_USER_AGENT` - Discogs API user agent
- `DATABASE_URL` or `SPR_DATABASE_URL` - Database connection
- `SLACK_WEBHOOK_URL` - Slack webhook for alerts

## Future Enhancements

1. **Retry Logic**: Implement exponential backoff retry for transient failures
2. **Circuit Breaker**: Temporarily disable Discogs calls after repeated failures
3. **Rate Limiting**: Implement client-side rate limiting to prevent API abuse
4. **Metrics**: Track Discogs API success/failure rates and response times
5. **Configurable Timeout**: Make timeout configurable via environment variable
