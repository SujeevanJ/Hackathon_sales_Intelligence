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
        target: 'http://localhost:8002', // Change to 'https://hackathon-sales-intelligence-chatbot-sera.onrender.com' for production
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000', // Change to 'https://hackathon-sales-intelligence.onrender.com' for production
        changeOrigin: true,
      }
    }
  }
})
