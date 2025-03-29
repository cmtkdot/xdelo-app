
/**
 * Service for database operations
 */
import { supabaseClient } from "../../_shared/supabase.ts";
import { TelegramMessage } from "../types.ts";

/**
 * Check for existing message by telegram_message_id and chat_id
 */
export async function checkExistingMessage(
  telegramMessageId: number,
  chatId: number
): Promise<{ exists: boolean; id?: string; retryCount?: number; caption?: string }> {
  try {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("id, retry_count, caption")
      .eq("telegram_message_id", telegramMessageId)
      .eq("chat_id", chatId)
      .maybeSingle();

    if (error) {
      console.error(`Error checking for existing message: ${error.message}`);
      return { exists: false };
    }

    return {
      exists: !!data,
      id: data?.id,
      retryCount: data?.retry_count,
      caption: data?.caption
    };
  } catch (error) {
    console.error(`Exception checking for existing message: ${error instanceof Error ? error.message : String(error)}`);
    return { exists: false };
  }
}

/**
 * Create or update message in the database
 */
export async function createMessage(messageInput: any, logger?: any): Promise<any> {
  const { data, error } = await supabaseClient.rpc('handle_media_message', {
    p_telegram_message_id: messageInput.telegram_message_id,
    p_chat_id: messageInput.chat_id,
    p_file_unique_id: messageInput.file_unique_id || null,
    p_media_data: messageInput
  });

  if (error) {
    logger?.error(`Error calling handle_media_message RPC: ${error.message}`);
    return { success: false, error_message: error.message };
  }

  return { success: true, id: data?.message_id, status: data?.status };
}

/**
 * Process edited message
 */
export async function handleEditedMessage(
  messageId: string,
  telegramMessageId: number,
  chatId: number,
  newText: string | null,
  newCaption: string | null,
  telegramData: any,
  isChannelPost: boolean = false,
  editSource: string = 'user'
): Promise<any> {
  try {
    const { data, error } = await supabaseClient.rpc('handle_message_edit', {
      p_message_id: messageId,
      p_telegram_message_id: telegramMessageId,
      p_chat_id: chatId,
      p_new_text: newText,
      p_new_caption: newCaption,
      p_telegram_data: telegramData,
      p_is_channel_post: isChannelPost,
      p_edit_source: editSource
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      status: data?.status,
      edit_history_id: data?.edit_history_id,
      edit_count: data?.edit_count
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check for media group duplicates
 */
export async function checkMediaGroupDuplicate(
  mediaGroupId: string,
  fileUniqueId: string
): Promise<{ exists: boolean; id?: string; processingState?: string }> {
  try {
    if (!mediaGroupId || !fileUniqueId) {
      return { exists: false };
    }

    const { data, error } = await supabaseClient
      .from('messages')
      .select('id, processing_state')
      .eq('media_group_id', mediaGroupId)
      .eq('file_unique_id', fileUniqueId)
      .maybeSingle();

    if (error) {
      console.error(`Error checking for media duplicates: ${error.message}`);
      return { exists: false };
    }

    return {
      exists: !!data,
      id: data?.id,
      processingState: data?.processing_state
    };
  } catch (error) {
    console.error(`Exception checking for media group duplicates: ${error instanceof Error ? error.message : String(error)}`);
    return { exists: false };
  }
}
