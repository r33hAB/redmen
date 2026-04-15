// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Set VITE_FEED_PROXY_TARGET in your .env to your Cloud Run URL
const DEFAULT_TARGET = 'http://localhost:8080'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_FEED_PROXY_TARGET || DEFAULT_TARGET

  return {
    plugins: [react()],

    // Allow imports like "@/lib/api.js"
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      proxy: {
        // Frontend calls to /feed/** are proxied to Cloud Run
        '/feed': {
          target,
          changeOrigin: true,
          secure: true,
          ws: false,
        },
        // Optional convenience endpoint to check daemon health in dev
        '/health': {
          target,
          changeOrigin: true,
          secure: true,
          ws: false,
        },
      },
    },
  }
})
