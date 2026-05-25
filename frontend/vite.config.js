import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api/chat': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
      '/api': {
        target: 'https://hackathon-sales-intelligence.onrender.com', // 'http://localhost:8000'
        changeOrigin: true,
      }
    }
  }
})
