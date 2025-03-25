
import { corsHeaders } from "../utils/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { hasMedia } from "../index.ts";
import { handleMediaMessage } from "./mediaMessageHandler.ts";
import { extractCaption, hasCaption, prepareEditHistoryEntry } from "../utils/messageUtils.ts";
import { xdelo_logProcessingEvent } from "../utils/databaseOperations.ts";
import { supabaseClient } from "../utils/supabase.ts";

/**
 * Handle edited messages that don't contain media
 */
export async function handleEditedMessage(message: any, context: any) {
  try {
    const { isChannelPost, correlationId, logger } = context;
    
    // Check if the message has media - if it does, we should delegate to the media handler
    if (hasMedia(message)) {
      logger.info("Edited message contains media, delegating to media handler", {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      return await handleMediaMessage(message, context);
    }
    
    // Basic message parameters
    const telegramMessageId = message.message_id;
    const chatId = message.chat.id;
    const chatType = message.chat.type;
    const chatTitle = message.chat.title;
    const captionText = extractCaption(message);
    const editDate = message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString();
    
    logger.info("Processing edited non-media message", {
      message_id: telegramMessageId,
      chat_id: chatId,
      has_caption: hasCaption(message),
    });
    
    // Step 1: Check if message exists in database
    const { data: existingMessage, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId)
      .single();
    
    if (fetchError) {
      logger.error("Error finding existing message:", fetchError);
      
      // If the message doesn't exist, we should create a new record
      if (fetchError.code === 'PGRST116') {
        logger.info("Message not found, will be treated as new", {
          message_id: telegramMessageId,
          chat_id: chatId
        });
        
        // For text messages, we need to handle non-media edits in other_messages table
        const { data: otherData, error: otherError } = await supabaseClient
          .from('other_messages')
          .select('*')
          .eq('telegram_message_id', telegramMessageId)
          .eq('chat_id', chatId)
          .single();
          
        if (otherError) {
          if (otherError.code === 'PGRST116') {
            logger.info("Text message not found, creating new entry", {
              message_id: telegramMessageId,
              chat_id: chatId
            });
            
            // Create a new text message entry
            await supabaseClient.from('other_messages').insert({
              telegram_message_id: telegramMessageId,
              chat_id: chatId,
              chat_type: chatType,
              chat_title: chatTitle,
              message_type: 'text',
              message_text: message.text,
              is_edited: true,
              edit_date: editDate,
              edit_history: [{
                timestamp: new Date().toISOString(),
                edit_date: editDate,
                edit_source: 'telegram_edit',
                change_type: 'text',
                previous_text: null, // We don't have the previous version
                new_text: message.text
              }],
              edit_count: 1,
              telegram_data: message,
              correlation_id: correlationId
            });
            
            return new Response(
              JSON.stringify({ success: true, message: "New text message created from edit" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          logger.error("Error fetching other_messages:", otherError);
          return new Response(
            JSON.stringify({ error: `Database error: ${otherError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Update the existing other_message
        const editHistory = otherData.edit_history || [];
        editHistory.push({
          timestamp: new Date().toISOString(),
          edit_date: editDate,
          edit_source: 'telegram_edit',
          change_type: 'text',
          previous_text: otherData.message_text,
          new_text: message.text
        });
        
        await supabaseClient
          .from('other_messages')
          .update({
            message_text: message.text,
            is_edited: true,
            edit_date: editDate,
            edit_history: editHistory,
            edit_count: (otherData.edit_count || 0) + 1,
            telegram_data: message,
            updated_at: new Date().toISOString()
          })
          .eq('id', otherData.id);
          
        return new Response(
          JSON.stringify({ success: true, message: "Text message updated" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Database error: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Found existing message to update", {
      message_id: telegramMessageId,
      database_id: existingMessage.id,
      media_group_id: existingMessage.media_group_id
    });
    
    // Step 2: Prepare edit history
    const editHistory = existingMessage.edit_history || [];
    let changeType: 'caption' | 'text_to_media' | 'media_to_text' = 'caption';
    
    if (hasCaption(message) && !existingMessage.caption) {
      changeType = 'text_to_media';
    } else if (!hasCaption(message) && existingMessage.caption) {
      changeType = 'media_to_text';
    }
    
    const historyEntry = prepareEditHistoryEntry(existingMessage, message, changeType);
    editHistory.push(historyEntry);
    
    // Step 3: Update the message
    const updateData: Record<string, any> = {
      caption: captionText,
      is_edited: true,
      edit_date: editDate,
      edit_history: editHistory,
      edit_count: (existingMessage.edit_count || 0) + 1,
      telegram_data: message,
      updated_at: new Date().toISOString(),
      // Reset the processing state to trigger reprocessing of the caption
      processing_state: 'pending',
      correlation_id: correlationId
    };
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('id', existingMessage.id);
      
    if (updateError) {
      logger.error("Error updating message:", updateError);
      return new Response(
        JSON.stringify({ error: `Database update error: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Message updated successfully, now processing caption", {
      message_id: existingMessage.id,
      has_caption: hasCaption(message)
    });
    
    // Step 4: Directly process the caption and sync media group if needed using the unified processor
    if (hasCaption(message)) {
      // Instead of calling xdelo_processCaptionFromWebhook directly, we'll call the unified processor
      // Function via an edge function invoke
      try {
        // Call the unified processor edge function
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false
            }
          }
        );
        
        // Process caption
        const captionResult = await supabase.functions.invoke('xdelo_unified_processor', {
          body: {
            action: 'process_caption',
            messageId: existingMessage.id,
            correlationId: correlationId,
            force: true // Force reprocessing since it's an edit
          }
        });
        
        logger.info("Caption processing result", {
          success: captionResult.data?.success,
          error: captionResult.error,
          data: captionResult.data
        });
        
        // If this message is part of a media group, sync the group
        if (existingMessage.media_group_id) {
          const syncResult = await supabase.functions.invoke('xdelo_unified_processor', {
            body: {
              action: 'sync_media_group',
              mediaGroupId: existingMessage.media_group_id,
              sourceMessageId: existingMessage.id,
              correlationId: correlationId,
              forceSync: true,
              syncEditHistory: true
            }
          });
          
          logger.info("Media group sync result", {
            success: syncResult.data?.success,
            error: syncResult.error,
            data: syncResult.data
          });
        }
      } catch (error) {
        logger.error("Error invoking unified processor", {
          messageId: existingMessage.id,
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Edit processed successfully",
        messageId: existingMessage.id,
        hasCaption: hasCaption(message),
        mediaGroupId: existingMessage.media_group_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error handling edited message:", error);
    return new Response(
      JSON.stringify({ error: `Error handling edited message: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
