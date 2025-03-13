import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { componentTagger } from "lovable-tagger";
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current mode
  const env = loadEnv(mode, process.cwd(), '');
  const isProd = mode === 'production';
  const isAnalyze = mode === 'analyze';

  return {
    plugins: [
      // React plugin with better optimization settings
      react({
        babel: {
          plugins: [
            isProd && [
              'transform-remove-console',
              { exclude: ['error', 'warn', 'info'] }
            ]
          ].filter(Boolean),
          // Add better optimization options
          presets: [
            ['@babel/preset-env', { targets: 'defaults' }]
          ],
        }
      }),
      
      // Only use component tagger in development mode
      mode === 'development' && componentTagger(),
      
      // Compression plugins for production builds
      isProd && viteCompression({
        algorithm: 'gzip',
        ext: '.gz',
      }),
      isProd && viteCompression({
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
    ].filter(Boolean),
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: isProd ? 'terser' : false,
      target: 'es2020', // Better browser compatibility
      assetsInlineLimit: 4096, // 4kb - optimize for http/2
      chunkSizeWarningLimit: 1000, // Increase warning limit
      reportCompressedSize: !isAnalyze, // Disable on analyze for speed
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: isProd,
          pure_funcs: isProd ? ['console.log', 'console.debug'] : []
        },
        format: {
          comments: false
        }
      },
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress circular dependency warnings
          if (warning.code === 'CIRCULAR_DEPENDENCY') return;
          warn(warning);
        },
        output: {
          manualChunks: (id) => {
            // React core libraries
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
            
            // Date manipulation
            if (id.includes('node_modules/date-fns')) {
              return 'date-utils';
            }

            // Form libraries
            if (id.includes('node_modules/react-hook-form') ||
                id.includes('node_modules/@hookform/') ||
                id.includes('node_modules/zod')) {
              return 'form-libs';
            }

            // Visualization
            if (id.includes('node_modules/recharts') ||
                id.includes('node_modules/d3')) {
              return 'visualization';
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
        timeout: 10000, // Increase HMR timeout for slower connections
      },
      // Allow lovable project domain for development
      allowedHosts: [
        'localhost',
        '*.lovableproject.com',
        '79512fb5-8301-4d61-9349-6769d5c8295b.lovableproject.com'
      ],
      watch: {
        ignored: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**']
      }
    },
    
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        '@tanstack/react-query',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'sonner'
      ],
      exclude: [],
      esbuildOptions: {
        target: 'es2020',
      }
    },
    
    // Better error overlay
    esbuild: {
      logOverride: { 
        'this-is-undefined-in-esm': 'silent' 
      },
      // Improved JSX transformation
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      jsxInject: `import React from 'react'`
    }
  };
});
