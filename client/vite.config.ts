import { defineConfig } from 'vite'
import yaml from '@modyfi/vite-plugin-yaml'

export default defineConfig({
  plugins: [yaml()],
  define: {
    ENGINE_DEBUG: JSON.stringify(true),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
