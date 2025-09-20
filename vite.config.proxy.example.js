// vite.config.proxy.example.js
// If you want to keep '/feed' paths during dev, set this in your Vite config:
export default {
  server: {
    proxy: {
      '/feed': {
        target: ' CLOUD_RUN_URL_PLACEHOLDER/',
        changeOrigin: true,
        secure: true,
      },
      // keep your /api/* proxies if you have them
    },
  },
};
