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
        plugins: []
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
    sourcemap: mode === 'development',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production'
      }
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Core React libraries
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') || 
              id.includes('node_modules/react-router-dom/')) {
            return 'react-core';
          }
          
          // Supabase and data related
          if (id.includes('node_modules/@supabase/') || 
              id.includes('node_modules/@tanstack/react-query')) {
            return 'data-layer';
          }
          
          // UI Component libraries - split into logical groups
          if (id.includes('node_modules/@radix-ui/')) {
            // Navigation components
            if (id.includes('navigation-menu') || 
                id.includes('tabs') || 
                id.includes('menubar')) {
              return 'ui-navigation';
            }
            
            // Form components
            if (id.includes('checkbox') || 
                id.includes('radio-group') || 
                id.includes('select') || 
                id.includes('slider') || 
                id.includes('switch') || 
                id.includes('form')) {
              return 'ui-forms';
            }
            
            // Overlay components
            if (id.includes('dialog') || 
                id.includes('popover') || 
                id.includes('tooltip') || 
                id.includes('hover-card')) {
              return 'ui-overlays';
            }
            
            // Feedback components
            if (id.includes('toast') || 
                id.includes('alert') || 
                id.includes('progress')) {
              return 'ui-feedback';
            }
            
            // Default UI chunk for other Radix components
            return 'ui-core';
          }
          
          // UI utilities like clsx, tailwind-merge
          if (id.includes('node_modules/clsx') || 
              id.includes('node_modules/tailwind-merge') || 
              id.includes('node_modules/class-variance-authority')) {
            return 'ui-utils';
          }
          
          // Other vendor libraries
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
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
      '*.lovableproject.com',
      '79512fb5-8301-4d61-9349-6769d5c8295b.lovableproject.com'
    ]
  },
  
  optimizeDeps: {
    entries: ['./src/**/*.{ts,tsx}'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      'class-variance-authority',
      'clsx',
      'tailwind-merge'
    ],
    exclude: []
  },
  
  // Better error overlay
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
}));
