
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, deleteFromTelegram } = await req.json();
    
    if (!messageId) {
      throw new Error("Message ID is required");
    }

    // Create a Supabase client with the stored admin key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the message to check if it's part of a media group
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Error fetching message: ${messageError.message}`);
    }

    // If user wants to delete from Telegram too
    if (deleteFromTelegram && message.telegram_message_id && message.chat_id) {
      // Call the delete-telegram-message function
      const telegramDeleteResponse = await supabaseAdmin.functions.invoke(
        'delete-telegram-message', 
        {
          body: {
            message_id: message.telegram_message_id,
            chat_id: message.chat_id,
            media_group_id: message.media_group_id
          }
        }
      );

      if (telegramDeleteResponse.error) {
        console.error("Error deleting from Telegram:", telegramDeleteResponse.error);
        // We'll continue with the database deletion even if Telegram deletion fails
      }
    }

    // Delete from storage if needed (call the cleanup-storage function)
    const storageResponse = await supabaseAdmin.functions.invoke(
      'cleanup-storage-on-delete', 
      {
        body: { 
          message_id: messageId,
          cascade: true // Delete all related files in the same media group
        }
      }
    );

    if (storageResponse.error) {
      console.error("Error cleaning up storage:", storageResponse.error);
      // Continue with the process even if storage cleanup fails
    }

    // Mark as deleted in the database if we don't want to actually delete from storage
    if (!deleteFromTelegram) {
      const { error: updateError } = await supabaseAdmin
        .from('messages')
        .update({ deleted_from_telegram: true })
        .eq('id', messageId);

      if (updateError) {
        throw new Error(`Error updating message: ${updateError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: deleteFromTelegram 
          ? "Message deleted from Telegram and database" 
          : "Message marked as deleted in database",
        telegramDeletion: deleteFromTelegram ? "completed" : "skipped",
        storageCleanup: storageResponse?.data || "attempted"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
