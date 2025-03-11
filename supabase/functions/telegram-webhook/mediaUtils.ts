
/**
 * Media Utilities for Telegram Webhook
 * 
 * IMPORTANT: This file is a compatibility wrapper that re-exports
 * functions from ./utils/mediaUtils.ts, which uses the centralized 
 * utilities from _shared/mediaUtils.ts.
 * 
 * Direct imports from this file will continue to work, but all
 * new code should import directly from './utils/mediaUtils.ts'.
 */

// Re-export all utilities from utils/mediaUtils.ts
export * from './utils/mediaUtils.ts';

