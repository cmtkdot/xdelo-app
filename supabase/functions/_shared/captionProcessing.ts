
/**
 * Shared utilities for caption processing across edge functions
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger } from "../telegram-webhook/utils/logger.ts";

/**
 * Process a message caption directly through a database function call
 * 
 * @param client Supabase client
 * @param messageId ID of the message to process
 * @param correlationId Optional correlation ID for tracing
 * @param force Force reprocessing even if already processed
 * @param logger Optional logger for detailed logging
 * @returns Processing result
 */
export async function xdelo_processMessageCaption(
  client: SupabaseClient,
  messageId: string,
  correlationId?: string,
  force: boolean = false,
  logger?: Logger
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    logger?.info(`Processing caption for message ${messageId}`, { 
      correlation_id: correlationId,
      force
    });
    
    // First, check if the message exists and has a caption
    const { data: message, error: messageError } = await client
      .from('messages')
      .select('id, caption, media_group_id, analyzed_content')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      const errorMsg = `Message not found or error retrieving message: ${messageError?.message || "Not found"}`;
      logger?.error(errorMsg, { message_id: messageId });
      return { success: false, error: errorMsg };
    }
    
    // Log if message already has analyzed content
    if (message.analyzed_content && !force) {
      logger?.info(`Message ${messageId} already has analyzed content`, { 
        force_reprocess: force 
      });
      
      // If not forcing reprocess, return existing analyzed content
      if (!force) {
        return { 
          success: true, 
          data: { 
            messageId: messageId,
            analyzed_content: message.analyzed_content,
            skipped: true,
            reason: "already_processed" 
          } 
        };
      }
    }
    
    // Check if message has caption or is part of a media group
    if (!message.caption && !message.media_group_id) {
      const errorMsg = "Message has no caption and is not part of a media group";
      logger?.warn(errorMsg, { message_id: messageId });
      return { success: false, error: errorMsg };
    }
    
    // If message has no caption but is part of a media group, try to find a caption in the group
    if (!message.caption && message.media_group_id) {
      logger?.info(`Message ${messageId} has no caption but is part of media group ${message.media_group_id}, looking for caption in group`);
      
      // Try to find a caption message in the group
      const { data: captionMessage, error: findError } = await client.rpc(
        'xdelo_find_caption_message',
        { p_media_group_id: message.media_group_id }
      );
      
      if (findError || !captionMessage) {
        const errorMsg = `No caption found in media group ${message.media_group_id}: ${findError?.message || "No caption message found"}`;
        logger?.warn(errorMsg);
        return { success: false, error: errorMsg };
      }
      
      logger?.info(`Found caption message ${captionMessage} in media group ${message.media_group_id}, using it as source`);
      
      // Use the found caption message instead
      const syncResult = await xdelo_syncMediaGroupContent(
        client,
        captionMessage,
        message.media_group_id,
        correlationId,
        force,
        false, // Don't sync edit history
        logger
      );
      
      return syncResult;
    }
    
    // Call the database function directly
    logger?.info(`Calling xdelo_process_caption_workflow for message ${messageId}`);
    const { data, error } = await client.rpc('xdelo_process_caption_workflow', {
      p_message_id: messageId,
      p_correlation_id: correlationId || crypto.randomUUID(),
      p_force: force
    });
    
    if (error) {
      logger?.error(`Error processing caption: ${error.message}`, {
        message_id: messageId,
        correlation_id: correlationId,
        error
      });
      return { success: false, error: error.message };
    }
    
    logger?.info(`Caption processed successfully for message ${messageId}`, {
      result: data
    });
    
    return { success: true, data };
  } catch (error: any) {
    logger?.error(`Exception in xdelo_processMessageCaption: ${error.message}`, {
      message_id: messageId,
      correlation_id: correlationId,
      error
    });
    return { success: false, error: error.message };
  }
}

/**
 * Sync media group content across all messages in the group
 * 
 * @param client Supabase client
 * @param sourceMessageId Source message with the content to sync
 * @param mediaGroupId Media group ID
 * @param correlationId Optional correlation ID for tracing
 * @param force Force sync even if already synced
 * @param syncEditHistory Sync edit history along with content
 * @param logger Optional logger for detailed logging
 * @returns Sync result
 */
export async function xdelo_syncMediaGroupContent(
  client: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId?: string,
  force: boolean = false,
  syncEditHistory: boolean = false,
  logger?: Logger
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    logger?.info(`Syncing media group content for group ${mediaGroupId} from message ${sourceMessageId}`, { 
      correlation_id: correlationId,
      force,
      sync_edit_history: syncEditHistory
    });
    
    // Call the database function directly
    const { data, error } = await client.rpc('xdelo_sync_media_group_content', {
      p_source_message_id: sourceMessageId,
      p_media_group_id: mediaGroupId,
      p_correlation_id: correlationId || crypto.randomUUID(),
      p_force_sync: force,
      p_sync_edit_history: syncEditHistory
    });
    
    if (error) {
      logger?.error(`Error syncing media group content: ${error.message}`, {
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId,
        correlation_id: correlationId,
        error
      });
      return { success: false, error: error.message };
    }
    
    logger?.info(`Media group content synced successfully: ${JSON.stringify(data)}`, {
      source_message_id: sourceMessageId,
      media_group_id: mediaGroupId,
      updated_count: data?.updated_count || 0
    });
    
    return { success: true, data };
  } catch (error: any) {
    logger?.error(`Exception in xdelo_syncMediaGroupContent: ${error.message}`, {
      source_message_id: sourceMessageId,
      media_group_id: mediaGroupId,
      correlation_id: correlationId,
      error
    });
    return { success: false, error: error.message };
  }
}
