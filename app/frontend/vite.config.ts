import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
	react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://hypertube_backend:8000',
        changeOrigin: true,
        rewrite: (path: string) => path,
      } as ProxyOptions,
    },
    watch: {
      usePolling: true,
    },
  },
})
