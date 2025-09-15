// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/feed': {
        target: 'http://127.0.0.1:7777',
        changeOrigin: true,
        ws: false,
        secure: false,
        onError(err, req, res) {
          console.error('[vite-proxy] error', err?.code, req.url)
          res.writeHead(502, { 'Content-Type': 'text/plain' })
          res.end('Proxy error.')
        },
      },
      '/health': {
        target: 'http://127.0.0.1:7777',
        changeOrigin: true,
        ws: false,
        secure: false,
      },
    },
  },
})
