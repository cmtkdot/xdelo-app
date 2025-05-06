import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BATCH_SIZE = 5; // Process media group updates in smaller batches for reliability

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a correlation ID for this operation
  const correlationId = `caption_update_${crypto.randomUUID()}`;

  try {
    const { messageId, newCaption, updateMediaGroup = true } = await req.json();
    console.log(`[${correlationId}] Updating caption for message:`, messageId, 'New caption:', newCaption, 'Update media group:', updateMediaGroup);

    // Get environment variables
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!TELEGRAM_BOT_TOKEN || !supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log operation start
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'caption_updated',
        entity_id: messageId,
        metadata: {
          operation: 'update_started',
          update_media_group: updateMediaGroup
        },
        correlation_id: correlationId
      });

    // Get message details from database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      await logError(supabase, messageId, 'Message not found', correlationId);
      throw new Error('Message not found');
    }

    // Check if the caption is actually different
    const currentCaption = message.caption || '';
    if (currentCaption === newCaption) {
      console.log(`[${correlationId}] Caption unchanged, skipping update`);
      return new Response(
        JSON.stringify({ success: true, message: 'Caption unchanged' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update caption in Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: message.chat_id,
          message_id: message.telegram_message_id,
          caption: newCaption,
        }),
      }
    );

    const telegramResult = await telegramResponse.json();
    console.log(`[${correlationId}] Telegram API response:`, telegramResult);

    if (!telegramResponse.ok) {
      // Check if it's just a "message not modified" error
      if (telegramResult.description?.includes('message is not modified')) {
        console.log(`[${correlationId}] Message not modified, proceeding with database update`);
      } else {
        await logError(supabase, messageId, `Telegram API error: ${JSON.stringify(telegramResult)}`, correlationId);
        throw new Error(`Telegram API error: ${JSON.stringify(telegramResult)}`);
      }
    }

    // Update telegram_data with new caption
    const updatedTelegramData = {
      ...message.telegram_data,
      message: {
        ...(message.telegram_data?.message || {}),
        caption: newCaption
      }
    };

    // Archive previous analyzed content
    const oldAnalyzedContent = message.analyzed_content;

    // Update caption in database
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        caption: newCaption,
        telegram_data: updatedTelegramData,
        updated_at: new Date().toISOString(),

        // Archive old analyzed content
        old_analyzed_content: oldAnalyzedContent,

        // Reset processing state to trigger reanalysis
        processing_state: 'initialized',

        // Add edit history
        edit_history: [
          {
            edited_at: new Date().toISOString(),
            previous_caption: message.caption,
            previous_analyzed_content: oldAnalyzedContent,
            correlation_id: correlationId,
            source: 'caption_update_edge_function'
          },
          ...(message.edit_history || [])
        ],

        // Set edit metadata
        is_edit: true,
        edit_count: (message.edit_count || 0) + 1,
        last_edited_at: new Date().toISOString(),

        // Preserve existing storage path and public URL to prevent deletion
        storage_path: message.storage_path,
        public_url: message.public_url
      })
      .eq('id', messageId);

    if (updateError) {
      await logError(supabase, messageId, `Database update error: ${updateError.message}`, correlationId);
      throw updateError;
    }

    // Log successful individual message update
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'caption_updated',
        entity_id: messageId,
        metadata: {
          operation: 'message_updated',
          old_caption: message.caption,
          new_caption: newCaption,
        },
        correlation_id: correlationId
      });

    // Media group handling
    let mediaGroupResults = [];

    if (updateMediaGroup && message.media_group_id) {
      console.log(`[${correlationId}] Handling media group updates for group: ${message.media_group_id}`);

      // Get all related messages in the media group
      const { data: groupMessages, error: groupError } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', message.media_group_id)
        .neq('id', messageId); // Exclude the current message

      if (groupError) {
        await logError(supabase, messageId, `Error fetching media group: ${groupError.message}`, correlationId, { media_group_id: message.media_group_id });
        console.error(`[${correlationId}] Error fetching media group:`, groupError);
      } else if (groupMessages && groupMessages.length > 0) {
        console.log(`[${correlationId}] Found ${groupMessages.length} related messages in media group`);

        // Process in smaller batches to improve reliability
        for (let i = 0; i < groupMessages.length; i += MAX_BATCH_SIZE) {
          // Get the current batch
          const batch = groupMessages.slice(i, i + MAX_BATCH_SIZE);
          console.log(`[${correlationId}] Processing batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}/${Math.ceil(groupMessages.length / MAX_BATCH_SIZE)}`);

          // Process each batch with a small delay between items
          const batchResults = await Promise.all(
            batch.map(async (groupMsg, index) => {
              try {
                // Add a small delay between API calls to avoid rate limiting
                if (index > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }

                console.log(`[${correlationId}] Updating media group message: ${groupMsg.id}`);

                // First update in database to ensure consistency
                // Archive previous analyzed content for this group message
                const oldGroupAnalyzedContent = groupMsg.analyzed_content;

                // Create telegram data update with the new caption
                const updatedGroupTelegramData = {
                  ...groupMsg.telegram_data,
                  message: {
                    ...groupMsg.telegram_data?.message,
                    caption: newCaption
                  }
                };

                // Update group message in database first
                const { error: groupUpdateError } = await supabase
                  .from('messages')
                  .update({
                    caption: newCaption,
                    telegram_data: updatedGroupTelegramData,
                    updated_at: new Date().toISOString(),

                    // Archive old analyzed content
                    old_analyzed_content: oldGroupAnalyzedContent,

                    // Reset processing state to trigger reanalysis
                    processing_state: 'initialized',

                    // Add edit history
                    edit_history: [
                      {
                        edited_at: new Date().toISOString(),
                        previous_caption: groupMsg.caption,
                        previous_analyzed_content: oldGroupAnalyzedContent,
                        correlation_id: correlationId,
                        source: 'media_group_caption_sync'
                      },
                      ...(groupMsg.edit_history || [])
                    ],

                    // Set edit metadata
                    is_edit: true,
                    edit_count: (groupMsg.edit_count || 0) + 1,
                    last_edited_at: new Date().toISOString(),
                  })
                  .eq('id', groupMsg.id);

                // Now try updating in Telegram
                let telegramSuccess = false;
                let telegramResult = null;

                try {
                  // Update caption in Telegram
                  const groupResponse = await fetch(
                    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        chat_id: groupMsg.chat_id,
                        message_id: groupMsg.telegram_message_id,
                        caption: newCaption,
                      }),
                    }
                  );

                  telegramResult = await groupResponse.json();
                  telegramSuccess = groupResponse.ok || telegramResult.description?.includes('message is not modified');

                  // If we have a "message not modified" error, that's actually a success for our purposes
                  if (!groupResponse.ok && telegramResult.description?.includes('message is not modified')) {
                    console.log(`[${correlationId}] Media group message ${groupMsg.id} reported as not modified in Telegram, treating as success`);
                  }
                } catch (telegramError) {
                  console.error(`[${correlationId}] Telegram API error for group message ${groupMsg.id}:`, telegramError);
                }

                // Log the result
                await supabase
                  .from('unified_audit_logs')
                  .insert({
                    event_type: 'media_group_caption_updated',
                    entity_id: groupMsg.id,
                    metadata: {
                      media_group_id: groupMsg.media_group_id,
                      telegram_success: telegramSuccess,
                      database_success: !groupUpdateError,
                      old_caption: groupMsg.caption,
                      new_caption: newCaption
                    },
                    correlation_id: correlationId,
                    error_message: (!telegramSuccess || groupUpdateError)
                      ? `Errors: ${!telegramSuccess ? JSON.stringify(telegramResult) : ''} ${groupUpdateError ? groupUpdateError.message : ''}`
                      : null
                  });

                return {
                  id: groupMsg.id,
                  telegram_message_id: groupMsg.telegram_message_id,
                  telegram_success: telegramSuccess,
                  telegram_result: telegramResult,
                  database_success: !groupUpdateError,
                  database_error: groupUpdateError ? groupUpdateError.message : null
                };
              } catch (error) {
                console.error(`[${correlationId}] Error processing group message ${groupMsg.id}:`, error);

                // Log the error
                await supabase
                  .from('unified_audit_logs')
                  .insert({
                    event_type: 'media_group_caption_update_failed',
                    entity_id: groupMsg.id,
                    metadata: {
                      media_group_id: groupMsg.media_group_id,
                      error: error.message
                    },
                    correlation_id: correlationId,
                    error_message: error.message
                  });

                return {
                  id: groupMsg.id,
                  error: error.message
                };
              }
            })
          );

          // Add batch results to overall results
          mediaGroupResults = [...mediaGroupResults, ...batchResults];

          // Add a delay between batches
          if (i + MAX_BATCH_SIZE < groupMessages.length) {
            console.log(`[${correlationId}] Waiting between batches...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // Trigger reanalysis with new caption
    await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        media_group_id: message.media_group_id,
        caption: newCaption,
        correlation_id: correlationId
      }
    });

    // Log successful completion
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'caption_updated',
        entity_id: messageId,
        metadata: {
          operation: 'update_completed',
          update_media_group: updateMediaGroup,
          media_group_id: message.media_group_id,
          media_group_results: mediaGroupResults.length
        },
        correlation_id: correlationId
      });

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        media_group_id: message.media_group_id,
        media_group_updated: updateMediaGroup && !!message.media_group_id,
        media_group_results: mediaGroupResults,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error updating caption:`, error);
    return new Response(
      JSON.stringify({
        error: error.message,
        correlation_id: correlationId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to log errors
async function logError(supabase, entityId, errorMessage, correlationId, additionalMetadata = {}) {
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'caption_updated',
        entity_id: entityId,
        metadata: {
          operation: 'update_error',
          ...additionalMetadata
        },
        correlation_id: correlationId,
        error_message: errorMessage
      });
  } catch (logError) {
    console.error(`[${correlationId}] Error logging to audit logs:`, logError);
  }
}
