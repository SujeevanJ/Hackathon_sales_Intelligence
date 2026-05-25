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
        target: 'https://hackathon-sales-intelligence-chatbot-sera.onrender.com', // Change to 'http://localhost:8002' for local microservice
        changeOrigin: true,
      },
      '/api': {
        target: 'https://hackathon-sales-intelligence.onrender.com', // Change to 'http://localhost:8000' for local backend
        changeOrigin: true,
      }
    }
  }
})
