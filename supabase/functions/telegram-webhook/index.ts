import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { xdelo_processMessageMedia } from "../_shared/mediaUtils.ts";
import { MessageContext, MessageInput, TelegramMessage } from "../_shared/types.ts";
import {
  checkMessageExists,
  constructMessageUrl,
  corsHeaders,
  extractForwardInfo,
  formatErrorResponse,
  formatSuccessResponse,
  logEvent,
  supabase as supabaseClient
} from "../_shared/utils.ts";

/**
 * Handler for new media messages (photos, videos, documents)
 */
async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Check for duplicate
    const isDuplicate = await checkMessageExists(message.chat.id, message.message_id);
    if (isDuplicate) {
      console.log(`Duplicate message detected: ${message.chat.id}_${message.message_id}`);
      return formatSuccessResponse({ 
        message: "Duplicate message detected and skipped",
      }, correlationId);
    }
    
    // Generate message URL
    const messageUrl = constructMessageUrl(message.chat.id, message.message_id);
    
    // Process based on media type
    let fileId = '', fileUniqueId = '', width, height, duration, mimeType, fileSize;
    
    // Handle photos (use the largest size)
    if (message.photo) {
      const largestPhoto = message.photo[message.photo.length - 1];
      fileId = largestPhoto.file_id;
      fileUniqueId = largestPhoto.file_unique_id;
      width = largestPhoto.width;
      height = largestPhoto.height;
      fileSize = largestPhoto.file_size;
    } 
    // Handle videos
    else if (message.video) {
      fileId = message.video.file_id;
      fileUniqueId = message.video.file_unique_id;
      width = message.video.width;
      height = message.video.height;
      duration = message.video.duration;
      mimeType = message.video.mime_type;
      fileSize = message.video.file_size;
    } 
    // Handle documents
    else if (message.document) {
      fileId = message.document.file_id;
      fileUniqueId = message.document.file_unique_id;
      mimeType = message.document.mime_type;
      fileSize = message.document.file_size;
    }
    
    // Check if message is forwarded
    const forwardInfo = extractForwardInfo(message);
    
    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption || '',
      file_id: fileId,
      file_unique_id: fileUniqueId,
      media_group_id: message.media_group_id,
      mime_type: mimeType,
      file_size: fileSize,
      width,
      height,
      duration,
      processing_state: 'initialized',
      telegram_data: message,
      is_forward: forwardInfo.isForwarded,
      correlation_id: correlationId,
      message_url: messageUrl
    };
    
    // Include edit information if this is an edit
    if (context.isEdit) {
      messageInput.processing_state = 'pending';
    }
    
    // Create message record
    const { data, error } = await supabaseClient
      .from("messages")
      .insert(messageInput)
      .select('id')
      .single();
    
    if (error || !data) {
      console.error(`Failed to store media message in database: ${error?.message}`);
      
      await logEvent(
        "media_message_error",
        "system",
        correlationId,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          error: error?.message
        },
        error?.message
      );
      
      return formatErrorResponse(
        error?.message || 'Failed to create message record',
        correlationId
      );
    }
    
    const messageId = data.id;
    
    // Process media (download from Telegram and upload to storage)
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!telegramBotToken) {
      console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
      
      await logEvent(
        "media_processing_error",
        messageId,
        correlationId,
        {
          error: 'Missing TELEGRAM_BOT_TOKEN environment variable'
        },
        'Missing TELEGRAM_BOT_TOKEN environment variable'
      );
    } else {
      try {
        console.log(`Processing media for message ${message.message_id}, file ID: ${fileId}`);
        
        // Call the media processing function
        const mediaResult = await xdelo_processMessageMedia(
          message,
          fileId,
          fileUniqueId,
          telegramBotToken,
          messageId
        );
        
        if (mediaResult.success) {
          console.log(`Successfully processed media for message ${message.message_id}`);
          
          // If not already handled by processMessageMedia, update message with storage info
          if (!mediaResult.isDuplicate) {
            await supabaseClient
              .from("messages")
              .update({
                storage_path: mediaResult.fileInfo.storage_path,
                public_url: mediaResult.fileInfo.public_url,
                mime_type: mediaResult.fileInfo.mime_type,
                mime_type_verified: true,
                storage_exists: true,
                storage_path_standardized: true
              })
              .eq('id', messageId);
          }
          
          await logEvent(
            "media_processing_completed",
            messageId,
            correlationId,
            {
              storage_path: mediaResult.fileInfo.storage_path,
              public_url: mediaResult.fileInfo.public_url,
              is_duplicate: mediaResult.isDuplicate
            }
          );
        } else {
          console.error(`Failed to process media: ${mediaResult.error}`);
          
          await logEvent(
            "media_processing_error",
            messageId,
            correlationId,
            {
              error: mediaResult.error
            },
            mediaResult.error
          );
        }
      } catch (mediaError) {
        console.error(`Error processing media: ${mediaError.message}`);
        
        await logEvent(
          "media_processing_error",
          messageId,
          correlationId,
          {
            error: mediaError.message
          },
          mediaError.message
        );
      }
    }
    
    // Log successful message creation
    await logEvent(
      context.isEdit ? "edited_media_message_created" : "media_message_created",
      messageId,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
        media_group_id: message.media_group_id,
        message_url: messageUrl,
        is_edit: context.isEdit
      }
    );
    
    // If part of a media group, handle group-specific logic
    if (message.media_group_id) {
      console.log(`Media message ${message.message_id} is part of group ${message.media_group_id}`);
      
      // Mark as pending for processing
      await supabaseClient
        .from("messages")
        .update({ processing_state: 'pending' })
        .eq('id', messageId);
    } else if (message.caption) {
      // If message has caption and not part of a group, mark it for processing
      await supabaseClient
        .from("messages")
        .update({ processing_state: 'pending' })
        .eq('id', messageId);
    } else if (!context.isEdit) { // Only mark as completed if not an edit
      // Otherwise mark as completed since no processing is needed
      await supabaseClient
        .from("messages")
        .update({ 
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return formatSuccessResponse({ 
      messageId, 
      message_url: messageUrl, 
      is_edit: context.isEdit
    }, correlationId);
  } catch (error) {
    console.error(`Error processing media message: ${error.message}`);
    
    // Log the error
    await logEvent(
      "media_message_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message,
        is_edit: context.isEdit
      },
      error.message
    );
    
    return formatErrorResponse(
      error.message || 'Unknown error processing media message',
      context.correlationId
    );
  }
}

/**
 * Handler for text messages
 */
async function handleTextMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Check for duplicate
    const isDuplicate = await checkMessageExists(message.chat.id, message.message_id);
    if (isDuplicate) {
      console.log(`Duplicate text message detected: ${message.chat.id}_${message.message_id}`);
      return formatSuccessResponse({ 
        message: "Duplicate message detected and skipped",
      }, correlationId);
    }
    
    // Generate message URL
    const messageUrl = constructMessageUrl(message.chat.id, message.message_id);
    
    // Check if message is forwarded
    const forwardInfo = extractForwardInfo(message);
    
    // Create message input
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      text: message.text || '',
      processing_state: context.isEdit ? 'pending' : 'completed', // Processed messages need reprocessing, but new text messages don't
      telegram_data: message,
      is_forward: forwardInfo.isForwarded,
      correlation_id: correlationId,
      message_url: messageUrl
    };
    
    // Create message record
    const { data, error } = await supabaseClient
      .from("messages")
      .insert(messageInput)
      .select('id')
      .single();
    
    if (error || !data) {
      console.error(`Failed to store text message in database: ${error?.message}`);
      
      await logEvent(
        "text_message_error",
        "system",
        correlationId,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          error: error?.message,
          is_edit: context.isEdit
        },
        error?.message
      );
      
      return formatErrorResponse(
        error?.message || 'Failed to create message record',
        correlationId
      );
    }
    
    const messageId = data.id;
    
    // Log successful processing
    await logEvent(
      context.isEdit ? "edited_text_message_created" : "text_message_created",
      messageId,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_url: messageUrl,
        is_edit: context.isEdit
      }
    );
    
    return formatSuccessResponse({ 
      messageId, 
      message_url: messageUrl,
      is_edit: context.isEdit
    }, correlationId);
  } catch (error) {
    console.error(`Error processing text message: ${error.message}`);
    
    // Log the error
    await logEvent(
      "text_message_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message,
        is_edit: context.isEdit
      },
      error.message
    );
    
    return formatErrorResponse(
      error.message || 'Unknown error processing text message',
      context.correlationId
    );
  }
}

/**
 * Handler for edited messages
 */
async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId } = context;
    
    // Check if this is a media message first
    const isMediaMessage = !!(message.photo || message.video || message.document);
    
    // Find the existing message in our database
    const { data: existingMessage, error: findError } = await supabaseClient
      .from("messages")
      .select("id, processing_state, analyzed_content, media_group_id, text, caption, edit_count, file_id, file_unique_id")
      .eq("chat_id", message.chat.id)
      .eq("telegram_message_id", message.message_id)
      .maybeSingle();
    
    // Get message URL
    const messageUrl = constructMessageUrl(message.chat.id, message.message_id);
    
    // If existing message found, update it
    if (existingMessage && !findError) {
      console.log(`Found existing message ${existingMessage.id} for edit`);
      
      // Store previous state in edit_history
      const editHistory = existingMessage.edit_history || [];
      editHistory.push({
        timestamp: new Date().toISOString(),
        previous_text: existingMessage.text,
        previous_caption: existingMessage.caption,
        new_text: message.text,
        new_caption: message.caption,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
      });
      
      // Prepare update data
      const messageData: Record<string, any> = {
        text: message.text || existingMessage.text,
        caption: message.caption || existingMessage.caption,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        edit_history: editHistory,
        edit_count: (existingMessage.edit_count || 0) + 1,
        is_edited: true,
        updated_at: new Date().toISOString()
      };
      
      // Check if content has changed and needs reprocessing
      const contentChanged = (
        (existingMessage.caption !== messageData.caption) || 
        (existingMessage.text !== messageData.text)
      );
      
      // Check if media has changed (by comparing file_id)
      let mediaChanged = false;
      if (isMediaMessage) {
        let currentFileId = '';
        if (message.photo) {
          const largestPhoto = message.photo[message.photo.length - 1];
          currentFileId = largestPhoto.file_id;
        } else if (message.video) {
          currentFileId = message.video.file_id;
        } else if (message.document) {
          currentFileId = message.document.file_id;
        }
        
        // Media is considered changed if file_id is different
        mediaChanged = currentFileId !== existingMessage.file_id;
        
        if (mediaChanged) {
          console.log(`Media has changed for message ${message.message_id}: previous=${existingMessage.file_id}, current=${currentFileId}`);
          
          // Update file_id and file_unique_id
          if (message.photo) {
            const largestPhoto = message.photo[message.photo.length - 1];
            messageData.file_id = largestPhoto.file_id;
            messageData.file_unique_id = largestPhoto.file_unique_id;
            messageData.width = largestPhoto.width;
            messageData.height = largestPhoto.height;
            messageData.file_size = largestPhoto.file_size;
          } else if (message.video) {
            messageData.file_id = message.video.file_id;
            messageData.file_unique_id = message.video.file_unique_id;
            messageData.width = message.video.width;
            messageData.height = message.video.height;
            messageData.duration = message.video.duration;
            messageData.mime_type = message.video.mime_type;
            messageData.file_size = message.video.file_size;
          } else if (message.document) {
            messageData.file_id = message.document.file_id;
            messageData.file_unique_id = message.document.file_unique_id;
            messageData.mime_type = message.document.mime_type;
            messageData.file_size = message.document.file_size;
          }
        }
      }
      
      if (contentChanged || mediaChanged) {
        // Store previous analyzed content
        if (existingMessage.analyzed_content) {
          messageData.old_analyzed_content = existingMessage.old_analyzed_content || [];
          messageData.old_analyzed_content.push(existingMessage.analyzed_content);
        }
        
        // Reset analysis state
        messageData.analyzed_content = null;
        messageData.processing_state = 'pending';
        messageData.group_caption_synced = false;
      }
      
      // Update the message
      const { error: updateError } = await supabaseClient
        .from("messages")
        .update(messageData)
        .eq("id", existingMessage.id);
        
      if (updateError) {
        console.error(`Error updating edited message: ${updateError.message}`);
        return formatErrorResponse(updateError.message, correlationId);
      }
      
      // Process media if it changed
      if (isMediaMessage && mediaChanged) {
        const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        if (telegramBotToken) {
          try {
            console.log(`Processing updated media for message ${message.message_id}`);
            
            // Process updated media
            let fileId = '', fileUniqueId = '';
            if (message.photo) {
              const largestPhoto = message.photo[message.photo.length - 1];
              fileId = largestPhoto.file_id;
              fileUniqueId = largestPhoto.file_unique_id;
            } else if (message.video) {
              fileId = message.video.file_id;
              fileUniqueId = message.video.file_unique_id;
            } else if (message.document) {
              fileId = message.document.file_id;
              fileUniqueId = message.document.file_unique_id;
            }
            
            // Call the media processing function
            const mediaResult = await xdelo_processMessageMedia(
              message,
              fileId,
              fileUniqueId,
              telegramBotToken,
              existingMessage.id
            );
            
            if (mediaResult.success) {
              console.log(`Successfully processed updated media for message ${message.message_id}`);
              
              // Log the media update
              await logEvent(
                "media_update_completed",
                existingMessage.id,
                correlationId,
                {
                  storage_path: mediaResult.fileInfo.storage_path,
                  public_url: mediaResult.fileInfo.public_url,
                  is_duplicate: mediaResult.isDuplicate
                }
              );
            } else {
              console.error(`Failed to process updated media: ${mediaResult.error}`);
              
              await logEvent(
                "media_update_error",
                existingMessage.id,
                correlationId,
                {
                  error: mediaResult.error
                },
                mediaResult.error
              );
            }
          } catch (mediaError) {
            console.error(`Error processing updated media: ${mediaError.message}`);
            
            await logEvent(
              "media_update_error",
              existingMessage.id,
              correlationId,
              {
                error: mediaError.message
              },
              mediaError.message
            );
          }
        }
      }
      
      // Log the edit operation
      await logEvent(
        "message_edited",
        existingMessage.id,
        correlationId,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          content_changed: contentChanged,
          media_changed: mediaChanged
        }
      );
      
      return formatSuccessResponse({ 
        messageId: existingMessage.id, 
        action: 'updated',
        content_changed: contentChanged,
        media_changed: mediaChanged
      }, correlationId);
    } 
    // If message not found, create a new one
    else {
      console.log(`Original message not found, creating new record for edited message ${message.message_id}`);
      
      // If media message, use media handler
      if (isMediaMessage) {
        console.log(`Routing edited media message ${message.message_id} to media handler`);
        return handleMediaMessage(message, context);
      } else {
        console.log(`Routing edited text message ${message.message_id} to text handler`);
        return handleTextMessage(message, context);
      }
    }
  } catch (error) {
    console.error(`Error processing edited message: ${error.message}`);
    
    // Log the error
    await logEvent(
      "edited_message_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        error: error.message
      },
      error.message
    );
    
    return formatErrorResponse(
      error.message || 'Unknown error processing edited message',
      context.correlationId
    );
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = crypto.randomUUID().toString();
    
    // Log webhook received event
    console.log(`Webhook received: ${req.method} ${req.url} [${correlationId}]`);
    
    await logEvent(
      "webhook_received",
      "system",
      correlationId,
      {
        source: "telegram-webhook",
        timestamp: new Date().toISOString()
      }
    );

    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      console.log(`Received Telegram update ${update.update_id}`);
    } catch (error) {
      return formatErrorResponse('Invalid JSON in request body', correlationId, 400);
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      console.warn('No processable content in update');
      return formatErrorResponse("No processable content", correlationId, 400);
    }

    // Determine message context
    const context: MessageContext = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: extractForwardInfo(message).isForwarded || false,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      startTime: new Date().toISOString()
    };

    // Log message details
    console.log(`Processing message ${message.message_id} in chat ${message.chat?.id}`, {
      is_edit: context.isEdit,
      is_forwarded: context.isForwarded,
      has_media: !!(message.photo || message.video || message.document),
      has_caption: !!message.caption,
      has_text: !!message.text,
      media_group_id: message.media_group_id
    });

    // Handle different message types
    let response;
    
    try {
      // Handle edited messages
      if (context.isEdit) {
        console.log(`Routing to edited message handler for message ${message.message_id}`);
        response = await handleEditedMessage(message, context);
      }
      // Handle media messages (photos, videos, documents)
      else if (message.photo || message.video || message.document) {
        console.log(`Routing to media message handler for message ${message.message_id}`);
        response = await handleMediaMessage(message, context);
      }
      // Handle text messages
      else {
        console.log(`Routing to text message handler for message ${message.message_id}`);
        response = await handleTextMessage(message, context);
      }
      
      console.log(`Successfully processed message ${message.message_id}`, {
        processing_time_ms: new Date().getTime() - new Date(context.startTime).getTime()
      });
      
      return response;
    } catch (handlerError) {
      console.error(`Error in message handler: ${handlerError.message}`, { 
        stack: handlerError.stack,
        message_id: message.message_id
      });
      
      // Log the error to the database
      await logEvent(
        "message_processing_failed",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          is_edit: context.isEdit,
          has_media: !!(message.photo || message.video || message.document),
          error: handlerError.message
        },
        handlerError.message || "Unknown handler error"
      );
      
      // Return error response but with 200 status to acknowledge to Telegram
      return new Response(JSON.stringify({ 
        success: false, 
        error: handlerError.message,
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent Telegram from retrying
      });
    }
  } catch (error) {
    console.error(`Unhandled error processing webhook: ${error.message}`, {
      stack: error.stack
    });
    
    return formatErrorResponse(error.message || 'Unknown error', crypto.randomUUID().toString(), 500);
  }
});
