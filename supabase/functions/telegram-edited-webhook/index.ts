
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const update = await req.json();
    const editedMessage = update.edited_message || update.edited_channel_post;

    if (!editedMessage) {
      throw new Error("No edited message content received");
    }

    console.log("📝 Processing edited message:", {
      correlation_id: correlationId,
      message_id: editedMessage.message_id,
      chat_id: editedMessage.chat.id,
      edit_date: editedMessage.edit_date,
      has_media: !!(editedMessage.photo || editedMessage.video || editedMessage.document),
      has_caption: !!editedMessage.caption
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the existing message
    const { data: existingMessage, error: findError } = await supabase
      .from("messages")
      .select("*")
      .eq("telegram_message_id", editedMessage.message_id)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    if (!existingMessage) {
      throw new Error("Original message not found");
    }

    console.log("✅ Found original message:", {
      correlation_id: correlationId,
      message_id: existingMessage.id,
      media_group_id: existingMessage.media_group_id,
      is_original_caption: existingMessage.is_original_caption
    });

    const newCaption = editedMessage.caption || "";
    
    // First, update the edited message
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        caption: newCaption,
        is_edited: true,
        edit_date: new Date(editedMessage.edit_date * 1000).toISOString(),
        processing_state: 'pending',
        processing_completed_at: null,
        updated_at: new Date().toISOString(),
        telegram_data: {
          ...existingMessage.telegram_data,
          edited_message: editedMessage
        }
      })
      .eq("id", existingMessage.id);

    if (updateError) {
      throw updateError;
    }

    // Handle media group updates if applicable
    if (existingMessage.media_group_id && existingMessage.is_original_caption) {
      console.log("📝 Updating media group captions:", {
        correlation_id: correlationId,
        media_group_id: existingMessage.media_group_id
      });

      const { error: groupUpdateError } = await supabase
        .from("messages")
        .update({
          caption: newCaption,
          processing_state: 'pending',
          processing_completed_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("media_group_id", existingMessage.media_group_id)
        .neq("id", existingMessage.id);

      if (groupUpdateError) {
        console.error("⚠️ Error updating media group:", {
          correlation_id: correlationId,
          error: groupUpdateError.message
        });
      }
    }

    // Log the edit event
    await supabase
      .from("analysis_audit_log")
      .insert({
        message_id: existingMessage.id,
        media_group_id: existingMessage.media_group_id,
        event_type: 'MESSAGE_EDITED',
        old_state: existingMessage.processing_state,
        new_state: 'pending',
        processing_details: {
          correlation_id: correlationId,
          edit_date: editedMessage.edit_date,
          previous_caption: existingMessage.caption,
          new_caption: newCaption,
          chat_id: editedMessage.chat.id,
          chat_type: editedMessage.chat.type
        }
      });

    // Trigger reanalysis of the caption
    console.log("🔄 Triggering caption reanalysis:", {
      correlation_id: correlationId,
      message_id: existingMessage.id
    });

    const { error: reanalysisError } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: existingMessage.id,
        media_group_id: existingMessage.media_group_id,
        caption: newCaption,
        correlation_id: correlationId,
        is_edit: true
      }
    });

    if (reanalysisError) {
      console.error("⚠️ Error triggering reanalysis:", {
        correlation_id: correlationId,
        error: reanalysisError.message
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Edit processed successfully",
        details: {
          correlation_id: correlationId,
          message_id: editedMessage.message_id,
          media_group_id: existingMessage.media_group_id,
          reanalysis_triggered: !reanalysisError
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error processing edit:", {
      correlation_id: correlationId,
      error: error.message
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
