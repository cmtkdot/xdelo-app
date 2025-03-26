
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

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
      // Use unified audit logs for logging errors
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'message_deleted',
          entity_id: 'unknown',
          metadata: { 
            telegram_message_id: message_id,
            chat_id: chat_id, 
            media_group_id,
            error: messageError.message, 
            stage: 'find_message'
          },
          correlation_id: correlationId,
          error_message: messageError.message
        });
      throw messageError;
    }
    
    const messageId = messageData.id;
    
    // Log the start of the deletion process
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'message_deleted',
        entity_id: messageId,
        metadata: { 
          telegram_message_id: message_id,
          chat_id: chat_id,
          media_group_id, 
          operation: 'deletion_started'
        },
        correlation_id: correlationId
      });

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
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'message_deleted',
          entity_id: messageId,
          metadata: { 
            telegram_message_id: message_id,
            chat_id: chat_id,
            media_group_id, 
            telegram_result: result,
            operation: 'deletion_failed',
            stage: 'telegram_api_call'
          },
          correlation_id: correlationId,
          error_message: errorMsg
        });
      throw new Error(errorMsg);
    }
    
    // Log successful deletion from Telegram
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'message_deleted',
        entity_id: messageId,
        metadata: { 
          telegram_message_id: message_id,
          chat_id: chat_id,
          media_group_id, 
          telegram_result: result,
          operation: 'deletion_successful'
        },
        correlation_id: correlationId
      });

    // If it's part of a media group, delete all related messages
    if (media_group_id) {
      // Log the start of media group deletion
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'media_group_deleted',
          entity_id: messageId,
          metadata: { 
            telegram_message_id: message_id,
            chat_id: chat_id,
            media_group_id, 
            operation: 'media_group_deletion_started'
          },
          correlation_id: correlationId
        });
      
      const { data: relatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id, telegram_message_id, chat_id')
        .eq('media_group_id', media_group_id)
        .neq('telegram_message_id', message_id); // Skip the one we just deleted

      if (fetchError) {
        await supabase
          .from('unified_audit_logs')
          .insert({
            event_type: 'media_group_deleted',
            entity_id: messageId,
            metadata: { 
              telegram_message_id: message_id,
              chat_id: chat_id,
              media_group_id, 
              error: fetchError.message,
              operation: 'media_group_deletion_failed',
              stage: 'fetch_related_messages'
            },
            correlation_id: correlationId,
            error_message: fetchError.message
          });
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
            await supabase
              .from('unified_audit_logs')
              .insert({
                event_type: 'message_deleted',
                entity_id: msg.id,
                metadata: { 
                  telegram_message_id: msg.telegram_message_id,
                  chat_id: msg.chat_id,
                  media_group_id, 
                  parent_message_id: messageId,
                  operation: 'group_message_deleted'
                },
                correlation_id: correlationId
              });
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
          await supabase
            .from('unified_audit_logs')
            .insert({
              event_type: 'message_deleted',
              entity_id: msg.id,
              metadata: { 
                telegram_message_id: msg.telegram_message_id,
                chat_id: msg.chat_id,
                media_group_id, 
                parent_message_id: messageId,
                error: groupError.message,
                operation: 'group_message_deletion_failed'
              },
              correlation_id: correlationId,
              error_message: groupError.message
            });
        }
      }
      
      // Log completion of media group deletion
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'media_group_deleted',
          entity_id: messageId,
          metadata: { 
            telegram_message_id: message_id,
            chat_id: chat_id,
            media_group_id, 
            group_results: groupResults,
            operation: 'media_group_deletion_completed'
          },
          correlation_id: correlationId
        });
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
