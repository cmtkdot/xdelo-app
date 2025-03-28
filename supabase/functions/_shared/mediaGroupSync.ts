
/**
 * Shared utilities for media group synchronization
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Sync media group content from a source message to all other messages in the group
 */
export async function syncMediaGroupContent(
  supabaseUrl: string,
  supabaseKey: string,
  sourceMessageId: string,
  analyzedContent: any,
  options: {
    forceSync?: boolean;
    syncEditHistory?: boolean;
  } = {}
) {
  // Create a Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Call the database function with the correct parameters
    const { data, error } = await supabase.rpc("xdelo_sync_media_group_content", {
      p_message_id: sourceMessageId,
      p_analyzed_content: analyzedContent, 
      p_force_sync: options.forceSync !== false,
      p_sync_edit_history: !!options.syncEditHistory
    });
    
    if (error) {
      console.error("Media group sync error:", error);
      
      // Log detailed error information
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: error.details
      });
      
      throw new Error(`Media group sync failed: ${error.message}`);
    }
    
    return {
      success: true,
      sourceMessageId,
      updatedCount: data?.updated_count || 0,
      mediaGroupId: data?.media_group_id
    };
  } catch (e) {
    console.error("Exception in syncMediaGroupContent:", e);
    
    // Add more detailed logging
    if (e instanceof Error) {
      console.error("Error details:", {
        name: e.name,
        message: e.message,
        stack: e.stack
      });
    }
    
    return {
      success: false,
      sourceMessageId,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

/**
 * Find the best message to use as a source for syncing a media group
 */
export async function findMediaGroupSourceMessage(
  supabaseUrl: string,
  supabaseKey: string,
  mediaGroupId: string
) {
  // Create a Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // First try to find a message marked as original caption
    const { data: originalCaption, error: originalError } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId)
      .eq("is_original_caption", true)
      .limit(1)
      .single();
      
    if (!originalError && originalCaption) {
      return { success: true, message: originalCaption };
    }
    
    // Otherwise find a message with caption and analyzed content
    const { data: withCaption, error: captionError } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId)
      .not("caption", "is", null)
      .not("analyzed_content", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
      
    if (!captionError && withCaption) {
      return { success: true, message: withCaption };
    }
    
    // As a last resort, find any message in the group
    const { data: anyMessage, error: anyError } = await supabase
      .from("messages")
      .select("*")
      .eq("media_group_id", mediaGroupId)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
      
    if (!anyError && anyMessage) {
      return { success: true, message: anyMessage, needsCaption: true };
    }
    
    return { 
      success: false, 
      error: "No messages found in the media group" 
    };
  } catch (e) {
    console.error("Exception in findMediaGroupSourceMessage:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

/**
 * Helper to execute a function with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoffFactor = 2,
    retryableErrors = []
  } = options;
  
  let attempt = 0;
  let lastError: Error;
  
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      // Check if we should retry
      const isRetryable = 
        retryableErrors.length === 0 || 
        retryableErrors.some(errMsg => lastError.message.includes(errMsg));
      
      // If we've used all attempts or error is not retryable, throw
      if (attempt >= maxAttempts || !isRetryable) {
        throw lastError;
      }
      
      // Wait with exponential backoff
      const waitTime = delay * Math.pow(backoffFactor, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} in ${waitTime}ms: ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError!;
}
