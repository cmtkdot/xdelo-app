
import { serve } from "std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
/**
 * Log an event to the unified audit system
 */
async function logEvent(
  supabase: any,
  eventType: string,
  entityId: string,
  telegramMessageId?: number,
  chatId?: number,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
  errorMessage?: string
) {
  try {
    // Generate a correlation ID if not provided
    const logCorrelationId = correlationId || `telegram_delete_${crypto.randomUUID()}`;
    
    // Insert the log entry
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        telegram_message_id: telegramMessageId,
        chat_id: chatId,
        metadata,
        correlation_id: logCorrelationId,
        error_message: errorMessage
      });
    
    if (error) {
      console.error('Error logging event:', error);
    }
    
    return logCorrelationId;
  } catch (err) {
    console.error('Failed to log event:', err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a correlation ID for this deletion operation
  const correlationId = `telegram_delete_${crypto.randomUUID()}`;
  
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const { message_id, chat_id, media_group_id } = await req.json();
    console.log("Deleting message:", { message_id, chat_id, media_group_id, correlation_id: correlationId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find the message in the database to get its ID
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('id')
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .single();
      
    if (messageError) {
      await logEvent(
        supabase,
        'telegram_deleted',
        'unknown',
        message_id,
        chat_id,
        { media_group_id, error: messageError.message, stage: 'find_message' },
        correlationId,
        messageError.message
      );
      throw messageError;
    }
    
    const messageId = messageData.id;
    
    // Log the start of the deletion process
    await logEvent(
      supabase,
      'telegram_deleted',
      messageId,
      message_id,
      chat_id,
      { media_group_id, operation: 'deletion_started' },
      correlationId
    );

    // Delete message from Telegram
    const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        message_id: message_id,
      }),
    });

    const result = await response.json();
    console.log("Telegram deletion result:", result);

    if (!result.ok) {
      const errorMsg = `Failed to delete Telegram message: ${result.description}`;
      await logEvent(
        supabase,
        'telegram_deleted',
        messageId,
        message_id,
        chat_id,
        { 
          media_group_id, 
          telegram_result: result,
          operation: 'deletion_failed',
          stage: 'telegram_api_call'
        },
        correlationId,
        errorMsg
      );
      throw new Error(errorMsg);
    }
    
    // Log successful deletion from Telegram
    await logEvent(
      supabase,
      'telegram_deleted',
      messageId,
      message_id,
      chat_id,
      { 
        media_group_id, 
        telegram_result: result,
        operation: 'deletion_successful'
      },
      correlationId
    );

    // If it's part of a media group, delete all related messages
    if (media_group_id) {
      // Log the start of media group deletion
      await logEvent(
        supabase,
        'telegram_deleted',
        messageId,
        message_id,
        chat_id,
        { 
          media_group_id, 
          operation: 'media_group_deletion_started'
        },
        correlationId
      );
      
      const { data: relatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id, telegram_message_id, chat_id')
        .eq('media_group_id', media_group_id)
        .neq('telegram_message_id', message_id); // Skip the one we just deleted

      if (fetchError) {
        await logEvent(
          supabase,
          'telegram_deleted',
          messageId,
          message_id,
          chat_id,
          { 
            media_group_id, 
            error: fetchError.message,
            operation: 'media_group_deletion_failed',
            stage: 'fetch_related_messages'
          },
          correlationId,
          fetchError.message
        );
        throw fetchError;
      }

      // Delete all related messages from Telegram
      const groupResults = [];
      for (const msg of relatedMessages || []) {
        try {
          const groupResponse = await fetch(deleteUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: msg.chat_id,
              message_id: msg.telegram_message_id,
            }),
          });
          
          const groupResult = await groupResponse.json();
          groupResults.push({
            id: msg.id,
            telegram_message_id: msg.telegram_message_id,
            result: groupResult
          });
          
          // Mark the message as deleted from Telegram
          if (groupResult.ok) {
            await supabase
              .from('messages')
              .update({
                deleted_from_telegram: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', msg.id);
              
            // Log successful group message deletion
            await logEvent(
              supabase,
              'telegram_deleted',
              msg.id,
              msg.telegram_message_id,
              msg.chat_id,
              { 
                media_group_id, 
                parent_message_id: messageId,
                operation: 'group_message_deleted'
              },
              correlationId
            );
          }
        } catch (groupError) {
          console.error(`Error deleting group message ${msg.telegram_message_id}:`, groupError);
          // Continue with other messages even if one fails
          groupResults.push({
            id: msg.id,
            telegram_message_id: msg.telegram_message_id,
            error: groupError.message
          });
          
          // Log failed group message deletion
          await logEvent(
            supabase,
            'telegram_deleted',
            msg.id,
            msg.telegram_message_id,
            msg.chat_id,
            { 
              media_group_id, 
              parent_message_id: messageId,
              error: groupError.message,
              operation: 'group_message_deletion_failed'
            },
            correlationId,
            groupError.message
          );
        }
      }
      
      // Log completion of media group deletion
      await logEvent(
        supabase,
        'telegram_deleted',
        messageId,
        message_id,
        chat_id,
        { 
          media_group_id, 
          group_results: groupResults,
          operation: 'media_group_deletion_completed'
        },
        correlationId
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error deleting Telegram message:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
