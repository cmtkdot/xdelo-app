
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

const MAX_RETRY_COUNT = 5;

export async function handleOtherMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { isChannelPost, isForwarded, correlationId } = context;
    
    // Log the start of message processing
    console.log(`[${correlationId}] Processing non-media message ${message.message_id} in chat ${message.chat.id}`);
    
    // Extract text content from the message
    const messageText = message.text || message.caption || '';
    
    // Prepare forward info if applicable
    const forwardInfo = isForwarded ? extractForwardInfo(message) : null;

    try {
      // Check if the required columns exist
      await checkRequiredColumnsExist();
      
      // Store message data in the other_messages table
      const { data, error } = await supabaseClient
        .from('other_messages')
        .insert({
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          message_type: isChannelPost ? 'channel_post' : 'message',
          message_text: messageText,
          telegram_data: message,
          telegram_message_id: message.message_id,
          processing_state: 'completed',
          is_forward: isForwarded,
          forward_info: forwardInfo,
          correlation_id: correlationId,
          retry_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        // Check if error is due to missing columns
        if (error.message?.includes('does not exist')) {
          console.error(`[${correlationId}] Column missing error:`, error.message);
          
          // Fix the schema by running the missing columns function
          await fixMissingColumns();
          
          // Retry the insert with minimal data to avoid column errors
          const { data: retryData, error: retryError } = await supabaseClient
            .from('other_messages')
            .insert({
              chat_id: message.chat.id,
              chat_type: message.chat.type, 
              chat_title: message.chat.title,
              message_type: isChannelPost ? 'channel_post' : 'message',
              message_text: messageText,
              telegram_data: message,
              correlation_id: correlationId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
            
          if (retryError) throw retryError;
          return await finishProcessingMessage(retryData?.id, message, correlationId);
        } else {
          throw error;
        }
      }
        
      return await finishProcessingMessage(data?.id, message, correlationId);
    } catch (dbError) {
      console.error(`[${correlationId}] Database error:`, dbError);
      
      // Handle database errors more gracefully
      if (dbError.message?.includes('does not exist')) {
        // Try to fix the schema and provide a more helpful response
        await fixMissingColumns();
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Database schema issue detected and fixed. Please try again.",
            correlationId
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          }
        );
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error(`Error processing non-media message:`, error);
    
    try {
      // Get current retry count if message exists
      const { data: existingMessage } = await supabaseClient
        .from('other_messages')
        .select('id, retry_count')
        .eq('chat_id', message.chat.id)
        .eq('telegram_data->message_id', message.message_id)
        .maybeSingle();
      
      const retryCount = existingMessage?.retry_count || 0;
      
      // If we've already tried too many times, just store the raw data
      if (retryCount >= MAX_RETRY_COUNT) {
        console.log(`[${context.correlationId}] Max retry count reached for message ${message.message_id}, storing as raw data`);
        
        // Update if exists or insert new record with stored_only state
        if (existingMessage?.id) {
          await supabaseClient
            .from('other_messages')
            .update({
              telegram_data: message,
              processing_state: 'stored_only',
              retry_count: retryCount + 1,
              error_message: `Max retry count reached: ${error.message}`,
              last_error_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id);
        } else {
          // Create new record in stored_only state with minimal fields
          try {
            const { data: newRecord } = await supabaseClient
              .from('other_messages')
              .insert({
                chat_id: message.chat.id,
                chat_type: message.chat.type,
                chat_title: message.chat.title,
                message_type: context.isChannelPost ? 'channel_post' : 'message',
                message_text: message.text || message.caption || '',
                telegram_data: message,
                telegram_message_id: message.message_id,
                processing_state: 'stored_only',
                is_forward: context.isForwarded,
                correlation_id: context.correlationId,
                error_message: `Max retry count reached: ${error.message}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            // Log the fallback storage
            await xdelo_logProcessingEvent(
              "message_fallback_storage",
              newRecord?.data?.id || 'unknown',
              context.correlationId,
              {
                message_id: message.message_id,
                chat_id: message.chat.id,
                error_message: error.message,
                retry_count: MAX_RETRY_COUNT
              }
            );
          } catch (fallbackError) {
            console.error(`[${context.correlationId}] Failed to create fallback record:`, fallbackError);
            // In case of schema issues, try to fix them
            await fixMissingColumns();
          }
        }
        
        // Return success to prevent Telegram from retrying
        return new Response(
          JSON.stringify({ 
            success: true, 
            fallback: true,
            message: "Stored message data without processing",
            correlationId: context.correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // If we haven't reached max retries, try to update or insert with error state
      try {
        if (existingMessage?.id) {
          await supabaseClient
            .from('other_messages')
            .update({
              retry_count: retryCount + 1,
              error_message: error.message,
              last_error_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingMessage.id);
        } else {
          // Create a new record with error state with minimal fields
          await supabaseClient
            .from('other_messages')
            .insert({
              chat_id: message.chat.id,
              chat_type: message.chat.type,
              chat_title: message.chat.title,
              message_type: context.isChannelPost ? 'channel_post' : 'message',
              message_text: message.text || message.caption || '',
              telegram_data: message,
              processing_state: 'error',
              correlation_id: context.correlationId,
              retry_count: 1,
              error_message: error.message,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
        }
      } catch (errorTrackingError) {
        console.error(`[${context.correlationId}] Failed to track error:`, errorTrackingError);
        // In case of schema issues, try to fix them
        await fixMissingColumns();
      }
    } catch (secondaryError) {
      console.error('Error during error handling:', secondaryError);
    }
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      "system",
      context.correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'other_message'
      },
      error.message
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Helper to complete message processing after successful insert
async function finishProcessingMessage(id: string, message: TelegramMessage, correlationId: string): Promise<Response> {
  // Log successful processing
  await xdelo_logProcessingEvent(
    "message_created",
    id,
    correlationId,
    {
      message_id: message.message_id,
      chat_id: message.chat.id,
      message_type: 'text'
    }
  );
  
  console.log(`[${correlationId}] Successfully processed text message ${message.message_id}`);
  
  return new Response(
    JSON.stringify({ success: true, messageId: id, correlationId }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Helper function to extract forward info
function extractForwardInfo(message: TelegramMessage): Record<string, any> | null {
  if (!message.forward_from && !message.forward_from_chat && !message.forward_origin) {
    return null;
  }
  
  const forwardInfo: Record<string, any> = {
    is_forwarded: true
  };
  
  // Handle modern forward_origin data
  if (message.forward_origin) {
    forwardInfo.forward_origin_type = message.forward_origin.type;
    
    if (message.forward_origin.type === 'channel') {
      forwardInfo.forward_from_chat_id = message.forward_origin.chat?.id;
      forwardInfo.forward_from_chat_title = message.forward_origin.chat?.title;
      forwardInfo.forward_from_chat_type = message.forward_origin.chat?.type;
      forwardInfo.forward_from_message_id = message.forward_origin.message_id;
    } else if (message.forward_origin.type === 'user') {
      forwardInfo.forward_from_user_id = message.forward_origin.sender_user?.id;
    }
  }
  
  // Handle legacy forward fields
  if (message.forward_from) {
    forwardInfo.forward_from_user_id = message.forward_from.id;
    forwardInfo.forward_from_user_name = message.forward_from.first_name;
  }
  
  if (message.forward_from_chat) {
    forwardInfo.forward_from_chat_id = message.forward_from_chat.id;
    forwardInfo.forward_from_chat_title = message.forward_from_chat.title;
    forwardInfo.forward_from_chat_type = message.forward_from_chat.type;
  }
  
  if (message.forward_date) {
    forwardInfo.forward_date = new Date(message.forward_date * 1000).toISOString();
  }
  
  return forwardInfo;
}

// Helper function to check if all required columns exist
async function checkRequiredColumnsExist(): Promise<void> {
  try {
    // Check if telegram_message_id column exists by making a simple query
    await supabaseClient.rpc('xdelo_check_columns_exist', {
      table_name: 'other_messages',
      column_names: ['telegram_message_id', 'forward_info', 'retry_count', 'last_error_at', 'message_url', 'is_forward']
    });
  } catch (error) {
    console.error('Column check failed:', error);
    // If the check fails, try to fix the schema
    await fixMissingColumns();
  }
}

// Helper function to fix missing columns
async function fixMissingColumns(): Promise<void> {
  try {
    console.log('Attempting to fix missing columns...');
    
    // Run the fix missing columns function
    const { data, error } = await supabaseClient.functions.invoke('xdelo_run_fix_missing_columns');
    
    if (error) {
      console.error('Error fixing missing columns:', error);
      throw error;
    }
    
    console.log('Fix missing columns result:', data);
  } catch (error) {
    console.error('Failed to fix missing columns:', error);
    throw error;
  }
}
