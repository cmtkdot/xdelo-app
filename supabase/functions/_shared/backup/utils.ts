// Re-export functions from other utilities files for backward compatibility
// and to provide a single import point for common utilities

import { supabaseClient } from './cors.ts';
import { corsHeaders } from './cors.ts';
import { 
  isMessageForwarded, 
  constructTelegramMessageUrl,
  xdelo_findMediaGroupMessages,
  xdelo_findMessageWithContent
} from './messageUtils.ts';

// Import from proper location instead of messageUtils
import { checkMessageExists } from './core.ts';

// Export all utilities
export {
  supabaseClient,
  corsHeaders,
  checkMessageExists,
  isMessageForwarded,
  constructTelegramMessageUrl,
  xdelo_findMediaGroupMessages,
  xdelo_findMessageWithContent
};

// Other utility functions can be added here
export function generateCorrelationId(prefix: string = 'corr'): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function sanitizeString(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/[<>]/g, '') // Basic HTML tag removal
    .trim();
}
