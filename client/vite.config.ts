import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { offlineShell } from './offlineShell.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),offlineShell()],
  css: { postcss: { plugins: [] } },
  server: { proxy: { '/api': { target: process.env.ERECT_API_PROXY || 'http://127.0.0.1:4000', ws: true },
    '/ready': process.env.ERECT_API_PROXY || 'http://127.0.0.1:4000', '/private-assets': process.env.ERECT_API_PROXY || 'http://127.0.0.1:4000' } },
})
