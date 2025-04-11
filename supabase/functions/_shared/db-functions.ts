
/**
 * @file db-functions.ts
 * @description TypeScript documentation for database functions and operations.
 * This file provides TypeScript types and JSDoc documentation for database functions
 * used in the application. It does not contain implementation code but serves as
 * a reference for developers using these database functions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

/**
 * Telegram chat type enum values supported in the database
 */
export type TelegramChatType = 'private' | 'group' | 'supergroup' | 'channel' | 'unknown';

/**
 * Processing state for messages
 */
export type ProcessingState = 'pending' | 'processing' | 'processed' | 'error' | 'initialized';

/**
 * Parameters for the upsert_media_message database function
 */
export interface UpsertMediaMessageParams {
  /** Telegram message ID */
  p_telegram_message_id: number;
  /** Telegram chat ID */
  p_chat_id: number;
  /** Unique file identifier from Telegram */
  p_file_unique_id: string;
  /** Telegram file ID used for downloading */
  p_file_id?: string | null;
  /** Storage path where file is saved */
  p_storage_path?: string | null;
  /** Public URL to access the file */
  p_public_url?: string | null;
  /** MIME type of the file */
  p_mime_type?: string | null;
  /** File extension */
  p_extension?: string | null;
  /** Media type (photo, video, document, etc.) */
  p_media_type?: string | null;
  /** Media caption */
  p_caption?: string | null;
  /** Current processing state */
  p_processing_state: ProcessingState;
  /** Raw message data from Telegram */
  p_message_data: Record<string, any>;
  /** Correlation ID for tracking */
  p_correlation_id: string;
  /** 
   * Telegram user ID (bigint) 
   * @deprecated This parameter is kept for backward compatibility but is ignored in database operations
   * due to type mismatch with the UUID column in the database.
   */
  p_user_id?: number | null;
  /** Media group ID if part of a group */
  p_media_group_id?: string | null;
  /** Forward information if message is forwarded */
  p_forward_info?: Record<string, any> | null;
  /** Error message if processing failed */
  p_processing_error?: string | null;
  /** Processed caption data */
  p_caption_data?: Record<string, any> | null;
}

/**
 * Result of the upsert_media_message database function
 */
export type UpsertMediaMessageResult = string; // UUID of the created/updated message

/**
 * Upserts a media message in the database.
 * This function inserts a new message record or updates an existing one if a record
 * with the same file_unique_id exists. It handles various type conversions and validations:
 * 
 * 1. Chat type validation: Converts any input chat type to a valid enum value
 * 2. User ID handling: Ignores the user_id parameter to avoid type mismatches
 * 3. Processing state: Converts the string to the proper enum type
 * 
 * @param {SupabaseClient<Database>} supabaseClient - The Supabase client instance
 * @param {UpsertMediaMessageParams} params - Parameters for the operation
 * @returns {Promise<UpsertMediaMessageResult>} UUID of the created/updated message
 * 
 * @example
 * // Basic usage with required parameters
 * const messageId = await upsertMediaMessage(supabaseClient, {
 *   p_telegram_message_id: 12345,
 *   p_chat_id: 67890,
 *   p_file_unique_id: 'AQADkK4xG_cN6EZ-',
 *   p_message_data: { 
 *     chat: { 
 *       type: 'supergroup',
 *       title: 'My Group'
 *     },
 *     date: 1617234567
 *   },
 *   p_processing_state: 'pending',
 *   p_correlation_id: 'abc-123-xyz'
 * });
 * 
 * @example
 * // With all parameters for a fully processed media message
 * const messageId = await upsertMediaMessage(supabaseClient, {
 *   p_telegram_message_id: 12345,
 *   p_chat_id: 67890,
 *   p_file_unique_id: 'AQADkK4xG_cN6EZ-',
 *   p_file_id: 'AgADBAADv6kxG-1fAUgQ8P4AAQNLrOVKiwAEgQ',
 *   p_storage_path: 'media/photos/AQADkK4xG_cN6EZ-.jpg',
 *   p_public_url: 'https://example.com/storage/media/photos/AQADkK4xG_cN6EZ-.jpg',
 *   p_mime_type: 'image/jpeg',
 *   p_extension: 'jpg',
 *   p_media_type: 'photo',
 *   p_caption: 'Beautiful sunset',
 *   p_processing_state: 'processed',
 *   p_message_data: { chat: { type: 'supergroup', title: 'My Group' }, date: 1617234567 },
 *   p_correlation_id: 'abc-123-xyz',
 *   p_user_id: 98765432, // Will be ignored in database operations
 *   p_media_group_id: 'group123',
 *   p_forward_info: { from_chat_id: 54321, from_message_id: 111 },
 *   p_caption_data: { parsed_date: '2025-04-09', tags: ['sunset', 'nature'] }
 * });
 * 
 * @example
 * // Error handling
 * try {
 *   const messageId = await upsertMediaMessage(supabaseClient, {...});
 *   console.log(`Message created/updated with ID: ${messageId}`);
 * } catch (error) {
 *   console.error('Failed to upsert message:', error);
 *   // Handle specific error types if needed
 * }
 */
export async function upsertMediaMessage(
  supabaseClient: SupabaseClient<Database>,
  params: UpsertMediaMessageParams
): Promise<UpsertMediaMessageResult> {
  const { data, error } = await supabaseClient.rpc('upsert_media_message', params);
  
  if (error) {
    throw error;
  }
  
  return data as string;
}

/**
 * Parameters for logging to the unified audit logs
 */
export interface LogToAuditTableParams {
  /** Type of event being logged */
  event_type: string;
  /** 
   * Entity ID (UUID) this event is related to
   * Note: As of April 9, 2025, this no longer requires a foreign key reference to the messages table
   */
  entity_id: string;
  /** Correlation ID for tracking this request */
  correlation_id: string;
  /** Additional metadata about the event */
  metadata?: Record<string, any>;
  /** Optional error message if this is an error event */
  error_message?: string;
  /** Optional Telegram message ID (numeric) */
  telegram_message_id?: number;
  /** Optional chat ID (numeric) */
  chat_id?: number;
}

/**
 * Logs an event to the unified_audit_logs table.
 * As of April 9, 2025, the foreign key constraint has been removed, allowing
 * any valid UUID to be used as entity_id, even if it doesn't reference an existing message.
 * 
 * @param {SupabaseClient<Database>} supabaseClient - The Supabase client instance
 * @param {LogToAuditTableParams} params - Parameters for the log entry
 * @returns {Promise<string>} UUID of the created log entry
 * 
 * @example
 * // Basic system event
 * const logId = await logToAuditTable(supabaseClient, {
 *   event_type: 'system_startup',
 *   entity_id: crypto.randomUUID(), // Can be any valid UUID
 *   correlation_id: 'system',
 *   metadata: { version: '1.2.3', environment: 'production' }
 * });
 * 
 * @example
 * // Message-related event
 * const logId = await logToAuditTable(supabaseClient, {
 *   event_type: 'message_processed',
 *   entity_id: messageId, // UUID of the message
 *   correlation_id: correlationId,
 *   telegram_message_id: 12345,
 *   chat_id: 67890,
 *   metadata: { 
 *     processing_time_ms: 230,
 *     file_size: 123456
 *   }
 * });
 * 
 * @example
 * // Error event
 * const logId = await logToAuditTable(supabaseClient, {
 *   event_type: 'processing_error',
 *   entity_id: messageId, // UUID of the message
 *   correlation_id: correlationId,
 *   error_message: 'Failed to download media from Telegram: Network error',
 *   metadata: { 
 *     attempt: 2,
 *     will_retry: true
 *   }
 * });
 */
export async function logToAuditTable(
  supabaseClient: SupabaseClient<Database>,
  params: LogToAuditTableParams
): Promise<string> {
  const { data, error } = await supabaseClient.from('unified_audit_logs').insert({
    event_type: params.event_type,
    entity_id: params.entity_id,
    correlation_id: params.correlation_id,
    metadata: params.metadata || {},
    error_message: params.error_message,
    telegram_message_id: params.telegram_message_id,
    chat_id: params.chat_id,
    event_timestamp: new Date().toISOString()
  }).select('id').single();
  
  if (error) {
    throw error;
  }
  
  return data.id;
}

/**
 * Validates and normalizes a chat type to ensure it matches the telegram_chat_type enum.
 * This utility function provides the same validation logic used in the database function.
 * 
 * @param {string | undefined} chatType - The chat type from Telegram
 * @returns {TelegramChatType} A valid telegram_chat_type enum value
 * 
 * @example
 * // Standard chat types
 * validateChatType('private'); // returns: 'private'
 * validateChatType('group'); // returns: 'group'
 * validateChatType('supergroup'); // returns: 'supergroup'
 * validateChatType('channel'); // returns: 'channel'
 * 
 * @example
 * // Edge cases
 * validateChatType(undefined); // returns: 'unknown'
 * validateChatType(''); // returns: 'unknown'
 * validateChatType('GROUP'); // returns: 'group' (case insensitive)
 * validateChatType('unknown_type'); // returns: 'unknown' (fallback)
 */
export function validateChatType(chatType: string | undefined): TelegramChatType {
  if (!chatType) return 'unknown';
  
  // Check if the chat type matches one of the valid enum values
  switch (chatType.toLowerCase()) {
    case 'private':
      return 'private';
    case 'group':
      return 'group';
    case 'supergroup':
      return 'supergroup';
    case 'channel':
      return 'channel';
    default:
      return 'unknown';
  }
}
