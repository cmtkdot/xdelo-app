
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Enable Fast Refresh for React components
      fastRefresh: true,
      // Babel config for better React optimization
      babel: {
        plugins: [
          // Only include essential babel plugins
        ]
      }
    }),
    // Only use component tagger in development mode
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
    // Simplified chunk strategy
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
    // Allow lovable project domain for development
    allowedHosts: [
      'localhost',
      '*.lovableproject.com'
    ]
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query'
    ]
  }
}));
