import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  TelegramMessage, 
  WebhookResponse, 
  OtherMessageData, 
  TelegramChatType, 
  TelegramOtherMessageType, 
  MessageData, 
  ChatInfo, 
  MediaInfo,
  AnalyzedContent,
  ProcessingStateType
} from "../types.ts";
import { getLogger } from "./logger.ts";
import { extractMediaInfo, downloadAndStoreMedia } from "./mediaUtils.ts";
import { analyzeCaption } from "./captionAnalyzer.ts";
import { 
  findMessageByFileUniqueId, 
  handleEditedCaption, 
  syncMediaGroupContent 
} from "./dbOperations.ts";

function determineMessageType(message: TelegramMessage): TelegramOtherMessageType {
  if (message.text?.startsWith('/')) return 'command';
  if (message.text) return 'text';
  if (message.sticker) return 'sticker';
  if (message.voice) return 'voice';
  if (message.document) return 'document';
  if (message.location) return 'location';
  if (message.contact) return 'contact';
  if (message.venue) return 'venue';
  if (message.poll) return 'poll';
  if (message.dice) return 'dice';
  if (message.game) return 'game';
  if (message.callback_query) return 'callback_query';
  if (message.inline_query) return 'inline_query';
  return 'text';
}

export function extractChatInfo(message: TelegramMessage): ChatInfo {
  return {
    chat_id: message.chat.id,
    chat_type: message.chat.type as TelegramChatType,
    chat_title: message.chat.title || ''
  };
}

export async function handleEditedMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  const mediaInfo = extractMediaInfo(message);
  const isChannelPost = Boolean(message.chat?.type === 'channel');

  try {
    if (mediaInfo) {
      // For media messages, find by file_unique_id and update
      const existingMessage = await findMessageByFileUniqueId(supabase, mediaInfo.file_unique_id);
      
      if (!existingMessage) {
        logger.warn('Edited message not found in database', {
          file_unique_id: mediaInfo.file_unique_id,
          message_id: message.message_id,
          chat_id: message.chat.id
        });
        // Process as a new message
        return await handleMediaMessage(supabase, message, correlationId);
      }

      // Store edit history
      const editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_content: existingMessage.telegram_data || {},
        new_content: { message }
      });

      // Special handling for edited captions
      if (message.caption !== existingMessage.caption) {
        logger.info('Caption edited, processing for analysis', {
          message_id: existingMessage.id,
          old_caption: existingMessage.caption,
          new_caption: message.caption,
          is_channel_post: isChannelPost
        });
        
        // Analyze the new caption
        const analyzedContent = await analyzeCaption(message.caption || '', correlationId);
        
        // Update the message and sync to media group if needed
        await handleEditedCaption(
          supabase,
          existingMessage.id || '',  // Ensure id is a string
          message.caption || '',
          correlationId,
          analyzedContent,
          existingMessage.media_group_id
        );
        
        return {
          success: true,
          message: "Edited caption processed successfully",
          correlation_id: correlationId,
          details: {
            message_id: existingMessage.id,
            is_channel_post: isChannelPost,
            has_media_group: Boolean(existingMessage.media_group_id)
          }
        };
      }

      // For other edits, process through media flow with edit history
      const editedMessage = {
        ...message,
        edit_history: editHistory,
        edit_date: message.edit_date
      };
      return await handleMediaMessage(supabase, editedMessage, correlationId);
    }

    // For non-media edits, handle in other_messages
    const messageType = determineMessageType(message);
    const { data: existingMessage } = await supabase
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    const editHistory = existingMessage?.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_content: existingMessage?.telegram_data || {},
      new_content: { message }
    });

    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: messageType,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title || '',
      message_text: message.text || '',
      is_edited: true,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
      processing_state: 'completed',
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      processing_correlation_id: correlationId,
      telegram_data: {
        message,
        message_type: messageType,
        edit_history: editHistory,
        content: {
          text: message.text,
          sticker: message.sticker,
          voice: message.voice,
          document: message.document,
          location: message.location,
          contact: message.contact
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (existingMessage) {
      const { error: updateError } = await supabase
        .from('other_messages')
        .update(messageData)
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      logger.info('Updated existing other message with edit', { 
        messageId: existingMessage.id,
        messageType
      });
      
      return {
        success: true,
        message: 'Updated existing other message with edit',
        correlation_id: correlationId,
        details: { 
          message_id: existingMessage.id,
          message_type: messageType
        }
      };
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Created new edited other message', { 
      messageId: newMessage.id,
      messageType
    });
    
    return {
      success: true,
      message: 'Created new edited other message',
      correlation_id: correlationId,
      details: { 
        message_id: newMessage.id,
        message_type: messageType
      }
    };

  } catch (error) {
    logger.error('Failed to handle edited message', { error });
    return {
      success: false,
      message: 'Failed to handle edited message',
      error: error.message,
      correlation_id: correlationId
    };
  }
}

export async function handleOtherMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  
  try {
    // Check if this is a media message first
    const mediaInfo = extractMediaInfo(message);
    if (mediaInfo) {
      return await handleMediaMessage(supabase, message, correlationId);
    }

    const messageType = determineMessageType(message);
    // Check if this is a text message that might need analysis
    let analyzedContent: AnalyzedContent | undefined = undefined;
    let processingState: ProcessingStateType = 'completed';
    
    if (messageType === 'text' && message.text && message.text.length > 0) {
      // Check if the text looks like a product description
      const hasProductPattern = message.text.includes('#') || 
                               /x\s*\d+/i.test(message.text) || 
                               message.text.includes('product') ||
                               message.text.includes('item');
      
      if (hasProductPattern) {
        logger.info('Text message might contain product information, analyzing', {
          messageId: message.message_id,
          textLength: message.text.length
        });
        
        // Analyze the text
        analyzedContent = await analyzeCaption(message.text, correlationId);
        processingState = 'completed';
      }
    }
    
    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: messageType,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title || '',
      message_text: message.text || '',
      is_edited: Boolean(message.edit_date),
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
      processing_state: processingState,
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      analyzed_content: analyzedContent,
      telegram_data: {
        message,
        message_type: messageType,
        content: {
          text: message.text,
          sticker: message.sticker,
          voice: message.voice,
          document: message.document,
          location: message.location,
          contact: message.contact
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Special handling for commands
    if (messageType === 'command') {
      const command = message.text?.split(' ')[0].substring(1);
      messageData.telegram_data.command = {
        name: command,
        args: message.text?.split(' ').slice(1) || []
      };
    }

    // Special handling for voice messages
    if (message.voice) {
      messageData.telegram_data.voice = {
        file_id: message.voice.file_id,
        duration: message.voice.duration,
        mime_type: message.voice.mime_type
      };
    }

    // Special handling for documents
    if (message.document) {
      messageData.telegram_data.document = {
        file_id: message.document.file_id,
        file_name: message.document.file_name,
        mime_type: message.document.mime_type
      };
    }

    // Check for existing message
    const { data: existingMessage } = await supabase
      .from('other_messages')
      .select('*')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (existingMessage) {
      const { error: updateError } = await supabase
        .from('other_messages')
        .update(messageData)
        .eq('id', existingMessage.id);

      if (updateError) throw updateError;

      // Log state change
      await supabase.from('message_state_logs').insert({
        message_id: existingMessage.id,
        previous_state: existingMessage.processing_state,
        new_state: 'completed',
        changed_at: new Date().toISOString()
      });

      logger.info('Updated existing other message', { 
        messageId: existingMessage.id,
        messageType
      });
      
      return {
        success: true,
        message: 'Updated existing other message',
        correlation_id: correlationId,
        details: { 
          message_id: existingMessage.id,
          message_type: messageType
        }
      };
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;

    // Log initial state
    await supabase.from('message_state_logs').insert({
      message_id: newMessage.id,
      previous_state: null,
      new_state: 'completed',
      changed_at: new Date().toISOString()
    });

    // Log webhook event
    await supabase.from('webhook_logs').insert({
      event_type: messageType,
      chat_id: message.chat.id,
      message_id: message.message_id,
      correlation_id: correlationId
    });

    logger.info('Created new other message', { 
      messageId: newMessage.id,
      messageType
    });
    
    return {
      success: true,
      message: 'Created new other message',
      correlation_id: correlationId,
      details: { 
        message_id: newMessage.id,
        message_type: messageType
      }
    };

  } catch (error) {
    logger.error('Failed to handle other message', { error });

    // Log error in webhook_logs
    await supabase.from('webhook_logs').insert({
      event_type: 'error',
      chat_id: message.chat.id,
      message_id: message.message_id,
      error_message: error.message,
      correlation_id: correlationId
    });

    return {
      success: false,
      message: 'Failed to handle other message',
      error: error.message,
      correlation_id: correlationId
    };
  }
}

export async function handleChatMemberUpdate(
  supabase: SupabaseClient,
  memberUpdate: {
    chat: {
      id: number;
      type: TelegramChatType;
      title?: string;
    };
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    my_chat_member?: boolean;
    old_chat_member?: {
      status: string;
      user: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
      };
    };
    new_chat_member?: {
      status: string;
      user: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
      };
    };
    edited_message?: TelegramMessage;
    edited_channel_post?: TelegramMessage;
  },
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  
  try {
    // First check if this is an edit to a media message
    if (memberUpdate.edited_message || memberUpdate.edited_channel_post) {
      const editedMessage = memberUpdate.edited_message || memberUpdate.edited_channel_post;
      if (editedMessage) {
        return await handleEditedMessage(supabase, editedMessage, correlationId);
      }
    }

    const messageData: OtherMessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: 'chat_member',
      telegram_message_id: Date.now(),
      chat_id: memberUpdate.chat.id,
      chat_type: memberUpdate.chat.type as TelegramChatType,
      chat_title: memberUpdate.chat.title || '',
      is_edited: false,
      processing_state: 'completed',
      processing_correlation_id: correlationId,
      telegram_data: {
        memberUpdate,
        update_type: memberUpdate.my_chat_member ? 'my_chat_member' : 'chat_member',
        old_status: memberUpdate.old_chat_member?.status,
        new_status: memberUpdate.new_chat_member?.status,
        user: memberUpdate.from
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: newMessage, error: insertError } = await supabase
      .from('other_messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) throw insertError;

    logger.info('Created new chat member update', { 
      messageId: newMessage.id,
      updateType: messageData.telegram_data.update_type
    });
    
    return {
      success: true,
      message: 'Created new chat member update',
      correlation_id: correlationId,
      details: { 
        message_id: newMessage.id,
        update_type: messageData.telegram_data.update_type
      }
    };

  } catch (error) {
    logger.error('Failed to handle chat member update', { error });
    return {
      success: false,
      message: 'Failed to handle chat member update',
      error: error.message,
      correlation_id: correlationId
    };
  }
}

export async function handleMediaMessage(
  supabase: SupabaseClient,
  message: TelegramMessage,
  correlationId: string
): Promise<WebhookResponse> {
  const logger = getLogger(correlationId);
  
  try {
    const chatInfo = extractChatInfo(message);
    const mediaInfo = extractMediaInfo(message);
    
    if (!mediaInfo) {
      throw new Error("No media found in message");
    }

    // Determine default mime type based on media type
    const defaultMimeType = message.photo ? 'image/jpeg' : 
                          message.video ? 'video/mp4' : 
                          'application/octet-stream';

    // Use the actual mime type or fall back to default
    const mimeType = mediaInfo.mime_type || defaultMimeType;
    
    // Check for existing message
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", mediaInfo.file_unique_id)
      .maybeSingle();

    // Download and store media
    const mediaResult = await downloadAndStoreMedia(message, supabase, correlationId);
    
    if (!mediaResult) {
      throw new Error("Failed to process media");
    }
    
    const { publicUrl, storagePath } = mediaResult;

    const messageData: MessageData = {
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      telegram_message_id: message.message_id,
      chat_id: chatInfo.chat_id,
      chat_type: chatInfo.chat_type,
      chat_title: chatInfo.chat_title,
      media_group_id: message.media_group_id,
      caption: message.caption || "",
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      public_url: publicUrl,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      media_type: mediaInfo.media_type || (message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : message.voice ? 'voice' : undefined),
      telegram_data: { message },
      processing_state: message.caption ? "pending" : "initialized",
      processing_correlation_id: correlationId,
      is_original_caption: Boolean(message.caption),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let messageId: string;

    if (existingMessage) {
      // For existing messages, preserve important fields
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          ...messageData,
          retry_count: existingMessage.retry_count,
          analyzed_content: existingMessage.analyzed_content,
          // Preserve group sync status if already synced
          group_caption_synced: existingMessage.group_caption_synced,
          message_caption_id: existingMessage.message_caption_id
        })
        .eq("id", existingMessage.id);

      if (updateError) throw updateError;
      messageId = existingMessage.id;
      
      logger.info('Updated existing message', { 
        messageId,
        hasCaption: Boolean(message.caption),
        inMediaGroup: Boolean(message.media_group_id)
      });
    } else {
      const { data: newMessage, error: insertError } = await supabase
        .from("messages")
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      messageId = newMessage.id;
      
      logger.info('Created new message', { 
        messageId,
        hasCaption: Boolean(message.caption),
        inMediaGroup: Boolean(message.media_group_id)
      });
    }

    // Handle media group syncing and analysis
    if (message.media_group_id) {
      if (!message.caption) {
        // For messages without caption, check if any message in the group has analyzed content
        const { data: analyzedGroupMessages, error: groupQueryError } = await supabase
          .from("messages")
          .select("id, analyzed_content")
          .eq("media_group_id", message.media_group_id)
          .not("analyzed_content", "is", null)
          .eq("processing_state", "completed")
          .order("created_at", { ascending: true })
          .limit(1);

        if (groupQueryError) {
          logger.error('Error checking group messages for analysis', {
            error: groupQueryError,
            mediaGroupId: message.media_group_id
          });
          throw groupQueryError;
        }

        if (analyzedGroupMessages?.[0]) {
          // Use existing analyzed content from group
          const sourceMessage = analyzedGroupMessages[0];
          logger.info('Found existing analyzed content in group', {
            messageId,
            sourceMessageId: sourceMessage.id,
            mediaGroupId: message.media_group_id
          });

          await supabase
            .from("messages")
            .update({
              analyzed_content: sourceMessage.analyzed_content,
              message_caption_id: sourceMessage.id,
              processing_state: "completed",
              processing_completed_at: new Date().toISOString(),
              group_caption_synced: true
            })
            .eq("id", messageId);
        }
      }
      // If message has caption, trigger analysis
      else {
        // Analyze caption and update message
        logger.info('Triggering analysis for media group message', { 
          messageId, 
          mediaGroupId: message.media_group_id 
        });
        
        const analyzedContent = await analyzeCaption(message.caption, correlationId);
        
        // Update source message
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            is_original_caption: true,
            message_caption_id: messageId,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
        
        // Sync to other messages in the group
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            group_caption_synced: true,
            message_caption_id: messageId,
            is_original_caption: false,
            updated_at: new Date().toISOString()
          })
          .eq('media_group_id', message.media_group_id)
          .neq('id', messageId);
      }
    } else if (message.caption) {
      // Single message with caption - analyze directly
      logger.info('Triggering analysis for single message', { messageId });
      
      const analyzedContent = await analyzeCaption(message.caption, correlationId);
      
      await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }

    return {
      success: true,
      message: "Media processed successfully",
      correlation_id: correlationId,
      details: {
        message_id: messageId,
        public_url: publicUrl,
        media_group_id: message.media_group_id,
        mime_type: mimeType,
        has_caption: Boolean(message.caption),
        processing_state: messageData.processing_state
      }
    };

  } catch (error) {
    logger.error("Error handling media message", { error });
    return {
      success: false,
      message: "Error handling media message",
      error: error.message,
      correlation_id: correlationId
    };
  }
}
