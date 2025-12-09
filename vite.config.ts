import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Fix for HMR issues with react-refresh
      jsxRuntime: 'automatic',
    }),
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  server: {
    fs: {
      strict: false,
    },
    hmr: {
      // Fix for HMR connection issues
      overlay: true,
    },
    // Proxy API requests to Vercel dev (if running on port 3000)
    // Or update VITE_PRODUCTS_SNAPSHOT_URL to point to production API
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost', // Ensure cookies work across ports
        cookiePathRewrite: '/', // Ensure cookies work across paths
        // Only proxy if Vercel dev is running, otherwise let it fail gracefully
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite] API proxy error (Vercel dev may not be running):', err.message)
          })
        },
      },
    },
  },
  optimizeDeps: {
    // Force re-optimization to fix module resolution issues
    force: true,
  },
})
