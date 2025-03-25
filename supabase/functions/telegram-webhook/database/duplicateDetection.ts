
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Check if a message with this file_unique_id already exists
 * Updated to also allow checking by telegramMessageId and chatId
 */
export async function checkDuplicateFile(
  supabase: SupabaseClient,
  telegramMessageId?: number,
  chatId?: number,
  fileUniqueId?: string
): Promise<boolean> {
  try {
    // Either both telegramMessageId and chatId must be provided, or fileUniqueId must be provided
    if ((!telegramMessageId || !chatId) && !fileUniqueId) {
      console.warn('Attempted to check for duplicate file without sufficient identifiers');
      return false;
    }
    
    // Build the query based on the provided parameters
    let query = supabase.from('messages').select('id');
    
    if (fileUniqueId) {
      query = query.eq('file_unique_id', fileUniqueId);
    } else if (telegramMessageId && chatId) {
      query = query.eq('telegram_message_id', telegramMessageId).eq('chat_id', chatId);
    }
    
    const { data, error } = await query.maybeSingle();
      
    if (error) {
      console.error('Error checking for duplicate file:', error);
      // Don't throw - we want graceful fallback to creating a new record
      return false;
    }
    
    return !!data;
  } catch (error) {
    console.error('Exception checking for duplicate file:', 
      error instanceof Error ? error.message : String(error));
    return false;
  }
}
