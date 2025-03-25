import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Create a Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'X-Client-Info': 'telegram-webhook'
      }
    }
  }
);

/**
 * Log a processing event to the unified_audit_logs table
 * 
 * @param eventType Type of event (e.g., message_created, processing_state_changed)
 * @param entityId ID of the entity this event relates to (e.g., message ID), must be a string
 * @param correlationId Correlation ID for request tracing
 * @param metadata Additional metadata about the event
 * @param errorMessage Optional error message if this is an error event
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('xdelo_logprocessingevent', {
      p_event_type: eventType,
      p_entity_id: entityId,
      p_correlation_id: correlationId,
      p_metadata: metadata,
      p_error_message: errorMessage
    });
    
    if (error) {
      console.error('Error logging processing event:', error);
    }
  } catch (error) {
    console.error('Failed to log processing event:', error);
    // We don't throw here to avoid breaking the main process flow
  }
}

/**
 * Update the processing state of a message
 */
export async function xdelo_updateMessageProcessingState(
  messageId: string,
  state: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('xdelo_update_message_processing_state', {
      p_message_id: messageId,
      p_state: state,
      p_metadata: metadata
    });
    
    if (error) {
      console.error('Error updating message processing state:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update message processing state:', error);
    throw error;
  }
}

/**
 * Create a media message with duplicate detection based on file_unique_id
 */
export async function xdelo_createMessage(
  supabase,
  messageData,
  logger
) {
  try {
    // Ensure correlation_id is stored as string
    const correlationId = messageData.correlation_id ? 
      messageData.correlation_id.toString() : 
      crypto.randomUUID().toString();
    
    // Validate required fields
    if (!messageData.file_unique_id) {
      throw new Error("Missing required field: file_unique_id");
    }
    
    if (!messageData.chat_id) {
      throw new Error("Missing required field: chat_id");
    }
    
    if (!messageData.telegram_message_id) {
      throw new Error("Missing required field: telegram_message_id");
    }
    
    if (!messageData.storage_path) {
      throw new Error("Missing required field: storage_path");
    }
    
    if (!messageData.public_url) {
      throw new Error("Missing required field: public_url");
    }
    
    logger.info?.('Creating message with correlation_id', { 
      correlation_id: correlationId,
      file_unique_id: messageData.file_unique_id
    });

    // First check if a message with this file_unique_id already exists
    // This is our primary duplicate detection mechanism
    if (messageData.file_unique_id) {
      const { data: existingFile, error: queryError } = await supabase
        .from('messages')
        .select('id, file_unique_id, storage_path, telegram_message_id, chat_id, public_url')
        .eq('file_unique_id', messageData.file_unique_id)
        .maybeSingle();
        
      if (queryError) {
        logger.error('Error checking for existing file:', queryError);
        throw new Error(`Database query error: ${queryError.message}`);
      }

      if (existingFile) {
        logger.info?.('Found existing file with same file_unique_id', { 
          existing_id: existingFile.id,
          file_unique_id: messageData.file_unique_id
        });

        // Log duplicate detection
        await xdelo_logMessageEvent(supabase, 'duplicate_file_detected', {
          entity_id: existingFile.id,
          telegram_message_id: messageData.telegram_message_id,
          chat_id: messageData.chat_id,
          metadata: {
            file_unique_id: messageData.file_unique_id,
            correlation_id: correlationId,
            existing_message_id: existingFile.id,
            new_telegram_message_id: messageData.telegram_message_id,
            new_chat_id: messageData.chat_id
          }
        });

        return { 
          id: existingFile.id, 
          success: true,
          error_message: "File already exists in database" 
        };
      }
    }

    // Prepare message data with consistent format
    const safeMessageData = {
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      chat_type: messageData.chat_type || 'unknown',
      chat_title: messageData.chat_title,
      caption: messageData.caption,
      media_group_id: messageData.media_group_id,
      file_id: messageData.file_id,
      file_unique_id: messageData.file_unique_id,
      mime_type: messageData.mime_type,
      file_size: messageData.file_size,
      width: messageData.width,
      height: messageData.height,
      duration: messageData.duration,
      storage_path: messageData.storage_path,
      public_url: messageData.public_url,
      correlation_id: correlationId,
      processing_state: 'pending',
      telegram_data: messageData.telegram_data || {},
      forward_info: messageData.forward_info,
      is_edited_channel_post: messageData.is_edited_channel_post,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_url: messageData.message_url
    };
    
    // Log the data being inserted
    logger.info?.('Inserting message data', {
      correlation_id: correlationId,
      telegram_message_id: safeMessageData.telegram_message_id,
      chat_id: safeMessageData.chat_id,
      file_unique_id: safeMessageData.file_unique_id,
      storage_path: safeMessageData.storage_path
    });

    // Insert message data directly
    const { data, error } = await supabase
      .from('messages')
      .insert(safeMessageData)
      .select('id')
      .single();

    if (error) {
      // Enhanced error logging
      logger.error('Database insert error:', error);
      
      // Include more diagnostic information
      if (typeof error === 'object') {
        for (const [key, value] of Object.entries(error)) {
          logger.error(`Error detail - ${key}:`, value);
        }
      }
      
      throw error;
    }

    if (!data || !data.id) {
      throw new Error('No ID returned from insert operation');
    }

    const messageId = data.id;

    // Log message creation event
    await xdelo_logProcessingEvent(supabase, 'message_created', {
      entity_id: messageId,
      telegram_message_id: messageData.telegram_message_id,
      chat_id: messageData.chat_id,
      new_state: safeMessageData,
      metadata: {
        media_group_id: messageData.media_group_id,
        is_forward: !!messageData.forward_info,
        correlation_id: correlationId
      }
    });

    return { id: messageId, success: true };
  } catch (error) {
    // Enhanced error logging with better error object handling
    const errorMessage = error instanceof Error 
      ? `${error.message}${error.stack ? ` (${error.stack})` : ''}`
      : (typeof error === 'object' ? JSON.stringify(error) : String(error));
      
    logger.error('Error creating message:', errorMessage);
    
    return {
      id: '',
      success: false,
      error_message: errorMessage,
      error_code: error instanceof Error ? error.name : 'UNKNOWN_ERROR'
    };
  }
}

// Helper function for logging message events
async function xdelo_logMessageEvent(supabase, eventType, params) {
  try {
    await xdelo_logProcessingEvent(
      eventType,
      params.entity_id,
      params.metadata?.correlation_id || 'system',
      params.metadata || {}
    );
  } catch (error) {
    console.error(`Failed to log message event (${eventType}):`, error);
  }
}
