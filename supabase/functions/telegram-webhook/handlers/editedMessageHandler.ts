import { supabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { getMediaInfo } from '../utils/mediaUtils.ts';
import { xdelo_detectMimeType } from '../../_shared/mediaUtils.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  }
};

export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, previousMessage } = context;
    console.log(`[${correlationId}] Processing edited message ${message.message_id} in chat ${message.chat.id}`);
    
    if (!previousMessage) {
      throw new Error('Previous message is required for editing');
    }
    
    if (message.photo || message.video || message.document) {
      console.log(`[${correlationId}] Edited message contains media, handling media edit`);
      
      const mediaInfo = await getMediaInfo(message);
      
      const { data: existingMessage, error: messageError } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
        .single();
      
      if (messageError || !existingMessage) {
        console.error(`[${correlationId}] Message not found in database: ${messageError?.message}`);
        const { handleMediaMessage } = await import('./mediaMessageHandler.ts');
        return await handleMediaMessage(message, { ...context, isEdit: false });
      }
      
      const fileChanged = mediaInfo.file_unique_id !== existingMessage.file_unique_id;
      if (fileChanged) {
        console.log(`[${correlationId}] Media file changed in edit, old file_unique_id: ${existingMessage.file_unique_id}, new file_unique_id: ${mediaInfo.file_unique_id}`);
        
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
        
        const photo = message.photo ? message.photo[message.photo.length - 1] : null;
        const video = message.video;
        const document = message.document;
        
        const detectedMimeType = photo ? 'image/jpeg' : 
                                 video?.mime_type || (video ? 'video/mp4' : null) ||
                                 document?.mime_type || 'application/octet-stream';
                                 
        console.log(`Detected MIME type for edited message: ${detectedMimeType}`);
        
        const { xdelo_downloadMediaFromTelegram, xdelo_uploadMediaToStorage, xdelo_validateAndFixStoragePath } = 
          await import('../../_shared/mediaUtils.ts');
        
        const { data: settings } = await supabaseClient
          .from('settings')
          .select('bot_token')
          .single();
          
        if (!settings?.bot_token) {
          throw new Error('Bot token not found in settings');
        }
        
        const download = await xdelo_downloadMediaFromTelegram(
          mediaInfo.file_id,
          mediaInfo.file_unique_id,
          detectedMimeType,
          settings.bot_token
        );
        
        if (!download.success || !download.blob || !download.storagePath) {
          throw new Error(download.error || 'Failed to download new media from Telegram');
        }
        
        const storagePath = download.storagePath || xdelo_validateAndFixStoragePath(
          mediaInfo.file_unique_id, 
          detectedMimeType
        );
        
        const upload = await xdelo_uploadMediaToStorage(
          storagePath,
          download.blob,
          detectedMimeType
        );
        
        if (!upload.success || !upload.publicUrl) {
          throw new Error(upload.error || 'Failed to upload new media to storage');
        }
        
        const { error: updateMediaError } = await supabaseClient
          .from('messages')
          .update({
            file_id: mediaInfo.file_id,
            file_unique_id: mediaInfo.file_unique_id,
            file_size: mediaInfo.file_size,
            mime_type: detectedMimeType,
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
        
        console.log(`[${correlationId}] Successfully updated message ${existingMessage.id} with new media file`);
        
        try {
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'message_edited',
            entity_id: existingMessage.id,
            metadata: {
              telegram_message_id: message.message_id,
              chat_id: message.chat.id,
              file_unique_id: mediaInfo.file_unique_id,
              media_group_id: existingMessage.media_group_id,
              edit_type: 'media_file_changed'
            },
            correlation_id: correlationId
          });
        } catch (logError) {
          console.error(`[${correlationId}] Error logging media change operation:`, logError);
        }
      } else {
        console.log(`[${correlationId}] Media file unchanged in edit, only updating caption or metadata`);
      
        const updatedTelegramData = {
          ...existingMessage.telegram_data,
          message: {
            ...(existingMessage.telegram_data?.message || {}),
            caption: message.caption
          },
          edit_date: message.edit_date
        };
        
        const oldAnalyzedContent = existingMessage.old_analyzed_content || [];
        if (existingMessage.analyzed_content) {
          oldAnalyzedContent.push({
            ...existingMessage.analyzed_content,
            edit_timestamp: new Date().toISOString()
          });
        }
        
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            caption: message.caption || '',
            telegram_data: updatedTelegramData,
            processing_state: 'pending',
            analyzed_content: null,
            old_analyzed_content: oldAnalyzedContent,
            is_original_caption: true,
            group_caption_synced: false,
            updated_at: new Date().toISOString(),
            edit_count: (existingMessage.edit_count || 0) + 1,
            edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString()
          })
          .eq('id', existingMessage.id);
      
        if (updateError) {
          throw new Error(`Failed to update message: ${updateError.message}`);
        }
        
        try {
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'message_edited',
            entity_id: existingMessage.id,
            metadata: {
              telegram_message_id: message.message_id,
              chat_id: message.chat.id,
              existing_message_id: existingMessage.id,
              media_group_id: existingMessage.media_group_id,
              edit_type: 'caption_edit'
            },
            correlation_id: correlationId
          });
        } catch (logError) {
          console.error(`[${correlationId}] Error logging edit operation:`, logError);
        }
      }
      
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
        } else {
          const result = await parseCaptionResponse.json();
          console.log(`Analysis completed successfully for edited message: ${JSON.stringify(result)}`);
          
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
      }
      
      return new Response(
        JSON.stringify({ success: true, correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const { handleOtherMessage } = await import('./textMessageHandler.ts');
      return await handleOtherMessage(message, { ...context, isEdit: true });
    }
  } catch (error) {
    console.error(`[${correlationId}] Error handling edited message:`, error);
    
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'message_processing_failed',
      error_message: error.message || 'Unknown error in edited message handler',
      metadata: {
        telegram_message_id: message?.message_id,
        chat_id: message?.chat?.id,
        handler_type: 'edited_message'
      },
      correlation_id: correlationId
    });
    
    return new Response(
      JSON.stringify({ error: error.message, correlationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
