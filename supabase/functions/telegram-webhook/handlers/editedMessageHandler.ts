import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { logMessageOperation } from '../utils/logger.ts';
import { getMediaInfo } from '../utils/mediaUtils.ts';
import { xdelo_detectMimeType } from '../../_shared/mediaUtils.ts';

// Declare Deno type for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  }
};

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
      
      // Get media info using the same utility as mediaMessageHandler
      const mediaInfo = await getMediaInfo(message);
      
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
      
      // Check if the file content has actually changed by comparing file_unique_id
      const fileChanged = mediaInfo.file_unique_id !== existingMessage.file_unique_id;
      if (fileChanged) {
        console.log(`Media file changed in edit, old file_unique_id: ${existingMessage.file_unique_id}, new file_unique_id: ${mediaInfo.file_unique_id}`);
        
        // Store previous file info in edit_history
        const editHistory = existingMessage.edit_history || [];
        editHistory.push({
          timestamp: new Date().toISOString(),
          previous_file_unique_id: existingMessage.file_unique_id,
          new_file_unique_id: mediaInfo.file_unique_id,
          previous_caption: existingMessage.caption,
          new_caption: message.caption,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          previous_analyzed_content: existingMessage.analyzed_content
        });
        
        // Properly detect MIME type exactly as getMediaInfo does
        const photo = message.photo ? message.photo[message.photo.length - 1] : null;
        const video = message.video;
        const document = message.document;
        
        // Detailed MIME type detection consistent with getMediaInfo implementation
        const detectedMimeType = photo ? 'image/jpeg' : 
                                 video?.mime_type || (video ? 'video/mp4' : null) ||
                                 document?.mime_type || 'application/octet-stream';
                                 
        console.log(`Detected MIME type for edited message: ${detectedMimeType}`);
        
        // Use mediaUtils from mediaMessageHandler to process file upload
        // Import shared media utilities to download and upload the new file
        const { xdelo_downloadMediaFromTelegram, xdelo_uploadMediaToStorage, xdelo_validateAndFixStoragePath } = 
          await import('../../_shared/mediaUtils.ts');
        
        // Get bot token from database
        const { data: settings } = await supabaseClient
          .from('settings')
          .select('bot_token')
          .single();
          
        if (!settings?.bot_token) {
          throw new Error('Bot token not found in settings');
        }
        
        // Download the new media from Telegram
        const download = await xdelo_downloadMediaFromTelegram(
          mediaInfo.file_id,
          mediaInfo.file_unique_id,
          detectedMimeType, // Use properly detected MIME type
          settings.bot_token
        );
        
        if (!download.success || !download.blob || !download.storagePath) {
          throw new Error(download.error || 'Failed to download new media from Telegram');
        }
        
        // Generate storage path with properly detected MIME type
        const storagePath = download.storagePath || xdelo_validateAndFixStoragePath(
          mediaInfo.file_unique_id, 
          detectedMimeType
        );
        
        // Upload the new media to Supabase storage
        const upload = await xdelo_uploadMediaToStorage(
          storagePath,
          download.blob,
          detectedMimeType // Use properly detected MIME type
        );
        
        if (!upload.success || !upload.publicUrl) {
          throw new Error(upload.error || 'Failed to upload new media to storage');
        }
        
        // Update the message with new media info and storage path
        const { error: updateMediaError } = await supabaseClient
          .from('messages')
          .update({
            file_id: mediaInfo.file_id,
            file_unique_id: mediaInfo.file_unique_id,
            file_size: mediaInfo.file_size,
            mime_type: detectedMimeType, // Use properly detected MIME type
            // Don't use file_type, width, height, duration as they may not exist in MediaInfo
            caption: message.caption || '',
            telegram_data: message,
            storage_path: download.storagePath,
            public_url: upload.publicUrl,
            processing_state: 'pending',
            analyzed_content: null,
            old_analyzed_content: existingMessage.old_analyzed_content || [],
            is_original_caption: true,
            group_caption_synced: false,
            updated_at: new Date().toISOString(),
            edit_count: (existingMessage.edit_count || 0) + 1,
            edit_history: editHistory,
            edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
            storage_exists: true,
            storage_path_standardized: true,
            needs_redownload: false
          })
          .eq('id', existingMessage.id);
        
        if (updateMediaError) {
          throw new Error(`Failed to update message with new media: ${updateMediaError.message}`);
        }
        
        console.log(`Successfully updated message ${existingMessage.id} with new media file`);
        
        // Log media change event
        try {
          await logMessageOperation(
            'edit',
            correlationId,
            {
              message: `Media file changed in message ${message.message_id} edited in chat ${message.chat.id}`,
              telegram_message_id: message.message_id,
              chat_id: message.chat.id,
              file_unique_id: mediaInfo.file_unique_id,
              old_file_unique_id: existingMessage.file_unique_id,
              existing_message_id: existingMessage.id,
              media_group_id: existingMessage.media_group_id,
              edit_type: 'media_file_changed'
            }
          );
        } catch (logError) {
          console.error('Error logging media change operation:', logError);
        }
      } else {
        console.log(`Media file unchanged in edit, only updating caption or metadata`);
      
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
        const oldAnalyzedContent = existingMessage.old_analyzed_content || [];
        if (existingMessage.analyzed_content) {
          oldAnalyzedContent.push({
            ...existingMessage.analyzed_content,
            edit_timestamp: new Date().toISOString()
          });
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
        
        // Log edit operation
        try {
          await logMessageOperation(
            'edit',
            correlationId,
            {
              message: `Media message ${message.message_id} edited in chat ${message.chat.id}`,
              telegram_message_id: message.message_id,
              chat_id: message.chat.id,
              existing_message_id: existingMessage.id,
              media_group_id: existingMessage.media_group_id,
              edit_type: 'caption_edit'
            }
          );
        } catch (logError) {
          console.error('Error logging edit operation:', logError);
        }
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
