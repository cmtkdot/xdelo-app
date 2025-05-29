import { logWithCorrelation } from './logger.ts';
import { reduceTelegramMessageSize } from './dataReduction.ts';
export async function upsertMediaMessageRecord({ supabaseClient, messageId, chatId, caption, mediaType, fileId, fileUniqueId, storagePath, mimeType, extension, messageData, processingState, processingError, forwardInfo, mediaGroupId, captionData, analyzedContent, correlationId, additionalUpdates = {} }) {
  try {
    logWithCorrelation(correlationId, `Upserting media message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertMediaMessageRecord');
    // Reduce the size of the Telegram message data to prevent PostgreSQL stack depth errors
    const reducedMessageData = reduceTelegramMessageSize(messageData);
    // Call the RPC function to upsert the media message
    // p_public_url is REMOVED from the call
    const { data, error } = await supabaseClient.rpc('upsert_media_message', {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_file_unique_id: fileUniqueId,
      p_file_id: fileId,
      p_storage_path: storagePath,
      // p_public_url: publicUrl, // <--- REMOVED from RPC call parameters
      p_mime_type: mimeType,
      p_extension: extension,
      p_media_type: mediaType,
      p_caption: caption,
      p_processing_state: processingState,
      p_message_data: reducedMessageData,
      p_correlation_id: correlationId,
      p_media_group_id: mediaGroupId,
      p_forward_info: forwardInfo,
      p_processing_error: processingError,
      p_caption_data: captionData || analyzedContent,
      p_old_analyzed_content: additionalUpdates.old_analyzed_content,
      p_analyzed_content: additionalUpdates.analyzed_content || captionData || analyzedContent
    });
    if (error) {
      logWithCorrelation(correlationId, `Error upserting media message: ${error.message}`, 'ERROR', 'upsertMediaMessageRecord');
      logWithCorrelation(correlationId, `DB error details: ${JSON.stringify(error)}`, 'ERROR', 'upsertMediaMessageRecord');
      return {
        success: false,
        error
      };
    }
    // Apply any additional updates if needed
    // (This part remains the same)
    if (Object.keys(additionalUpdates).length > 0 && data) {
      try {
        // Filter out updates that were already applied via the RPC
        const filteredUpdates = {
          ...additionalUpdates
        };
        delete filteredUpdates.old_analyzed_content;
        delete filteredUpdates.analyzed_content;
        if (Object.keys(filteredUpdates).length > 0) {
          const { error: updateError } = await supabaseClient.from('messages').update(filteredUpdates).eq('id', data);
          if (updateError) {
            logWithCorrelation(correlationId, `Error applying additional updates: ${updateError.message}`, 'WARN', 'upsertMediaMessageRecord');
          }
        }
      } catch (updateError) {
        logWithCorrelation(correlationId, `Exception applying additional updates: ${updateError.message}`, 'WARN', 'upsertMediaMessageRecord');
      }
    }
    // Fetch the complete record
    // (This part remains the same)
    if (data) {
      const { data: completeRecord, error: fetchError } = await supabaseClient.from('messages').select('*').eq('id', data).single();
      if (fetchError) {
        logWithCorrelation(correlationId, `Error fetching complete record: ${fetchError.message}`, 'WARN', 'upsertMediaMessageRecord');
        return {
          success: true,
          data
        };
      }
      return {
        success: true,
        data: completeRecord
      };
    }
    return {
      success: true,
      data
    };
  } catch (error) {
    logWithCorrelation(correlationId, `Exception upserting media message: ${error.message}`, 'ERROR', 'upsertMediaMessageRecord');
    console.error("Exception upserting media message:", error);
    return {
      success: false,
      error: error.message || String(error)
    };
  }
}
/**
 * Create a message record in the database
 */ export async function createMessageRecord(supabaseClient, message, mediaType, fileId, fileUniqueId, storagePath, publicUrl, mimeType, extension, captionData, correlationId) {
  try {
    const { data, error } = await supabaseClient.from("messages").insert([
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_date: new Date(message.date * 1000).toISOString(),
        caption: message.caption,
        media_type: mediaType,
        file_id: fileId,
        file_unique_id: fileUniqueId,
        storage_path: storagePath,
        public_url: publicUrl,
        mime_type: mimeType,
        extension: extension,
        message_data: message,
        processing_state: "pending",
        caption_data: captionData,
        analyzed_content: captionData,
        correlation_id: correlationId,
        edit_history: []
      }
    ]).select().single();
    if (error) {
      console.error("DB error creating message:", error);
      return {
        success: false,
        error
      };
    }
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error("Exception creating message:", error);
    return {
      success: false,
      error
    };
  }
}
/**
 * Update a message record in the database
 */ export async function updateMessageRecord(supabase, existingMessage, message, mediaInfo, captionData, correlationId, updates = {}) {
  try {
    // Reduce the size of the Telegram message data
    const reducedMessageData = reduceTelegramMessageSize(message);
    // Base updates for both edited and non-edited messages
    const baseUpdates = {
      telegram_message_id: message.message_id,
      chat_id: message.chat?.id,
      telegram_data: reducedMessageData,
      updated_at: new Date().toISOString(),
      ...updates
    };
    // For edited messages with caption changes
    if (updates.is_edit && captionData) {
      // Add caption processing metadata
      baseUpdates.caption_data = captionData;
      baseUpdates.analyzed_content = captionData;
      baseUpdates.processing_state = 'initialized';
      // Only store the most recent edit in old_analyzed_content
      baseUpdates.old_analyzed_content = existingMessage.analyzed_content;
    }
    // Update the message record
    const { error } = await supabase.from('messages').update(baseUpdates).eq('id', existingMessage.id);
    if (error) {
      throw error;
    }
    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating message record:', error);
    return {
      success: false,
      error
    };
  }
}
/**
 * Find a message by Telegram message ID and chat ID
 */ export async function findMessageByTelegramId(supabaseClient, telegramMessageId, chatId, correlationId) {
  try {
    logWithCorrelation(correlationId, `Finding message with telegram_message_id ${telegramMessageId} in chat ${chatId}`, 'INFO', 'findMessageByTelegramId');
    const { data, error } = await supabaseClient.from("messages").select("*").eq("telegram_message_id", telegramMessageId).eq("chat_id", chatId).single();
    if (error) {
      // Not found is not an error
      if (error.message.includes('No rows found')) {
        return {
          success: false
        };
      }
      console.error(`DB error finding message by Telegram ID ${telegramMessageId} in chat ${chatId}:`, error);
      return {
        success: false
      };
    }
    return {
      success: true,
      message: data
    };
  } catch (error) {
    console.error(`Exception finding message by Telegram ID ${telegramMessageId} in chat ${chatId}:`, error);
    return {
      success: false
    };
  }
}
/**
 * Find a message by file_unique_id
 */ export async function findMessageByFileUniqueId(supabaseClient, fileUniqueId, correlationId) {
  try {
    logWithCorrelation(correlationId, `Finding message with file_unique_id ${fileUniqueId}`, 'INFO', 'findMessageByFileUniqueId');
    const { data, error } = await supabaseClient.from("messages").select("*").eq("file_unique_id", fileUniqueId).single();
    if (error) {
      // These are normal "not found" error cases, not actual errors
      if (error.message.includes('No rows found') || error.message.includes('multiple (or no) rows returned') || error.code === 'PGRST116') {
        logWithCorrelation(correlationId, `No message found with file_unique_id ${fileUniqueId}`, 'INFO', 'findMessageByFileUniqueId');
        return {
          success: false
        };
      }
      // Real error case
      logWithCorrelation(correlationId, `DB error finding message by file_unique_id ${fileUniqueId}: ${error.message}`, 'ERROR', 'findMessageByFileUniqueId');
      return {
        success: false
      };
    }
    logWithCorrelation(correlationId, `Found message with ID ${data.id} for file_unique_id ${fileUniqueId}`, 'INFO', 'findMessageByFileUniqueId');
    return {
      success: true,
      data: data
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception finding message by file_unique_id ${fileUniqueId}: ${errorMessage}`, 'ERROR', 'findMessageByFileUniqueId');
    return {
      success: false
    };
  }
}
/**
 * Update a message with an error
 */ export async function updateMessageWithError(supabaseClient, messageId, errorMessage, correlationId, errorType) {
  try {
    const { error } = await supabaseClient.from("messages").update({
      processing_state: "error",
      error_message: errorMessage,
      error_type: errorType,
      last_error_at: new Date().toISOString(),
      correlation_id: correlationId
    }).eq("id", messageId);
    if (error) {
      console.error("DB error updating message with error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Exception updating message with error:", error);
    return false;
  }
}
/**
 * Log a processing event
 */ export async function logProcessingEvent(supabaseClient, event_type, entity_id, correlation_id, metadata, error) {
  try {
    const { error: dbError } = await supabaseClient.from("unified_audit_logs").insert({
      event_type: event_type,
      entity_id: entity_id,
      correlation_id: correlation_id,
      metadata: metadata,
      error_message: error ? error instanceof Error ? error.message : String(error) : null
    });
    if (dbError) {
      console.error("DB error logging processing event:", dbError);
    }
  } catch (e) {
    console.error("Exception logging processing event:", e);
  }
}
/**
 * Trigger caption parsing by invoking an Edge Function
 */ export async function triggerCaptionParsing({ supabaseClient, messageId, correlationId }) {
  try {
    // Using destructuring with underscore prefix to indicate intentionally unused variable
    const { data: _data, error } = await supabaseClient.functions.invoke('xdelo_parse_caption', {
      body: {
        messageId: messageId,
        correlationId: correlationId
      }
    });
    if (error) {
      logWithCorrelation(correlationId, `Error invoking caption parsing function for message ${messageId}: ${error.message}`, 'ERROR', 'triggerCaptionParsing');
    } else {
      logWithCorrelation(correlationId, `Caption parsing triggered successfully for message ${messageId}`, 'INFO', 'triggerCaptionParsing');
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logWithCorrelation(correlationId, `Exception invoking caption parsing function for message ${messageId}: ${errorMessage}`, 'ERROR', 'triggerCaptionParsing');
  }
}
/**
 * Extract forward information from a message
 */ export function extractForwardInfo(message) {
  if (message.forward_from) {
    return {
      forwarded_from_type: 'user',
      forwarded_from_id: message.forward_from.id,
      forwarded_from_username: message.forward_from.username,
      forwarded_date: new Date(message.forward_date * 1000).toISOString()
    };
  } else if (message.forward_from_chat) {
    return {
      forwarded_from_type: message.forward_from_chat.type,
      forwarded_from_id: message.forward_from_chat.id,
      forwarded_from_title: message.forward_from_chat.title,
      forwarded_from_username: message.forward_from_chat.username,
      forwarded_date: new Date(message.forward_date * 1000).toISOString()
    };
  } else {
    return null;
  }
}
/**
 * Upsert a text message record in the database
 * With fallback to direct table insert for essential fields
 */ export async function upsertTextMessageRecord({ supabaseClient, messageId, chatId, messageText, messageData, messageType = 'text', chatType, chatTitle, forwardInfo, processingState = 'initialized', correlationId }) {
  try {
    logWithCorrelation(correlationId, `Upserting text message record for ${messageId} in chat ${chatId}`, 'INFO', 'upsertTextMessageRecord');
    // First attempt: try using the RPC function with positional parameters
    try {
      // Safe stringify all JSON data
      const formattedMessageData = typeof messageData === 'string' ? messageData : JSON.stringify(messageData);
      const formattedForwardInfo = forwardInfo ? typeof forwardInfo === 'string' ? forwardInfo : JSON.stringify(forwardInfo) : null;
      // Call the RPC function to upsert the text message using named parameters
      // Using named parameters allows flexibility in parameter ordering
      // This ensures the function doesn't break if parameters are added or reordered in the future
      const { data, error } = await supabaseClient.rpc('upsert_text_message', {
        p_telegram_message_id: messageId,
        p_chat_id: chatId,
        p_telegram_data: formattedMessageData,
        p_message_text: messageText,
        p_message_type: messageType,
        p_chat_type: chatType,
        p_chat_title: chatTitle,
        p_forward_info: formattedForwardInfo,
        p_processing_state: processingState,
        p_correlation_id: correlationId
      });
      if (!error) {
        // Success case - return the data
        // Fetch the complete record
        if (data) {
          const { data: completeRecord, error: fetchError } = await supabaseClient.from('other_messages').select('*').eq('id', data).single();
          if (fetchError) {
            logWithCorrelation(correlationId, `Error fetching complete record: ${fetchError.message}`, 'WARN', 'upsertTextMessageRecord');
            return {
              success: true,
              data
            };
          }
          return {
            success: true,
            data: completeRecord
          };
        }
        return {
          success: true,
          data
        };
      }
      // Log the RPC error but continue to fallback
      logWithCorrelation(correlationId, `RPC error, falling back to direct insert: ${error.message}`, 'WARN', 'upsertTextMessageRecord');
    } catch (rpcError) {
      logWithCorrelation(correlationId, `RPC exception, falling back to direct insert: ${rpcError instanceof Error ? rpcError.message : String(rpcError)}`, 'WARN', 'upsertTextMessageRecord');
    }
    // FALLBACK: If RPC fails, do a direct insert with minimal fields
    logWithCorrelation(correlationId, `Using fallback method to insert message data`, 'INFO', 'upsertTextMessageRecord');
    // Ensure we have valid JSON data to store
    let telegram_data;
    try {
      // Store the raw message data as a JSON string
      telegram_data = typeof messageData === 'object' ? messageData : JSON.parse(messageData);
    } catch (error) {
      // If we can't parse it, store it as a string to prevent workflow interruption
      logWithCorrelation(correlationId, `JSON parsing error for message data: ${error instanceof Error ? error.message : String(error)}`, 'WARN', 'upsertTextMessageRecord');
      telegram_data = {
        raw_data: String(messageData)
      };
    }
    // Determine if this is a forward based on the data
    const is_forward = !!forwardInfo || !!messageData?.forward_date;
    // Extract message date if available in the data
    const message_date = messageData?.date ? new Date(messageData.date * 1000) : new Date();
    // Use passed messageType or determine based on content
    const message_type = messageType || (messageData?.text ? "text" : messageData?.sticker ? "sticker" : messageData?.poll ? "poll" : messageData?.contact ? "contact" : "unknown");
    // Validate chat_type (must be one of the ENUM values)
    // The database has an ENUM type, so we must ensure we're using a valid value
    const validChatTypes = [
      'private',
      'group',
      'supergroup',
      'channel',
      'unknown'
    ];
    const normalizedChatType = chatType?.toLowerCase() || 'unknown';
    const validatedChatType = validChatTypes.includes(normalizedChatType) ? normalizedChatType : 'unknown';
    logWithCorrelation(correlationId, `Using chat_type: ${validatedChatType} (original: ${chatType})`, 'INFO', 'upsertTextMessageRecord');
    // First try simple insert without conflict handling
    try {
      // Minimal insert with essential fields - focusing on the critical ones
      const { data: insertData, error: insertError } = await supabaseClient.from('other_messages').insert({
        telegram_message_id: messageId,
        chat_id: chatId,
        message_text: messageText,
        telegram_data: telegram_data,
        message_type,
        chat_type: validatedChatType,
        chat_title: chatTitle,
        is_forward,
        message_date,
        processing_state: processingState,
        // Only include forward_info if it exists
        ...forwardInfo && {
          forward_info: forwardInfo
        }
      }).select('id').single();
      if (!insertError) {
        return {
          success: true,
          data: insertData
        };
      }
      // If error is not a duplicate key error, return the error
      if (!insertError.message.includes('duplicate key')) {
        logWithCorrelation(correlationId, `Insert failed with non-duplicate error: ${insertError.message}`, 'ERROR', 'upsertTextMessageRecord');
        return {
          success: false,
          error: insertError
        };
      }
      // If it was a duplicate key error, try an update instead
      logWithCorrelation(correlationId, `Record exists, attempting update`, 'INFO', 'upsertTextMessageRecord');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logWithCorrelation(correlationId, `Exception during insert attempt: ${errorMessage}`, 'ERROR', 'upsertTextMessageRecord');
    }
    // If we get here, the record exists, so try an update
    const { data: updateData, error: updateError } = await supabaseClient.from('other_messages').update({
      message_text: messageText,
      telegram_data: telegram_data,
      message_type,
      chat_type: validatedChatType,
      chat_title: chatTitle,
      is_forward,
      message_date,
      processing_state: processingState,
      // Only include forward_info if it exists
      ...forwardInfo && {
        forward_info: forwardInfo
      },
      updated_at: new Date()
    }).eq('telegram_message_id', messageId).eq('chat_id', chatId).select('id').single();
    if (updateError) {
      logWithCorrelation(correlationId, `Fallback update failed: ${updateError.message}`, 'ERROR', 'upsertTextMessageRecord');
      return {
        success: false,
        error: updateError
      };
    }
    // If update succeeded, return the updated record
    return {
      success: true,
      data: updateData
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception upserting text message: ${errorMessage}`, 'ERROR', 'upsertTextMessageRecord');
    return {
      success: false,
      error
    };
  }
}
