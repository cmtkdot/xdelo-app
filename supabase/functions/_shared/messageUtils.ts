
// This file should import from consolidatedMessageUtils.ts instead of supabase.ts
import { supabaseClient, logProcessingEvent } from './consolidatedMessageUtils.ts';

// Re-export what the file needs
export { supabaseClient, logProcessingEvent };

// Add any additional helper functions here that might be needed
export function isMessageEmpty(message: any): boolean {
  if (!message) return true;
  
  // Check if the message has any caption or text content
  const hasCaption = message.caption && message.caption.trim().length > 0;
  const hasText = message.text && message.text.trim().length > 0;
  
  return !hasCaption && !hasText;
}
