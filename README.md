# Local Commerce Template (LCT) v2.0

Single-page React experience that mirrors Square POS → Neon → mandated real-time adapters. Branding, section toggles, and live product data are all configuration-driven so non-technical operators can deploy quickly.

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in Neon + Stack auth values
npm run dev
```

Required environment variables:

- `VITE_NEON_AUTH_URL` – Neon Auth endpoint that issues Better Auth tokens.
- `VITE_STACK_PROJECT_ID` – Stack/Neon project identifier passed to the auth adapter.
- `VITE_STACK_PUBLISHABLE_CLIENT_KEY` – Publishable key for client bootstrap.
- `VITE_PRODUCTS_WS_URL` – Mandated data adapter WebSocket that proxies `/artifacts/{appId}/public/data/products`.
- `VITE_APP_ID` – Application/tenant ID used when building the collection path.
- `VITE_ENABLE_MOCK_DATA` – Defaults to `true`; set to `false` (or run `npm run mock:delete`) to force real-time data only.
- `VITE_PRODUCTS_SNAPSHOT_URL` – HTTPS endpoint that returns `{ products: Product[] }`, used as the REST fallback when the WebSocket adapter is unhealthy. Accepts `:appId` or `{appId}` token replacement.
- `VITE_ADAPTER_HEALTH_URL` – `/health` endpoint exposed by the mandated adapter; polled every 30s to drive the UI health badge.
- `VITE_WS_MAX_RETRIES`, `VITE_WS_BACKOFF_BASE_MS`, `VITE_WS_BACKOFF_CAP_MS` – Control the exponential backoff reconnection strategy (default 5 attempts, 1s base, 30s cap).
- `VITE_SNAPSHOT_POLL_INTERVAL_MS` – Interval for polling the snapshot endpoint while in degraded mode (default 30s).
- `VITE_ERROR_WEBHOOK_URL`, `VITE_METRICS_WEBHOOK_URL` – Optional HTTP endpoints that receive structured JSON when client errors or metrics (latency / TTI) are captured.
- (Optional host injection) `window.__app_id` and `window.__neon_auth_url` are honored automatically if the hosting platform supplies them at runtime.

`src/config.ts` centralizes feature flags (`enableAbout`, `enableEvents`) and marketing copy. Changing the five CSS variables in `src/globals.css` (`--color-primary`, `--color-secondary`, `--color-accent`, `--color-surface`, `--color-text`) fully rebrands the UI without touching JSX.

## Architecture Notes

- **Auth**: `StackAuthProvider` wraps the app with the Supabase-style Neon Auth adapter. It consumes `__initial_auth_token` when present to satisfy the client-mandated identity handshake. The active `user.id` is rendered in both the header and footer for multi-user awareness.
- **Real-time data**: `subscribeToProducts(appId, onSnapshot)` connects to the required adapter via WebSocket and emits every payload with an `onSnapshot` callback. In development (no `VITE_PRODUCTS_WS_URL`) a mock interval mutates stock counts to prove sub-second UI updates.
- **Single file UI**: All layout, filters, and cards live in `src/App.tsx`, using Tailwind classes that resolve to CSS variables. No router or multi-page structure is used per constraint C4.2.
- **Client-side hardening**: Incoming product documents are normalized via `sanitizeText` (see `src/utils/sanitize.ts`) before they ever reach React state. HTML tags, script blocks, and non-printable characters are stripped so even a compromised upstream record remains display-only.
- **Resilience + monitoring**:
  - Exponential WebSocket reconnection with automatic switchover to either the REST snapshot feed or the deterministic mock feed (`src/dataAdapter.ts`).
  - Snapshot polling keeps the catalog fresh when the realtime adapter is offline.
  - `checkAdapterHealth()` polls the adapter’s `/health` endpoint so the header badge reflects its status; results are also surfaced through `trackMetric`.
  - `src/monitoring.ts` wires global `window.onerror` / `unhandledrejection` handlers and streams metrics + error payloads to optional webhook URLs. `App.tsx` logs adapter latency for observability.
  - The in-app cookie banner centralizes user consent for optional analytics/monitoring.

## Testing the real-time feed locally

1. Leave `VITE_PRODUCTS_WS_URL` empty to enable the mock Upstash/Neon emitter.
2. Run `npm run dev` and tweak `src/dataAdapter.ts` mock data to simulate new events.
3. Observe the “Real-time adapter health” panel—latency should remain under 1s as stock pulses.

When integrating with your actual adapter, ensure the WebSocket payloads follow `{ products: Product[] }` or `{ product: Product }` so the client-side mirror stays in lock-step with Neon.

### Mock data management scripts

- `npm run mock:add` – writes `VITE_ENABLE_MOCK_DATA=true` to `.env.local`, enabling the local fallback feed.
- `npm run mock:delete` – writes `VITE_ENABLE_MOCK_DATA=false`, forcing the SPA to depend solely on the configured WebSocket adapter.

## Compliance & UX defaults

- Footer links for Privacy and Terms pull from `siteConfig.legal.*`, so they can be wired to an organization’s canonical policies.
- A lightweight cookie/telemetry consent banner (`CookieBanner` in `src/App.tsx`) records the user’s decision in `localStorage` (`lct_cookie_consent`) before enabling optional analytics webhooks.
