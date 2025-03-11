
/**
 * Shared Message Logging Utility
 * 
 * This utility provides standardized logging for message operations
 * using the new centralized xdelo_log_message_operation database function.
 */

import { supabaseClient } from './supabase.ts';

/**
 * MessageOperation types that match the database enum
 */
export type MessageOperationType = 
  | 'message_create'
  | 'message_update'
  | 'message_delete'
  | 'message_forward'
  | 'message_edit'
  | 'media_redownload'
  | 'caption_change'
  | 'media_change'
  | 'group_sync';

/**
 * Parameters for logging a message operation
 */
export interface LogMessageParams {
  sourceMessageId: string;
  targetMessageId?: string;
  operationType: MessageOperationType;
  correlationId?: string;
  telegramMessageId?: number;
  chatId?: number;
  metadata?: Record<string, any>;
  userId?: string;
  errorMessage?: string;
}

/**
 * Logs a message operation using the xdelo_log_message_operation function
 */
export const xdelo_logMessageOperation = async (params: LogMessageParams): Promise<string | null> => {
  try {
    const {
      sourceMessageId,
      targetMessageId,
      operationType,
      correlationId,
      telegramMessageId,
      chatId,
      metadata,
      userId,
      errorMessage
    } = params;

    // Call the database function to log the operation
    const { data, error } = await supabaseClient.rpc(
      'xdelo_log_message_operation',
      {
        p_operation_type: operationType,
        p_source_message_id: sourceMessageId,
        p_target_message_id: targetMessageId,
        p_correlation_id: correlationId,
        p_telegram_message_id: telegramMessageId,
        p_chat_id: chatId,
        p_metadata: metadata,
        p_user_id: userId,
        p_error_message: errorMessage
      }
    );

    if (error) {
      console.error('Error logging message operation:', error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error('Exception logging message operation:', error);
    return null;
  }
};

/**
 * Logs a message creation operation
 */
export const xdelo_logMessageCreation = async (
  messageId: string,
  telegramMessageId: number,
  chatId: number,
  correlationId: string,
  metadata?: Record<string, any>
): Promise<string | null> => {
  return xdelo_logMessageOperation({
    sourceMessageId: messageId,
    operationType: 'message_create',
    telegramMessageId,
    chatId,
    correlationId,
    metadata: {
      ...metadata,
      action: 'message_created',
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Logs a message edit operation
 */
export const xdelo_logMessageEdit = async (
  messageId: string,
  telegramMessageId: number,
  chatId: number,
  correlationId: string,
  editType: 'caption_change' | 'media_change' | 'message_edit',
  metadata?: Record<string, any>
): Promise<string | null> => {
  return xdelo_logMessageOperation({
    sourceMessageId: messageId,
    operationType: editType,
    telegramMessageId,
    chatId,
    correlationId,
    metadata: {
      ...metadata,
      action: 'message_edited',
      edit_type: editType,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Logs a media group sync operation
 */
export const xdelo_logMediaGroupSync = async (
  sourceMessageId: string,
  targetMessageId: string,
  mediaGroupId: string,
  correlationId: string,
  metadata?: Record<string, any>
): Promise<string | null> => {
  return xdelo_logMessageOperation({
    sourceMessageId,
    targetMessageId,
    operationType: 'group_sync',
    correlationId,
    metadata: {
      ...metadata,
      action: 'media_group_synced',
      media_group_id: mediaGroupId,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Logs a media redownload operation
 */
export const xdelo_logMediaRedownload = async (
  messageId: string,
  telegramMessageId: number,
  chatId: number,
  correlationId: string,
  success: boolean,
  metadata?: Record<string, any>
): Promise<string | null> => {
  return xdelo_logMessageOperation({
    sourceMessageId: messageId,
    operationType: 'media_redownload',
    telegramMessageId,
    chatId,
    correlationId,
    metadata: {
      ...metadata,
      action: success ? 'redownload_success' : 'redownload_failure',
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Logs a message error
 */
export const xdelo_logMessageError = async (
  messageId: string,
  errorMessage: string,
  correlationId: string,
  operationType: MessageOperationType = 'message_update',
  metadata?: Record<string, any>
): Promise<string | null> => {
  return xdelo_logMessageOperation({
    sourceMessageId: messageId,
    operationType,
    correlationId,
    errorMessage,
    metadata: {
      ...metadata,
      action: 'error',
      timestamp: new Date().toISOString()
    }
  });
};
