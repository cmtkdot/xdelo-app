
import { createSupabaseClient } from '../_shared/supabase.ts';
import { corsHeaders, handleOptionsRequest, isPreflightRequest } from '../_shared/cors.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

// Get Telegram bot token from environment variable
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

interface DeleteRequest {
  message_id: number;
  chat_id: number;
  correlation_id?: string;
}

// Create a RequestHandler for the delete-telegram-message endpoint
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (isPreflightRequest(req)) {
    return handleOptionsRequest();
  }

  try {
    // If not a preflight request, process the actual request
    const { message_id, chat_id, correlation_id = crypto.randomUUID() } = await req.json() as DeleteRequest;
    
    if (!message_id || !chat_id) {
      throw new Error('Missing required parameters: message_id and chat_id');
    }
    
    console.log(`[${correlation_id}] Attempting to delete message ${message_id} from chat ${chat_id}`);
    
    // Call Telegram API to delete the message
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chat_id,
        message_id: message_id
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(`Telegram API error: ${result.description || 'Unknown error'}`);
    }
    
    // Update message record in database
    const supabase = createSupabaseClient();
    
    // First try to update in messages table
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_from_telegram: true,
        deleted_by: 'api',
        updated_at: new Date().toISOString()
      })
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .select('id')
      .maybeSingle();
      
    // Then try to update in other_messages table
    const { data: otherMessageData, error: otherMessageError } = await supabase
      .from('other_messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_from_telegram: true,
        deleted_by: 'api',
        updated_at: new Date().toISOString()
      })
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .select('id')
      .maybeSingle();
      
    const entityId = messageData?.id || otherMessageData?.id || 'unknown';
    
    // Log the deletion event
    await xdelo_logProcessingEvent(
      "message_deleted_from_telegram",
      entityId,
      correlation_id,
      {
        telegram_message_id: message_id,
        chat_id: chat_id,
        deleted_by: 'api',
        telegram_response: result
      }
    );
    
    console.log(`[${correlation_id}] Successfully deleted message ${message_id} from chat ${chat_id}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message deleted successfully',
        correlation_id: correlation_id,
        entity_id: entityId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error deleting Telegram message:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error deleting message',
        correlation_id: crypto.randomUUID()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
