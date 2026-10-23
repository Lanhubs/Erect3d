import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/motion/erect3d-film/',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom', 'three', '@react-three/fiber', 'zustand'] },
  server: { fs: { allow: ['..'] } },
})
