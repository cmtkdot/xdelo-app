import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { Logger } from '../telegram-webhook/utils/logger.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

/**
 * Message interface for the media group sync function
 */
interface Message {
  id: string;
  telegram_message_id: number;
  chat_id: number;
  media_group_id?: string;
  caption?: string;
  analyzed_content?: any;
  processing_state: string;
}

/**
 * Media group sync result interface
 */
export interface MediaGroupSyncResult {
  success: boolean;
  messageId?: string;
  mediaGroupId?: string;
  syncedCount: number;
  sourceMessageId?: string;
  error?: string;
}

/**
 * Synchronize analyzed content across all messages in a media group
 * 
 * @param supabase Supabase client
 * @param message The current message being processed
 * @param logger Logger instance for tracing
 * @param analyzedContent Optional analyzed content to use (if not provided, tries to find from existing messages)
 * @returns Result of the synchronization operation
 */
export async function syncMediaGroup(
  supabase: SupabaseClient,
  message: Message,
  logger: Logger,
  analyzedContent?: any
): Promise<MediaGroupSyncResult> {
  // Validate media group ID
  if (!message.media_group_id) {
    logger.warn('Cannot sync media group - message is not part of a media group', {
      message_id: message.id
    });
    
    return {
      success: false,
      messageId: message.id,
      syncedCount: 0,
      error: 'Message is not part of a media group'
    };
  }
  
  try {
    // Get all messages in the media group
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('id, telegram_message_id, caption, analyzed_content, processing_state')
      .eq('media_group_id', message.media_group_id)
      .eq('chat_id', message.chat_id)
      .order('telegram_message_id', { ascending: true });
    
    if (groupError) {
      logger.error('Error fetching media group members', {
        error: groupError.message,
        media_group_id: message.media_group_id
      });
      
      return {
        success: false,
        messageId: message.id,
        mediaGroupId: message.media_group_id,
        syncedCount: 0,
        error: `Error fetching media group: ${groupError.message}`
      };
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      logger.warn('No media group members found', {
        media_group_id: message.media_group_id
      });
      
      return {
        success: false,
        messageId: message.id,
        mediaGroupId: message.media_group_id,
        syncedCount: 0,
        error: 'No media group members found'
      };
    }
    
    logger.info(`Found ${groupMessages.length} messages in media group`, {
      media_group_id: message.media_group_id
    });
    
    // If no analyzed content provided, find a message with completed analysis to use as source
    let sourceMessage: Message | undefined;
    let contentToSync = analyzedContent;
    
    if (!contentToSync) {
      // First try to find a message with completed analysis
      sourceMessage = groupMessages.find(msg => 
        msg.processing_state === 'completed' && 
        msg.analyzed_content && 
        Object.keys(msg.analyzed_content).length > 0
      );
      
      if (sourceMessage) {
        contentToSync = sourceMessage.analyzed_content;
        logger.info('Using existing analyzed content from media group', {
          source_message_id: sourceMessage.id
        });
      } else {
        // No completed analysis found
        logger.warn('No analyzed content found in media group', {
          media_group_id: message.media_group_id
        });
        
        return {
          success: false,
          messageId: message.id,
          mediaGroupId: message.media_group_id,
          syncedCount: 0,
          error: 'No analyzed content available in media group'
        };
      }
    } else {
      sourceMessage = message;
      logger.info('Using provided analyzed content for media group sync', {
        source_message_id: message.id
      });
    }
    
    // Add media group metadata to the content
    const contentWithMetadata = {
      ...contentToSync,
      media_group_metadata: {
        group_message_count: groupMessages.length,
        sync_timestamp: new Date().toISOString(),
        source_message_id: sourceMessage?.id,
        original_caption_message_id: groupMessages.find(msg => !!msg.caption)?.id,
        is_original_caption: sourceMessage?.id === groupMessages.find(msg => !!msg.caption)?.id
      }
    };
    
    // Update all messages in the group except the source
    const syncPromises = groupMessages
      .filter(msg => msg.id !== sourceMessage?.id)
      .map(async (msg) => {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: contentWithMetadata,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', msg.id);
          
        if (updateError) {
          logger.error(`Failed to sync message ${msg.id}`, {
            error: updateError.message
          });
          return false;
        }
        
        return true;
      });
    
    // Wait for all updates to complete
    const syncResults = await Promise.all(syncPromises);
    const syncedCount = syncResults.filter(Boolean).length;
    
    // Log the sync operation
    await xdelo_logProcessingEvent(
      'media_group_sync_completed',
      sourceMessage?.id || message.id,
      logger.correlationId,
      {
        media_group_id: message.media_group_id,
        synced_count: syncedCount,
        total_count: groupMessages.length,
        source_message_id: sourceMessage?.id
      }
    );
    
    return {
      success: syncedCount > 0,
      messageId: message.id,
      mediaGroupId: message.media_group_id,
      syncedCount,
      sourceMessageId: sourceMessage?.id
    };
  } catch (error) {
    logger.error('Error synchronizing media group', {
      error: error.message,
      media_group_id: message.media_group_id
    });
    
    return {
      success: false,
      messageId: message.id,
      mediaGroupId: message.media_group_id,
      syncedCount: 0,
      error: `Sync error: ${error.message}`
    };
  }
} 