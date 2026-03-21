import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    ENGINE_DEBUG: JSON.stringify(true),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
