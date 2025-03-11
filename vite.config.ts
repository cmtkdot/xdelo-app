
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            '@supabase/supabase-js',
            '@tanstack/react-query',
          ],
          'ui': [
            '@radix-ui',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ]
        }
      }
    }
  },
  server: {
    port: 8080,
    host: '::',
    cors: true, 
    hmr: {
      protocol: 'wss',
      clientPort: 443
    },
    allowedHosts: [
      '79512fb5-8301-4d61-9349-6769d5c8295b.lovableproject.com',
      '*.lovableproject.com'
    ]
  }
}));
