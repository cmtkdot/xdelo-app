
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'localhost',
      '*.lovableproject.com',
      '79512fb5-8301-4d61-9349-6769d5c8295b.lovableproject.com'
    ]
  }
})
