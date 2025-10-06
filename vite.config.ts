import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'

export default defineConfig({
  base: '/orchestra-notes/',
  plugins: [react(), tailwind()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  }
})