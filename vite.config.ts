import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    port: 57832,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/release/**', '**/dist/**']
    }
  },
})
