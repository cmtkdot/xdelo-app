
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { componentTagger } from "lovable-tagger"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 8080,
    host: "::",
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '*.lovableproject.com',
      '79512fb5-8301-4d61-9349-6769d5c8295b.lovableproject.com'
    ]
  }
}))
