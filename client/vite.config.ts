import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offlineShell } from './offlineShell.ts'

const apiTarget = process.env.ERECT_API_PROXY || 'http://127.0.0.1:4000'
const apiProxy = {
  '/api': { target: apiTarget, ws: true },
  '/ready': apiTarget,
  '/private-assets': apiTarget,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineShell()],
  css: { postcss: { plugins: [] } },
  server: {
    proxy: {
      '/motion/erect3d-film': {
        target: process.env.ERECT_FILM_PROXY || 'http://127.0.0.1:5191',
        changeOrigin: true,
      },
      ...apiProxy,
    },
  },
  // A production preview serves the built film instead of forwarding to its dev server.
  preview: { proxy: apiProxy },
})
