
/// <reference types="vite/client" />

// This declares the import.meta object with environment variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_TELEGRAM_BOT_NAME: string;
  readonly VITE_APP_MODE: 'development' | 'production' | 'test';
  readonly VITE_API_BASE_URL: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Declare CSS modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// Declare assets
declare module '*.svg' {
  import React = require('react');
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.jpg';
declare module '*.jpeg';
declare module '*.png';
declare module '*.gif';
