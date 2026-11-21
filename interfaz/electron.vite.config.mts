import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

const compartido = resolve(import.meta.dirname, 'src/compartido')

/**
 * Política de seguridad de contenido, solo en la versión compilada
 * (en desarrollo Vite necesita scripts en línea y un websocket para recargar).
 */
function politicaDeContenido(): Plugin {
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ')
  return {
    name: 'genoma:politica-de-contenido',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!-- CSP -->', `<meta http-equiv="Content-Security-Policy" content="${politica}" />`)
    },
  }
}

export default defineConfig({
  main: {
    resolve: { alias: { '@compartido': compartido } },
  },
  preload: {
    resolve: { alias: { '@compartido': compartido } },
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src/renderer/src'),
        '@compartido': compartido,
      },
    },
    build: { minify: true },
    plugins: [react(), tailwindcss(), politicaDeContenido()],
  },
})
