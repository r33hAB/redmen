// vite.config.proxy.example.js
// If you want to keep '/feed' paths during dev, set this in your Vite config:
export default {
  server: {
    proxy: {
      '/feed': {
        target: process.env.VITE_FEED_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        secure: true,
      },
      // keep your /api/* proxies if you have them
    },
  },
};
