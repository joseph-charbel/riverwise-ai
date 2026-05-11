import type { AddressInfo } from 'node:net'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'

import { defineConfig } from 'vite'
import yaml from '@modyfi/vite-plugin-yaml'
import { viteStaticCopy } from 'vite-plugin-static-copy'

function formatListeningUrl(info: AddressInfo): string {
  const { address, port, family } = info
  let host =
    address === '::' || address === '0.0.0.0'
      ? '127.0.0.1'
      : address === '::1'
        ? '127.0.0.1'
        : address

  const isBracketedV6 =
    family === 'IPv6' && host.includes(':') && host !== '127.0.0.1'
  if (isBracketedV6) host = `[${host}]`

  return `http://${host}:${port}`
}

function logRiverwiseListening(httpServer: ViteDevServer['httpServer']) {
  const raw = httpServer?.address?.() ?? null
  if (raw == null) {
    console.info(
      '[Riverwise] Client dev server is up (see Vite Local URL below if unset).',
    )
    return
  }
  if (typeof raw === 'string') {
    console.info(`Riverwise client listening on socket ${raw}`)
    return
  }
  console.info(`Riverwise client up and running at ${formatListeningUrl(raw)}`)
}

/** Mirror backend “up and running” wording when dev/preview listens. */
function riverwiseClientReadyLog(): Plugin {
  return {
    name: 'riverwise-client-ready-log',
    configureServer(server: ViteDevServer) {
      server.httpServer?.once('listening', () => logRiverwiseListening(server.httpServer))
    },
    configurePreviewServer(server: PreviewServer) {
      server.httpServer?.once('listening', () => logRiverwiseListening(server.httpServer))
    },
  }
}

export default defineConfig({
  publicDir: false,
  plugins: [
    riverwiseClientReadyLog(),
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
