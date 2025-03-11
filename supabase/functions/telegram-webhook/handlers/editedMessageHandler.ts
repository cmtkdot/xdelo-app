import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { logMessageOperation } from '../utils/logger.ts';
import { xdelo_logMessageEdit } from '../../_shared/messageLogger.ts';

export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, previousMessage } = context;
    console.log(`Processing edited message ${message.message_id} in chat ${message.chat.id}, correlation_id: ${correlationId}`);
    
    if (!previousMessage) {
      throw new Error('Previous message is required for editing');
    }
    
    // Check if message has media
    if (message.photo || message.video || message.document) {
      console.log(`Edited message contains media, handling media edit`);
      
      // Find the existing message in our database
      const { data: existingMessage, error: messageError } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .single();
      
      if (messageError || !existingMessage) {
        console.error(`Message not found in database: ${messageError?.message}`);
        // If we can't find the message, let's try importing it as a new message
        // Import dynamically to avoid circular dependencies
        const { handleMediaMessage } = await import('./mediaMessageHandler.ts');
        return await handleMediaMessage(message, { ...context, isEdit: false });
      }
      
      // Create updated telegram_data
      const updatedTelegramData = {
        ...existingMessage.telegram_data,
        message: {
          ...(existingMessage.telegram_data?.message || {}),
          caption: message.caption
        },
        edit_date: message.edit_date
      };
      
      // Store old analyzed content before we clear it
      let oldAnalyzedContent = existingMessage.old_analyzed_content || [];
      if (existingMessage.analyzed_content) {
        oldAnalyzedContent = [...oldAnalyzedContent, {
          ...existingMessage.analyzed_content,
          edit_timestamp: new Date().toISOString()
        }];
      }
      
      // Update the message with new caption and reset analysis state
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption || '',
          telegram_data: updatedTelegramData,
          processing_state: 'pending',
          analyzed_content: null, // Clear for reanalysis
          old_analyzed_content: oldAnalyzedContent,
          is_original_caption: true, // Set as original for media group
          group_caption_synced: false, // Reset sync flag
          updated_at: new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
        })
        .eq('id', existingMessage.id);
      
      if (updateError) {
        throw new Error(`Failed to update message: ${updateError.message}`);
      }
      
      // Log edit operation using new logging system
      await xdelo_logMessageEdit(
        existingMessage.id,
        message.message_id,
        message.chat.id,
        correlationId,
        'caption_change',
        {
          edit_type: 'caption_edit',
          media_group_id: existingMessage.media_group_id,
          previous_caption: existingMessage.caption,
          new_caption: message.caption || '',
          message_type: 'media'
        }
      );
      
      // Keep legacy logging for backward compatibility
      try {
        await logMessageOperation(
          'edit',
          correlationId,
          {
            message: `Media message ${message.message_id} edited in chat ${message.chat.id}`,
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            sourceMessageId: existingMessage.id, // Replace existing_message_id with sourceMessageId
            media_group_id: existingMessage.media_group_id,
            edit_type: 'caption_edit'
          }
        );
      } catch (logError) {
        console.error('Error logging edit operation:', logError);
      }
      
      // Directly trigger manual caption parser instead of parse-caption-with-ai
      console.log(`Directly triggering manual parser for edited message ${existingMessage.id}`);
      try {
        const parseCaptionResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/manual-caption-parser`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              messageId: existingMessage.id,
              caption: message.caption || '',
              media_group_id: existingMessage.media_group_id,
              correlationId: correlationId,
              isEdit: true,
              trigger_source: 'edit_handler'
            })
          }
        );
        
        if (!parseCaptionResponse.ok) {
          const errorText = await parseCaptionResponse.text();
          console.error(`Parse caption failed: ${errorText}`);
          // Continue processing despite error - will be retried
        } else {
          const result = await parseCaptionResponse.json();
          console.log(`Analysis completed successfully for edited message: ${JSON.stringify(result)}`);
          
          // Explicitly trigger media group sync to ensure all edits propagate
          if (existingMessage.media_group_id) {
            console.log(`Explicitly triggering media group sync for edited message ${existingMessage.id} in group ${existingMessage.media_group_id}`);
            
            try {
              const syncResponse = await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                  },
                  body: JSON.stringify({
                    mediaGroupId: existingMessage.media_group_id,
                    sourceMessageId: existingMessage.id,
                    correlationId: correlationId,
                    forceSync: true,
                    syncEditHistory: true
                  })
                }
              );
              
              if (!syncResponse.ok) {
                const syncErrorText = await syncResponse.text();
                console.error(`Media group sync failed: ${syncErrorText}`);
              } else {
                const syncResult = await syncResponse.json();
                console.log(`Media group sync completed successfully: ${JSON.stringify(syncResult)}`);
              }
            } catch (syncError) {
              console.error(`Error triggering media group sync: ${syncError.message}`);
            }
          }
        }
      } catch (analysisError) {
        console.error(`Error during direct analysis: ${analysisError.message}`);
        // Continue processing despite error - will be retried
      }
      
      // Success response
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // For non-media edited messages, use the text handler
      // Import dynamically to avoid circular dependencies
      const { handleOtherMessage } = await import('./textMessageHandler.ts');
      return await handleOtherMessage(message, { ...context, isEdit: true });
    }
  } catch (error) {
    console.error('Error handling edited message:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
