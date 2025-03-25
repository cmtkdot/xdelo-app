
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.32.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle CORS preflight requests
function handleCors(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders 
    })
  }
}

export const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables for Supabase client')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Main function handler
Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  
  try {
    // Get request payload
    const { messageId, deleteFromTelegram } = await req.json()
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Message ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Processing delete request for messageId: ${messageId}, deleteFromTelegram: ${deleteFromTelegram}`)
    
    const supabase = getSupabaseClient()
    
    // Get message details needed for logging
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('telegram_message_id, chat_id, file_unique_id, media_group_id')
      .eq('id', messageId)
      .single()
    
    if (messageError) {
      console.error('Error fetching message data:', messageError)
      return new Response(
        JSON.stringify({ error: 'Error fetching message data', details: messageError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Step 1: Update the database to mark the message as deleted
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        deleted_from_telegram: true,
        processing_state: 'completed' 
      })
      .eq('id', messageId)
    
    if (updateError) {
      console.error('Error updating message:', updateError)
      return new Response(
        JSON.stringify({ error: 'Error updating message', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Step 2: If deleteFromTelegram is true, actually delete from Telegram via API
    let telegramResult = null
    if (deleteFromTelegram && messageData.telegram_message_id && messageData.chat_id) {
      // Get Telegram bot token from environment
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
      if (!telegramBotToken) {
        return new Response(
          JSON.stringify({ error: 'Telegram bot token not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      try {
        // Call Telegram API to delete the message
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${telegramBotToken}/deleteMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: messageData.chat_id,
              message_id: messageData.telegram_message_id
            })
          }
        )
        
        telegramResult = await telegramResponse.json()
        console.log('Telegram API response:', telegramResult)
        
        // If the message was deleted from Telegram successfully, update the database
        if (telegramResult.ok) {
          await supabase
            .from('messages')
            .update({ 
              deleted_via_telegram: true 
            })
            .eq('id', messageId)
        }
      } catch (telegramError) {
        console.error('Error calling Telegram API:', telegramError)
        // We continue processing even if Telegram deletion fails
      }
    }
    
    // Step 3: Log the deletion operation
    const { error: logError } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'message_deleted',
        entity_id: messageId,
        operation_type: deleteFromTelegram ? 'telegram_deletion' : 'database_deletion',
        metadata: {
          telegram_message_id: messageData.telegram_message_id,
          chat_id: messageData.chat_id,
          file_unique_id: messageData.file_unique_id,
          media_group_id: messageData.media_group_id,
          telegram_result: telegramResult
        }
      })
    
    if (logError) {
      console.error('Error logging deletion:', logError)
      // Non-critical error, continue
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message deleted successfully',
        telegramResult 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Error processing delete request:', error)
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
