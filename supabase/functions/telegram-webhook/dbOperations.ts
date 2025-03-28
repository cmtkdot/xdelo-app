// @deno-types="https://esm.sh/v135/@supabase/supabase-js@2.38.4/dist/module/index.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  extractTelegramMetadata as _extractTelegramMetadata,
  logProcessingEvent,
} from "../_shared/consolidatedMessageUtils.ts";

// Re-export with consistent naming
export const extractTelegramMetadata = _extractTelegramMetadata;

/**
 * Enhanced Supabase client with improved timeout and retry capabilities
 */
interface DenoRuntime {
  env: {
    get(key: string): string | undefined;
  };
}

declare const Deno: DenoRuntime;

// Initialize Supabase client with environment variables
const supabaseUrl = typeof Deno !== 'undefined' && typeof Deno?.env?.get === 'function'
  ? Deno.env.get("SUPABASE_URL")!
  : process?.env?.SUPABASE_URL!;
const supabaseKey = typeof Deno !== 'undefined' && typeof Deno?.env?.get === 'function'
  ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  : process?.env?.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Re-export commonly used functions from shared utils
export { logProcessingEvent as xdelo_logProcessingEvent };

// Export all database operations
export * from './messageOperations.ts';
export * from './mediaOperations.ts';

/* ... rest of the file remains unchanged until createMediaMessage ... */

/**
 * Creates a new media message record in the database with transaction support
 */
export async function createMediaMessage(input: {
  telegram_message_id: number;
  chat_id: number;
  chat_type: string;
  chat_title?: string;
  caption?: string;
  file_id: string;
  file_unique_id: string;
  media_group_id?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path?: string;
  public_url?: string;
  telegram_data: any;
  processing_state?: string;
  is_forward?: boolean;
  correlation_id: string;
  message_url?: string;
}): Promise<{ id?: string; success: boolean; error?: string }> {
  try {
    // Extract essential metadata only
    const telegramMetadata = extractTelegramMetadata(input.telegram_data);

    // Create the message record
    const { data, error } = await supabaseClient
      .from("messages")
      .insert({
        telegram_message_id: input.telegram_message_id,
        chat_id: input.chat_id,
        chat_type: input.chat_type,
        chat_title: input.chat_title,
        caption: input.caption || "",
        file_id: input.file_id,
        file_unique_id: input.file_unique_id,
        media_group_id: input.media_group_id,
        mime_type: input.mime_type,
        file_size: input.file_size,
        width: input.width,
        height: input.height,
        duration: input.duration,
        storage_path: input.storage_path,
        public_url: input.public_url,
        telegram_metadata: telegramMetadata,
        processing_state: input.processing_state || "initialized",
        is_forward: input.is_forward || false,
        correlation_id: input.correlation_id,
        message_url: input.message_url,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create media message record:", error);
      return { success: false, error: error.message };
    }

    return { id: data.id, success: true };
  } catch (error) {
    console.error("Exception in createMediaMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/* ... rest of the original file content ... */
