// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_TARGET = process.env.VITE_FEED_PROXY_TARGET || 'http://localhost:8080'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_FEED_PROXY_TARGET || DEFAULT_TARGET

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/feed': {
          target,
          changeOrigin: true,
          secure: true,
          ws: false,
          onError(err, req, res) {
            console.error('[vite-proxy] error', err?.code, req.url)
            res.writeHead(502, { 'Content-Type': 'text/plain' })
            res.end('Proxy error.')
          },
        },
        '/health': {
          target,
          changeOrigin: true,
          secure: true,
          ws: false,
          rewrite: (p) => p.replace(/^\/health$/, '/health'),
        },
      },
    },
  }
})
