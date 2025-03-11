
import { ParsedContent as BaseContent } from '../_shared/captionParser.ts';

// Extend the base parsed content with any additional fields needed specifically for this function
export interface ParsedContent extends BaseContent {
  // Additional fields could be added here if needed in the future
}

export interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption?: string;
  correlationId: string; // Always expecting a string
  queue_id?: string;
  file_info?: any;
  isEdit?: boolean;
}

export interface ParseResult {
  success: boolean;
  data: ParsedContent;
}

export interface MediaGroupResult {
  syncedCount?: number;
  success: boolean;
  source_message_id?: string;
  reason?: string;
  method?: string;
  details?: any;
  error?: string;
  fallbackError?: string;
}
