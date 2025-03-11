
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
    host: true, // This enables listening on all addresses including network
  }
});
