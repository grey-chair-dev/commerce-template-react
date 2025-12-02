import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.html'],
  server: {
    fs: {
      strict: false,
    },
    // Proxy API requests to Vercel dev (if running on port 3000)
    // Or update VITE_PRODUCTS_SNAPSHOT_URL to point to production API
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        // Only proxy if Vercel dev is running, otherwise let it fail gracefully
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite] API proxy error (Vercel dev may not be running):', err.message)
          })
        },
      },
    },
  },
})
