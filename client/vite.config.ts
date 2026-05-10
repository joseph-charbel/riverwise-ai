import { defineConfig } from 'vite'
import yaml from '@modyfi/vite-plugin-yaml'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  publicDir: false,
  plugins: [
    yaml(),
    ...viteStaticCopy({
      targets: [
        {
          src: 'src/assets/**/*',
          dest: 'assets',
          rename: { stripBase: 2 },
        },
      ],
    }),
  ],
  define: {
    ENGINE_DEBUG: JSON.stringify(true),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
