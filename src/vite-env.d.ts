
/// <reference types="vite/client" />

// This declares the import.meta object with environment variables
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_TELEGRAM_BOT_NAME: string;
  readonly VITE_APP_MODE: 'development' | 'production' | 'test';
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ENABLE_DEBUG: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_PUBLIC_STORAGE_URL?: string;
  readonly VITE_USE_LOCAL_STORAGE?: string;
  readonly VITE_MEDIA_BUCKET_NAME?: string;
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot: {
    readonly accept: Function;
    readonly dispose: Function;
    readonly invalidate: Function;
    readonly decline: Function;
    readonly on: Function;
  };
  readonly glob: (pattern: string) => Record<string, () => Promise<any>>;
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

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.json' {
  const content: Record<string, any>;
  export default content;
}

// Declare any custom modules here
declare module 'virtual:*' {
  const content: any;
  export default content;
}
