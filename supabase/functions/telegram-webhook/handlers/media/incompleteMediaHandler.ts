
import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { xdelo_detectMimeType } from '../../utils/media/mediaUtils.ts';
import { 
  TelegramMessage, 
  MessageContext, 
  ForwardInfo,
  MessageInput
} from '../../types.ts';
import { createMessage } from '../../dbOperations.ts';
import { constructTelegramMessageUrl } from '../../utils/messageUtils.ts';
import { xdelo_logProcessingEvent } from '../../../_shared/databaseOperations.ts';

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Create an incomplete media record when file_id has expired
 * but we want to create a record anyway for later processing
 */
export async function createIncompleteMediaRecord(
  message: TelegramMessage,
  telegramFile: any,
  estimatedStoragePath: string,
  context: MessageContext,
  needsRedownload: boolean
): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Generate best-effort public URL based on estimated storage path
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const estimatedPublicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${estimatedStoragePath}`;
    
    // Prepare forward info if message is forwarded
    const forwardInfo: ForwardInfo | undefined = message.forward_origin ? {
      is_forwarded: true,
      forward_origin_type: message.forward_origin.type,
      forward_from_chat_id: message.forward_origin.chat?.id,
      forward_from_chat_title: message.forward_origin.chat?.title,
      forward_from_chat_type: message.forward_origin.chat?.type,
      forward_from_message_id: message.forward_origin.message_id,
      forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
      original_chat_id: message.forward_origin.chat?.id,
      original_chat_title: message.forward_origin.chat?.title,
      original_message_id: message.forward_origin.message_id
    } : undefined;
    
    // Create incomplete message record
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: xdelo_detectMimeType(message),
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
      storage_path: estimatedStoragePath,
      public_url: estimatedPublicUrl,
      width: telegramFile.width,
      height: telegramFile.height,
      duration: message.video?.duration,
      file_size: telegramFile.file_size,
      correlation_id: correlationId,
      processing_state: 'error', // Mark as error since media couldn't be processed
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      is_forward: context.isForwarded,
      storage_exists: false, // Media not in storage yet
      storage_path_standardized: true, // Path format is correct
      needs_redownload: needsRedownload,
      redownload_reason: 'file_id_expired',
      redownload_flagged_at: new Date().toISOString(),
      message_url: constructTelegramMessageUrl(message.chat.id, message.message_id),
      error_message: 'File ID expired or temporarily unavailable'
    };
    
    // Create the message
    const result = await createMessage(supabaseClient, messageInput, logger);
    
    if (!result.success) {
      throw new Error(result.error_message || 'Failed to create incomplete message record');
    }
    
    // Log the action
    await xdelo_logProcessingEvent(
      "incomplete_message_created",
      result.id,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        file_id: telegramFile.file_id,
        file_unique_id: telegramFile.file_unique_id,
        reason: 'file_id_expired'
      }
    );
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        id: result.id, 
        file_id_expired: true,
        needs_redownload: true,
        message: 'Created incomplete record - media download will be retried later',
        correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger?.error(`Failed to create incomplete media record: ${error.message}`);
    
    // Re-throw for handling by the main handler
    throw error;
  }
}
