/**
 * dbOperations.ts
 * 
 * Higher-level database operation functions for Telegram webhook handlers.
 * These functions encapsulate common database patterns and implement
 * proper TypeScript interfaces for improved type safety.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Database, Json } from "../../_shared/types.ts";
import { ForwardInfo, TelegramMessage } from "../types.ts";
import { logWithCorrelation } from "./logger.ts";

/**
 * Define ProcessingState type
 */
/**
 * ProcessingState defines all possible states for message processing.
 * This must match the database's processing_state_type enum exactly.
 */
export type ProcessingState =
	| "initialized"
	| "pending"
	| "processing"
	| "processed"
	| "completed"
	| "pending_analysis"
	| "duplicate"
	| "download_failed_forwarded"
	| "error";

/**
 * Message record for database operations
 */
export interface MessageRecord {
	/** Telegram message ID */
	telegram_message_id: number;
	/** Chat ID where the message was sent */
	chat_id: number;
	/** Type of chat (private, group, supergroup, channel) */
	chat_type: string;
	/** Title of the chat if available */
	chat_title?: string;
	/** User ID who sent the message */
	user_id?: number;
	/**
	 * Processed caption data as JSON
	 * @note This field is synchronized with analyzed_content - both should contain the same data
	 * for consistency. When updating one field, always update the other.
	 */
	caption_data?: Json | null;
	/**
	 * Structured analyzed content from caption parsing
	 * @note This field is synchronized with caption_data - both should contain the same data
	 * for consistency. When updating one field, always update the other.
	 */
	analyzed_content?: Json | null;
	/**
	 * Archive of previous analyzed_content values, preserving edit history
	 */
	old_analyzed_content?: Json[] | null;
	/** Current processing state */
	processing_state: ProcessingState;
	/** Correlation ID for request tracking */
	correlation_id: string;
	/** Forward information if message is forwarded */
	forward_info?: ForwardInfo | null;
	/** Edit history for tracking changes */
	edit_history?: any[];
	/** Unique file ID from Telegram */
	file_unique_id?: string;
	/** Path where the file is stored */
	storage_path?: string | null;
	/** Public URL of the file */
	public_url?: string | null;
	/** MIME type of the file */
	mime_type?: string | null;
	/** File extension */
	extension?: string | null;
	/** Size of the file in bytes */
	file_size?: number | null;
	/** Content disposition (inline or attachment) */
	content_disposition?: string;
	/** Error message if processing failed */
	error_message?: string | null;
	/** Error type if processing failed */
	error_type?: string | null;
	/** Timestamp of the last error */
	last_error_at?: string | null;
	/** Number of retry attempts */
	retry_count?: number;
	/** Timestamp when the message was last edited */
	last_edited_at?: string | null;
	/** Whether the message is from a channel post */
	is_channel_post?: boolean;
	/** Media group ID if message is part of a media group */
	media_group_id?: string | null;
	/** Caption of the message */
	caption?: string | null;
	/** Media type of the message */
	media_type?: string | null;
	/** File ID of the message */
	file_id?: string | null;
}

/**
 * Result of a database operation
 */
export interface DbOperationResult<T = any> {
	/** Whether the operation was successful */
	success: boolean;
	/** The data returned by the operation */
	data?: T;
	/** Error message if operation failed */
	error?: string;
	/** Error code if operation failed */
	errorCode?: string;
}

/**
 * Input parameters for creating a message record.
 */
export interface CreateMessageParams {
	supabaseClient: SupabaseClient<Database>;
	messageId: number;
	chatId: number;
	userId?: number;
	messageDate: Date;
	caption?: string | null; // For media captions
	mediaType?: string | null;
	fileId?: string | null;
	fileUniqueId?: string | null;
	storagePath?: string | null;
	publicUrl?: string | null;
	mimeType?: string | null;
	extension?: string | null;
	messageData: Json;
	processingState: ProcessingState;
	processingError?: string | null;
	forwardInfo?: ForwardInfo | null;
	mediaGroupId?: string | null;
	captionData?: Json | null;
	correlationId: string;
}

/**
 * Create a new message record in the database
 * 
 * @param params - The input parameters
 * @returns Operation result with the created message ID
 * @example
 * const result = await createMessageRecord(
 *   {
 *     supabaseClient,
 *     messageId,
 *     chatId,
 *     userId,
 *     messageDate,
 *     caption,
 *     mediaType,
 *     fileId,
 *     fileUniqueId,
 *     storagePath,
 *     publicUrl,
 *     mimeType,
 *     extension,
 *     messageData,
 *     processingState,
 *     processingError,
 *     forwardInfo,
 *     mediaGroupId,
 *     captionData,
 *     correlationId,
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log(`Created message with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to create message: ${result.error}`);
 * }
 */
/**
 * Validates and normalizes a chat type to ensure it matches the telegram_chat_type enum
 * 
 * @param chatType - The chat type from Telegram
 * @returns A valid telegram_chat_type enum value
 */
function validateChatType(chatType: string | undefined): 'private' | 'group' | 'supergroup' | 'channel' | 'unknown' {
  if (!chatType) return 'unknown';
  
  // Check if the chat type matches one of the valid enum values
  switch(chatType.toLowerCase()) {
    case 'private':
      return 'private';
    case 'group':
      return 'group';
    case 'supergroup':
      return 'supergroup';
    case 'channel':
      return 'channel';
    default:
      console.warn(`Unknown chat type: ${chatType}, falling back to 'unknown'`);
      return 'unknown';
  }
}

export async function createMessageRecord(
	params: CreateMessageParams
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = "createMessageRecord";
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Creating MEDIA message record for ${messageId} in chat ${chatId}`);

	try {
		// Validate chat type
		const chatType = validateChatType(params.messageData?.chat?.type);
		
		// Prepare message record from params
		const messageRecord: Omit<Database["public"]["Tables"]["messages"]["Insert"], "id" | "created_at" | "updated_at"> = {
			telegram_message_id: messageId,
			chat_id: chatId,
			chat_type: chatType, // Use validated chat type
			chat_title: params.messageData?.chat?.title,
			user_id: params.userId,
			message_date: params.messageDate.toISOString(),
			caption: params.caption, // Store caption separately
			media_type: params.mediaType,
			file_id: params.fileId,
			file_unique_id: params.fileUniqueId,
			storage_path: params.storagePath,
			public_url: params.publicUrl,
			mime_type: params.mimeType,
			extension: params.extension,
			message_data: params.messageData,
			processing_state: params.processingState,
			processing_error: params.processingError,
			forward_info: params.forwardInfo as Json | null,
			media_group_id: params.mediaGroupId,
			caption_data: params.captionData as Json | null,
			correlation_id: correlationId,
			edit_history: [], // Initialize edit history
		};

		// Insert record
		const { data, error } = await supabaseClient
			.from("messages")
			.insert(messageRecord)
			.select("id")
			.single();

		if (error) {
			// Handle potential unique constraint violation (e.g., message already exists)
			if (error.code === '23505') { // Postgres unique violation code
				logWithCorrelation(correlationId, `Message ${messageId} already exists in chat ${chatId}. Attempting update.`, "warn");
				// Optionally, call updateMessageRecord here if desired behavior is upsert
				// For now, return success=false indicating creation failed due to duplicate
				return {
					success: false,
					error: `Message already exists: ${error.message}`,
					errorCode: error.code,
				};
			} else {
				logWithCorrelation(correlationId, `Error creating message: ${error.message}`, "error");
				return {
					success: false,
					error: error.message,
					errorCode: error.code,
				};
			}
		}

		logWithCorrelation(correlationId, `Created message with ID: ${data.id}`);
		return {
			success: true,
			data,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception creating message: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Input parameters for updating a message record.
 */
export interface UpdateMessageParams {
	/** Initialized Supabase client */
	supabaseClient: SupabaseClient<Database>;
	/** Telegram Message ID */
	messageId: number;
	/** Chat ID where the message was sent */
	chatId: number;
	// Fields to update - make all optional except identifiers
	/** Message date and time */
	messageDate?: Date;
	/** Date and time when the message was edited */
	editDate?: Date;
	/** Caption text for media */
	caption?: string | null;
	/** Type of media (photo, video, document, etc.) */
	mediaType?: string;
	/** Telegram file ID for downloading */
	fileId?: string;
	/** Unique file identifier from Telegram */
	fileUniqueId?: string;
	/** Storage path where the file is saved */
	storagePath?: string;
	/** Public URL to access the file */
	publicUrl?: string;
	/** MIME type of the file */
	mimeType?: string;
	/** File extension */
	extension?: string;
	/** Raw message data from Telegram */
	messageData?: Json;
	/** Current processing state */
	processingState?: string;
	/** Error message if processing failed */
	processingError?: string | null;
	/**
	 * Processed caption data from caption parsing
	 * @note This field is synchronized with analyzed_content - both fields are updated with the
	 * same data to maintain consistency across the application. The database trigger
	 * sync_caption_fields_trigger ensures they remain in sync.
	 */
	captionData?: Json | null;
	/**
	 * Structured analyzed content from caption parsing
	 * @note This field is synchronized with caption_data - both should contain the same data.
	 * When updating caption_data, ensure analyzed_content is also updated with the same value.
	 */
	analyzedContent?: Json | null;
	forwardInfo?: ForwardInfo | null; // Forward message information
	isForward?: boolean;             // Flag for forwarded messages
	isEdit?: boolean;                // Flag for edited messages
	editHistory?: Json;              // Edit history array
	additionalUpdates?: Record<string, any>; // Any additional custom updates
	correlationId: string;
}

/**
 * Update an existing message record in the database
 * 
 * @param params - The input parameters
 * @returns Operation result
 * @example
 * const result = await updateMessageRecord(
 *   {
 *     supabaseClient,
 *     messageId,
 *     chatId,
 *     messageDate,
 *     editDate,
 *     caption,
 *     mediaType,
 *     fileId,
 *     fileUniqueId,
 *     storagePath,
 *     publicUrl,
 *     mimeType,
 *     extension,
 *     messageData,
 *     processingState,
 *     processingError,
 *     captionData,
 *     correlationId,
 *   }
 * );
 * 
 * if (result.success) {
 *   console.log('Message updated successfully');
 * } else {
 *   console.error(`Failed to update message: ${result.error}`);
 * }
 */
export async function updateMessageRecord(
	params: UpdateMessageParams
): Promise<DbOperationResult> {
	const functionName = "updateMessageRecord";
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Updating MEDIA message record for ${messageId} in chat ${chatId}`);

	try {
		// Construct the update object, only including fields that are provided in params
		const updates: Partial<Database["public"]["Tables"]["messages"]["Update"]> = {
			updated_at: new Date().toISOString(),
			correlation_id: correlationId,
		};

		// Standard fields
		if (params.messageDate) updates.message_date = params.messageDate.toISOString();
		if (params.editDate) updates.last_edited_at = params.editDate.toISOString();
		if (params.caption !== undefined) updates.caption = params.caption;
		if (params.mediaType !== undefined) updates.media_type = params.mediaType;
		if (params.fileId !== undefined) updates.file_id = params.fileId;
		if (params.fileUniqueId !== undefined) updates.file_unique_id = params.fileUniqueId;
		if (params.storagePath !== undefined) updates.storage_path = params.storagePath;
		if (params.publicUrl !== undefined) updates.public_url = params.publicUrl;
		if (params.mimeType !== undefined) updates.mime_type = params.mimeType;
		if (params.extension !== undefined) updates.extension = params.extension;
		if (params.messageData !== undefined) updates.message_data = params.messageData;
		if (params.processingState !== undefined) updates.processing_state = params.processingState;
		if (params.processingError !== undefined) updates.processing_error = params.processingError;
		// Ensure both caption_data and analyzed_content are kept in sync when caption content changes
		if (params.captionData !== undefined) {
			updates.caption_data = params.captionData;
			// Also update analyzed_content with the same value to maintain consistency
			updates.analyzed_content = params.captionData;
		}
		
		// Forward message fields
		if (params.forwardInfo !== undefined) updates.forward_info = params.forwardInfo;
		if (params.isForward !== undefined) updates.is_forward = params.isForward;
		
		// Edit tracking fields
		if (params.isEdit !== undefined) updates.is_edit = params.isEdit;
		if (params.editHistory !== undefined) updates.edit_history = params.editHistory;
		
		// Additional custom updates from caller
		if (params.additionalUpdates && typeof params.additionalUpdates === 'object') {
			Object.entries(params.additionalUpdates).forEach(([key, value]) => {
				// Skip updating if the value is undefined to avoid overwriting existing values
				if (value !== undefined) {
					(updates as any)[key] = value;
				}
			});
		}

		// Ensure there's something to update
		if (Object.keys(updates).length === 0) {
			logWithCorrelation(correlationId, `No fields to update for message ${messageId}.`, "warn");
			return { success: true }; // No error, just nothing to do
		}

		// Perform the update based on telegram_message_id and chat_id
		const { error } = await supabaseClient
			.from("messages")
			.update(updates)
			.eq("telegram_message_id", messageId)
			.eq("chat_id", chatId);

		if (error) {
			logWithCorrelation(correlationId, `Error updating message ${messageId}: ${error.message}`, "error");
			return {
				success: false,
				error: error.message,
				errorCode: error.code,
			};
		}

		logWithCorrelation(correlationId, `Successfully updated message ${messageId}`);
		return { success: true };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception updating message ${messageId}: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Find a message record by Telegram message ID and chat ID
 * 
 * @param supabaseClient - The Supabase client
 * @param telegramMessageId - The Telegram message ID
 * @param chatId - The chat ID
 * @param correlationId - The correlation ID for request tracking
 * @returns Operation result with the found message
 * @example
 * const result = await findMessageByTelegramId(
 *   supabaseClient,
 *   12345,
 *   67890,
 *   correlationId
 * );
 * 
 * if (result.success && result.data) {
 *   console.log(`Found message with ID: ${result.data.id}`);
 * } else if (result.success) {
 *   console.log('Message not found');
 * } else {
 *   console.error(`Error finding message: ${result.error}`);
 * }
 */
export async function findMessageByTelegramId(
	supabaseClient: SupabaseClient<Database>,
	telegramMessageId: number,
	chatId: number,
	correlationId: string
): Promise<DbOperationResult<MessageRecord | null>> {
	const functionName = 'findMessageByTelegramId';
	logWithCorrelation(correlationId, `Finding message ${telegramMessageId} in chat ${chatId}`);

	try {
		const { data, error } = await supabaseClient
			.from('messages')
			.select('*')
			.eq('telegram_message_id', telegramMessageId)
			.eq('chat_id', chatId)
			.maybeSingle();

		if (error) {
			logWithCorrelation(correlationId, `Error finding message: ${error.message}`, "error");
			return {
				success: false,
				error: error.message,
				errorCode: error.code,
			};
		}

		if (data) {
			logWithCorrelation(correlationId, `Found message with ID: ${data.id}`);
		} else {
			logWithCorrelation(correlationId, `Message not found`);
		}

		return {
			success: true,
			data,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception finding message: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Find a message record by file unique ID
 * 
 * @param supabaseClient - The Supabase client
 * @param fileUniqueId - The file unique ID
 * @param correlationId - The correlation ID for request tracking
 * @returns Operation result with the found message
 * @example
 * const result = await findMessageByFileUniqueId(
 *   supabaseClient,
 *   'abc123',
 *   correlationId
 * );
 * 
 * if (result.success && result.data) {
 *   console.log(`Found message with ID: ${result.data.id}`);
 * } else if (result.success) {
 *   console.log('Message not found');
 * } else {
 *   console.error(`Error finding message: ${result.error}`);
 * }
 */
export async function findMessageByFileUniqueId(
	supabaseClient: SupabaseClient<Database>,
	fileUniqueId: string,
	correlationId: string
): Promise<DbOperationResult<MessageRecord | null>> {
	const functionName = 'findMessageByFileUniqueId';
	logWithCorrelation(correlationId, `Finding message with file_unique_id ${fileUniqueId}`);

	try {
		const { data, error } = await supabaseClient
			.from('messages')
			.select('*')
			.eq('file_unique_id', fileUniqueId)
			.maybeSingle();

		if (error) {
			logWithCorrelation(correlationId, `Error finding message: ${error.message}`, "error");
			return {
				success: false,
				error: error.message,
				errorCode: error.code,
			};
		}

		if (data) {
			logWithCorrelation(correlationId, `Found message with ID: ${data.id}`);
		} else {
			logWithCorrelation(correlationId, `Message not found`);
		}

		return {
			success: true,
			data,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception finding message: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Update message with error information
 * 
 * @param supabaseClient - The Supabase client
 * @param messageId - The database message ID
 * @param errorMessage - The error message
 * @param errorType - The error type
 * @param correlationId - The correlation ID for request tracking
 * @returns Operation result
 * @example
 * const result = await updateMessageWithError(
 *   supabaseClient,
 *   'abc-123',
 *   'Failed to process media',
 *   'MediaProcessingError',
 *   correlationId
 * );
 * 
 * if (result.success) {
 *   console.log('Message updated with error information');
 * } else {
 *   console.error(`Failed to update message: ${result.error}`);
 * }
 */
export async function updateMessageWithError(
	supabaseClient: SupabaseClient<Database>,
	messageId: string,
	errorMessage: string,
	errorType: string,
	correlationId: string
): Promise<DbOperationResult> {
	const functionName = 'updateMessageWithError';
	logWithCorrelation(correlationId, `Updating message ${messageId} with error`);

	try {
		// Update record with error information
		const { error } = await supabaseClient
			.from('messages')
			.update({
				processing_state: 'error',
				error_message: errorMessage,
				error_type: errorType,
				last_error_at: new Date().toISOString(),
				correlation_id: correlationId
			})
			.eq('id', messageId);

		if (error) {
			logWithCorrelation(correlationId, `Error updating message: ${error.message}`, "error");
			return {
				success: false,
				error: error.message,
				errorCode: error.code,
			};
		}

		logWithCorrelation(correlationId, `Updated message ${messageId} with error`);
		return {
			success: true
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception updating message: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Log a processing event to the audit log
 * 
 * @param supabaseClient - The Supabase client
 * @param eventType - The type of event
 * @param entityId - The entity ID (message ID)
 * @param correlationId - The correlation ID for request tracking
 * @param metadata - Additional metadata
 * @param errorMessage - Error message if applicable
 * @returns Operation result with the created audit log ID
 * @example
 * const result = await logProcessingEvent(
 *   supabaseClient,
 *   'media_processed',
 *   'abc-123',
 *   correlationId,
 *   { file_size: 12345, mime_type: 'image/jpeg' }
 * );
 * 
 * if (result.success) {
 *   console.log(`Created audit log with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to create audit log: ${result.error}`);
 * }
 */
export async function logProcessingEvent(
	supabaseClient: SupabaseClient<Database> | any,
	eventType: string,
	entityId: string | null,
	correlationId: string,
	metadata?: Record<string, any>,
	errorMessage?: string
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = 'logProcessingEvent';

	try {
		// Validate that we have a valid supabaseClient with a 'from' method
		if (!supabaseClient || typeof supabaseClient.from !== 'function') {
			logWithCorrelation(correlationId, `Invalid supabaseClient provided to logProcessingEvent`, "error");
			return {
				success: false,
				error: 'Invalid supabaseClient: missing from method',
			};
		}

		// Validate UUID format using regex or create valid UUID
		const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (!entityId || !uuidPattern.test(entityId)) {
			// Generate a UUID v4 (random)
			const originalEntityId = entityId;
			entityId = crypto.randomUUID();
			logWithCorrelation(correlationId, `Generated new UUID for invalid entity_id: ${originalEntityId || 'undefined'}`, "warn");
		}

		try {
			// Create audit log entry
			const { data, error } = await supabaseClient
				.from('unified_audit_logs')
				.insert({
					event_type: eventType,
					entity_id: entityId,
					correlation_id: correlationId,
					metadata: metadata || {},
					error_message: errorMessage
				})
				.select('id')
				.single();

			if (error) {
				logWithCorrelation(correlationId, `Error creating audit log: ${error.message}`, "error");
				return {
					success: false,
					error: error.message,
					errorCode: error.code,
				};
			}

			return {
				success: true,
				data
			};
		} catch (innerError) {
			// Handle specific Supabase API errors
			const innerErrorMessage = innerError instanceof Error ? innerError.message : String(innerError);
			logWithCorrelation(correlationId, `Inner exception creating audit log: ${innerErrorMessage}`, "error");
			return {
				success: false,
				error: `Database operation failed: ${innerErrorMessage}`,
			};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception creating audit log: ${errorMessage}`, "error");
		return {
			success: false,
			error: `Unexpected error: ${errorMessage}`,
		};
	}
}

/**
 * Extracts forward information from a Telegram message and formats it according
 * to our standardized ForwardInfo interface.
 * 
 * This function is used for both media and text messages to ensure
 * consistent handling of forward information across the application.
 * 
 * @param message - The Telegram message containing forward data
 * @returns A standardized ForwardInfo object or undefined if the message is not forwarded
 */
export function extractForwardInfo(message: TelegramMessage): ForwardInfo | undefined {
	if (!message) return undefined;
	// Add a check for message validity
	if (!message || typeof message !== 'object') return undefined;

	// Check if message is forwarded
	if (!message.forward_date) return undefined;

	const forwardInfo: ForwardInfo = {
		// Required field (should always be present in forwarded messages)
		date: message.forward_date,
		
		// Optional fields (may not be present depending on forward type)
		fromChatId: message.forward_from_chat?.id,
		fromChatType: message.forward_from_chat?.type,
		fromChatTitle: message.forward_from_chat?.title,
		fromMessageId: message.forward_from_message_id,
		fromUserId: message.forward_from?.id,
		fromUserIsBot: message.forward_from?.is_bot,
		fromName: message.forward_sender_name,
		signature: message.forward_signature
	};

	return forwardInfo;
}

/**
 * Input parameters for creating a record in the other_messages table.
 * @deprecated Use UpsertTextMessageParams instead for consistent handling with media messages
 */
export interface CreateOtherMessageParams {
	supabaseClient: SupabaseClient<Database>;
	messageId: number;
	chatId: number;
	userId?: number;
	messageDate: Date;
	messageType?: string; // e.g., 'text', 'sticker', 'service'
	text?: string | null;
	rawMessageData: Json;
	chatType?: string | null;
	chatTitle?: string | null;
	correlationId: string;
}

/**
 * Input parameters for upserting a text message record in the other_messages table.
 * 
 * Note: The PostgreSQL function extracts certain fields (like message_date) directly 
 * from the messageData, but we provide all other parameters to avoid function signature
 * ambiguity issues.
 */
export interface UpsertTextMessageParams {
	supabaseClient: SupabaseClient<Database>;
	messageId: number;
	chatId: number;
	messageText: string | null;
	messageData: Json;
	correlationId: string;
	chatType?: string | null;
	chatTitle?: string | null;
	forwardInfo?: ForwardInfo | null;
	processingState?: string;
	processingError?: string | null;
}

/**
 * Fallback function to directly insert a text message into the other_messages table
 * when the RPC function fails. This bypasses the PostgreSQL function ambiguity issues.
 * 
 * @param params - The input parameters for the text message
 * @returns Operation result with the inserted message ID
 */
async function insertTextMessageFallback(
	params: UpsertTextMessageParams
): Promise<DbOperationResult<{ id: string }>> {
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Using direct insert fallback for text message ${messageId} in chat ${chatId}`);
	
	try {
		// Extract message date from messageData
		const messageDate = new Date((params.messageData.date as number) * 1000);
		
		// Validate chat type
		const rawChatType = params.chatType || params.messageData?.chat?.type;
		const chatType = validateChatType(rawChatType);
		const chatTitle = params.chatTitle || params.messageData?.chat?.title;
		
		// Check if record already exists (to handle upsert logic)
		const { data: existingMessage, error: findError } = await supabaseClient
			.from('other_messages')
			.select('id')
			.eq('telegram_message_id', messageId)
			.eq('chat_id', chatId)
			.maybeSingle();
		
		if (findError) {
			logWithCorrelation(correlationId, `Error checking for existing message: ${findError.message}`, "error");
			return { success: false, error: findError.message };
		}
		
		let result;
		
		// Insert or update based on existence
		if (existingMessage) {
			// Update existing record
			result = await supabaseClient
				.from('other_messages')
				.update({
					message_text: params.messageText,
					telegram_data: params.messageData,
					chat_type: chatType,
					chat_title: chatTitle,
					processing_state: params.processingState || 'pending_analysis',
					processing_error: params.processingError,
					forward_info: params.forwardInfo,
					correlation_id: correlationId,
					updated_at: new Date().toISOString()
				})
				.eq('id', existingMessage.id)
				.select('id')
				.single();
				
			logWithCorrelation(correlationId, `Updated existing text message with ID: ${existingMessage.id}`);
		} else {
			// Insert new record
			result = await supabaseClient
				.from('other_messages')
				.insert({
					telegram_message_id: messageId,
					chat_id: chatId,
					chat_type: chatType,
					chat_title: chatTitle,
					message_date: messageDate.toISOString(),
					message_type: 'text',
					message_text: params.messageText,
					telegram_data: params.messageData,
					processing_state: params.processingState || 'pending_analysis',
					processing_error: params.processingError,
					forward_info: params.forwardInfo,
					correlation_id: correlationId,
					edit_history: '[]',
					is_edited: false,
					edit_count: 0
				})
				.select('id')
				.single();
				
			logWithCorrelation(correlationId, `Inserted new text message via fallback method`);
		}
		
		if (result.error) {
			logWithCorrelation(correlationId, `Failed in fallback insert/update: ${result.error.message}`, "error");
			return { success: false, error: result.error.message };
		}
		
		logWithCorrelation(correlationId, `Fallback method successful for text message ID: ${result.data.id}`);
		return { success: true, data: { id: result.data.id } };
		
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logWithCorrelation(correlationId, `Exception in fallback text message insert: ${errorMessage}`, "error");
		return {
			success: false,
			error: `Fallback insert failed: ${errorMessage}`
		};
	}
}

/**
 * @param params - The input parameters for the other message.
 * @returns Operation result with the created message ID.
 * @example
 * const result = await createOtherMessageRecord({
 *   supabaseClient,
 *   messageId: 123,
 *   chatId: 456,
 *   userId: 789,
 *   messageDate: new Date(),
 *   messageType: 'text',
 *   text: 'Hello world',
 *   rawMessageData: { ... },
 *   chatType: 'private',
 *   correlationId: 'xyz',
 * });
 * if (result.success) {
 *   console.log(`Created other_message with ID: ${result.data.id}`);
 * }
 */
export async function createOtherMessageRecord(
	params: CreateOtherMessageParams
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = "createOtherMessageRecord";
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Creating OTHER message record for ${messageId} in chat ${chatId}`);

	try {
		const record: Omit<Database["public"]["Tables"]["other_messages"]["Insert"], "id" | "created_at" | "updated_at"> = {
			telegram_message_id: messageId,
			chat_id: chatId,
			user_id: params.userId ? String(params.userId) : undefined, // Assuming user_id in other_messages is uuid or text
			message_date: params.messageDate.toISOString(),
			message_type: params.messageType,
			message_text: params.text,
			telegram_data: params.rawMessageData,
			chat_type: params.chatType, // Use the specific chat_type from params
			chat_title: params.chatTitle,
			correlation_id: correlationId,
			// Set defaults for other potentially nullable fields if needed
			processing_state: 'completed', // Assuming simple text messages are completed on arrival
			is_edited: false,
			retry_count: 0
		};

		const { data, error } = await supabaseClient
			.from("other_messages") // Target the new table
			.insert(record)
			.select("id")
			.single();

		if (error) {
			// Handle potential unique constraint violation if message already exists
			if (error.code === '23505') { // Unique violation code for telegram_message_id + chat_id
				logWithCorrelation(correlationId, `Other message ${messageId} in chat ${chatId} already exists. Skipping insertion.`, "warn");
				// Optionally, find and return the existing ID
				const findResult = await supabaseClient
					.from("other_messages")
					.select("id")
					.eq("telegram_message_id", messageId)
					.eq("chat_id", chatId)
					.maybeSingle();
				if (findResult.data) {
					return { success: true, data: { id: findResult.data.id } }; 
				} else {
					// Should not happen if unique constraint failed, but handle defensively
					return { success: true }; // Indicate success as it exists
				}
			}
			logWithCorrelation(correlationId, `Failed to insert other_message: ${error.message}`, "error", { code: error.code });
			return { success: false, error: error.message, errorCode: error.code };
		}

		logWithCorrelation(correlationId, `Successfully created other_message record with ID: ${data?.id}`);
		return { success: true, data };

	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logWithCorrelation(correlationId, `Exception in ${functionName}: ${errorMessage}`, "error");
		return { success: false, error: errorMessage };
	}
}

/**
 * Upsert a text message record in the other_messages table using the database function.
 * This handles duplicates by updating the existing record if a message with the same
 * telegram_message_id and chat_id already exists.
 *
 * @param params - The input parameters for the text message
 * @returns Operation result with the upserted message ID
 * @example
 * const result = await upsertTextMessageRecord({
 *   supabaseClient,
 *   messageId: 123,
 *   chatId: 456,
 *   messageText: 'Hello world',
 *   messageData: { ... }, // The complete Telegram message
 *   chatType: 'private',
 *   chatTitle: 'My Chat',
 *   forwardInfo: { ... },
 *   correlationId: 'xyz',
 *   processingState: 'pending_analysis',
 *   processingError: null
 * });
 * 
 * if (result.success) {
 *   console.log(`Text message upserted with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to upsert text message: ${result.error}`);
 * }
 */
export async function upsertTextMessageRecord(
	params: UpsertTextMessageParams
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = "upsertTextMessageRecord";
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Upserting text message record for ${messageId} in chat ${chatId}`);

	try {
		// Create parameter object for the RPC call with exact parameter order matching the PostgreSQL function
		// The order and naming here must match exactly with the PostgreSQL function declaration
		const paramObject = {
			p_telegram_message_id: messageId,
			p_chat_id: chatId,
			p_message_text: params.messageText || null,
			p_message_data: params.messageData,
			p_correlation_id: correlationId,
			p_chat_type: params.chatType || null,
			p_chat_title: params.chatTitle || null,
			p_forward_info: params.forwardInfo || null,
			p_processing_state: params.processingState || 'pending_analysis',
			p_processing_error: params.processingError || null
		};

		// Call the RPC function
		const { data, error } = await supabaseClient
			.rpc('upsert_text_message', paramObject)
			.single();

		if (error) {
			logWithCorrelation(correlationId, `Failed to upsert text message via RPC: ${error.message}`, "warn", { code: error.code });
			
			// If we encounter function ambiguity error, try the direct insert fallback
			if (error.message.includes('Could not choose the best candidate function') || 
				error.code === 'PGRST203') {
				logWithCorrelation(correlationId, `Function ambiguity detected. Trying direct insert fallback...`, "warn");
				return await insertTextMessageFallback(params);
			}
			
			return { success: false, error: error.message, errorCode: error.code };
		}

		logWithCorrelation(correlationId, `Successfully upserted text message with ID: ${data}`);
		return { success: true, data: { id: data } };

	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);
		logWithCorrelation(correlationId, `Exception upserting text message: ${errorMessage}`, "error");
		
		// Try fallback method if RPC fails
		logWithCorrelation(correlationId, `Trying direct insert fallback after exception...`, "warn");
		return await insertTextMessageFallback(params);
	}
}

/**
 * Input parameters for upserting a media message record in the messages table.
 * 
 * Note: The PostgreSQL function extracts certain fields (like message_date, chat_type,
 * and chat_title) directly from the messageData, so we don't need to provide these separately.
 */
export interface UpsertMediaMessageParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Chat ID where the message was sent */
  chatId: number;
  /** Caption text for media (optional) */
  caption?: string | null;
  /** Type of media (photo, video, document, etc.) */
  mediaType?: string | null;
  /** Telegram file ID for downloading */
  fileId?: string | null;
  /** Unique file identifier from Telegram - used as unique constraint */
  fileUniqueId?: string | null;
  /** Storage path where the file is saved */
  storagePath?: string | null;
  /** Public URL to access the file */
  publicUrl?: string | null;
  /** MIME type of the file */
  mimeType?: string | null;
  /** File extension */
  extension?: string | null;
  /** Raw message data from Telegram */
  messageData: Json;
  /** Current processing state */
  processingState: ProcessingState;
  /** Error message if processing failed */
  processingError?: string | null;
  /** Forward information if message is forwarded */
  forwardInfo?: ForwardInfo | null;
  /** Media group ID if part of a media group */
  mediaGroupId?: string | null;
  /**
   * Processed caption data from caption parsing
   * @note This field is synchronized with analyzed_content - both fields are updated with the
   * same data to maintain consistency across the application. The database trigger
   * sync_caption_fields_trigger ensures they remain in sync.
   */
  captionData?: Json | null;
  /** Correlation ID for request tracking */
  correlationId: string;
}

/**
 * Upsert a media message record in the database using the database function.
 * This handles the duplicate file_unique_id constraint by updating the existing record
 * if a message with the same file_unique_id already exists.
 * 
 * @param params - The input parameters
 * @returns Operation result with the created or updated message ID
 * @example
 * const result = await upsertMediaMessageRecord({
 *   supabaseClient,
 *   messageId: 12345,
 *   chatId: 67890,
 *   userId: 11223,
 *   messageDate: new Date(),
 *   caption: "Sample photo",
 *   mediaType: "photo",
 *   fileId: "AgADBAADv6kxG-1fAUgQ8P4AAQNLrOVKiwAEgQ",
 *   fileUniqueId: "AQADkK4xG_cN6EZ-",
 *   storagePath: "AQADkK4xG_cN6EZ-.jpeg",
 *   publicUrl: "https://example.com/storage/AQADkK4xG_cN6EZ-.jpeg",
 *   mimeType: "image/jpeg",
 *   extension: "jpeg",
 *   messageData: { message: "Telegram message object" },
 *   processingState: "processed",
 *   correlationId: "abc-123"
 * });
 * if (result.success) {
 *   console.log(`Message upserted with ID: ${result.data.id}`);
 * } else {
 *   console.error(`Failed to upsert message: ${result.error}`);
 * }
 */
export async function upsertMediaMessageRecord(
  params: UpsertMediaMessageParams
): Promise<DbOperationResult<{ id: string }>> {
  const functionName = "upsertMediaMessageRecord";
  const { correlationId, messageId, chatId, supabaseClient } = params;
  logWithCorrelation(correlationId, `Upserting media message record for ${messageId} in chat ${chatId}`);

  try {
    // Prepare parameters for the database function call
    // Handle schema flexibility by using a parameter object
    
    // Ensure both caption_data and analyzed_content are set to the same value for consistency
    // This addresses the field mismatch issue where some code paths use caption_data while others use analyzed_content
    const captionAnalysisData = params.captionData as Json | null;
    
    const rpcParams: Record<string, any> = {
      p_telegram_message_id: messageId,
      p_chat_id: chatId,
      p_file_unique_id: params.fileUniqueId,
      p_file_id: params.fileId,
      p_storage_path: params.storagePath,
      p_public_url: params.publicUrl,
      p_mime_type: params.mimeType,
      p_extension: params.extension,
      p_media_type: params.mediaType,
      p_caption: params.caption,
      p_processing_state: params.processingState,
      p_message_data: params.messageData,
      p_correlation_id: correlationId,
      // p_user_id removed as it's not used in PostgreSQL function
      p_media_group_id: params.mediaGroupId,
      p_forward_info: params.forwardInfo as Json | null,
      p_processing_error: params.processingError,
      p_caption_data: captionAnalysisData,
      // Also provide the same data for analyzed_content to ensure consistency
      p_analyzed_content: captionAnalysisData
    };
    
    // Call the database function to handle the upsert
    const { data, error } = await supabaseClient.rpc('upsert_media_message', rpcParams);

    if (error) {
      logWithCorrelation(correlationId, `Error upserting media message: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }

    // The function returns the message ID
    const dbMessageId = data;
    
    logWithCorrelation(correlationId, `Successfully upserted media message with ID: ${dbMessageId}`);
    
    // Log the event
    await logProcessingEvent(
      supabaseClient,
      'media_message_upserted',
      dbMessageId,
      correlationId,
      {
        telegram_message_id: params.messageId,
        chat_id: params.chatId,
        file_unique_id: params.fileUniqueId,
        media_type: params.mediaType
      }
    );

    return {
      success: true,
      data: { id: dbMessageId }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception upserting media message: ${errorMessage}`, 'ERROR');
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Find all messages in a media group
 * 
 * @param supabaseClient - The Supabase client
 * @param mediaGroupId - The media group ID
 * @param correlationId - The correlation ID for request tracking
 * @returns Operation result with the found messages
 * @example
 * const result = await findMessagesByMediaGroupId(
 *   supabaseClient,
 *   "12345678",
 *   correlationId
 * );
 * 
 * if (result.success && result.data && result.data.length > 0) {
 *   console.log(`Found ${result.data.length} messages in media group`);
 * } else {
 *   console.error(`Error finding messages in media group: ${result.error}`);
 * }
 */
export async function findMessagesByMediaGroupId(
  supabaseClient: SupabaseClient<Database>,
  mediaGroupId: string,
  correlationId: string
): Promise<DbOperationResult<MessageRecord[]>> {
  const functionName = 'findMessagesByMediaGroupId';
  logWithCorrelation(correlationId, `Finding messages in media group ${mediaGroupId}`, 'INFO', functionName);

  try {
    // Query for messages with the same media_group_id
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId);

    if (error) {
      logWithCorrelation(correlationId, `Error finding messages in media group: ${error.message}`, 'ERROR', functionName);
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }

    if (!data || data.length === 0) {
      logWithCorrelation(correlationId, `No messages found in media group ${mediaGroupId}`, 'INFO', functionName);
      return {
        success: true,
        data: []
      };
    }

    logWithCorrelation(correlationId, `Found ${data.length} messages in media group ${mediaGroupId}`, 'INFO', functionName);
    return {
      success: true,
      data: data as MessageRecord[]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception finding messages in media group: ${errorMessage}`, 'ERROR', functionName);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Update all messages in a media group with the same caption and caption data
 * 
 * This function ensures all messages in a media group have consistent captions, and
 * also synchronizes both caption_data and analyzed_content fields to the same value.
 * When a caption is edited for one message in the group, it propagates that change
 * to all related messages in the same media group.
 * 
 * @param supabaseClient - The Supabase client
 * @param mediaGroupId - The media group ID
 * @param excludeMessageId - Message ID to exclude from the update (usually the one that triggered the update)
 * @param caption - The new caption
 * @param captionData - The new caption data (will be used for both caption_data and analyzed_content fields)
 * @param processingState - The new processing state
 * @param correlationId - The correlation ID for request tracking
 * @returns Operation result
 * @example
 * const result = await syncMediaGroupCaptions(
 *   supabaseClient,
 *   "12345678",
 *   "abc-123",
 *   "New caption",
 *   { parsed_data: "..." },
 *   "initialized",
 *   correlationId
 * );
 */
export async function syncMediaGroupCaptions(
  supabaseClient: SupabaseClient<Database>,
  mediaGroupId: string,
  excludeMessageId: string,
  caption: string | null,
  captionData: Json | null,
  processingState: ProcessingState,
  correlationId: string
): Promise<DbOperationResult<void>> {
  const functionName = 'syncMediaGroupCaptions';
  logWithCorrelation(correlationId, `Syncing captions for media group ${mediaGroupId}`, 'INFO', functionName);

  try {
    // Find all messages in the media group
    const groupMessagesResult = await findMessagesByMediaGroupId(
      supabaseClient,
      mediaGroupId,
      correlationId
    );

    if (!groupMessagesResult.success || !groupMessagesResult.data) {
      return {
        success: false,
        error: groupMessagesResult.error || 'Failed to find messages in media group'
      };
    }

    const groupMessages = groupMessagesResult.data;
    if (groupMessages.length === 0) {
      logWithCorrelation(correlationId, `No other messages found in media group ${mediaGroupId}`, 'INFO', functionName);
      return { success: true };
    }

    // Filter out the message that triggered the update
    const messagesToUpdate = groupMessages.filter(msg => msg.id !== excludeMessageId);
    if (messagesToUpdate.length === 0) {
      logWithCorrelation(correlationId, `No other messages to update in media group ${mediaGroupId}`, 'INFO', functionName);
      return { success: true };
    }

    logWithCorrelation(correlationId, `Updating ${messagesToUpdate.length} other messages in media group ${mediaGroupId}`, 'INFO', functionName);

    // Update each message in the group with the new caption and caption data
    for (const message of messagesToUpdate) {
      // Skip if the message already has the same caption
      if (message.caption === caption) {
        continue;
      }

      // Prepare update data
      const updateData: Record<string, any> = {
        caption,
        processing_state: processingState,
        // Ensure both fields have the same value for consistency
        caption_data: captionData,
        analyzed_content: captionData
      };

      // If the message has analyzed content, move it to old_analyzed_content to maintain edit history
      if (message.analyzed_content) {
        updateData.old_analyzed_content = message.old_analyzed_content 
          ? [...(message.old_analyzed_content as any[]), message.analyzed_content]
          : [message.analyzed_content];
      }

      // Update the message
      const { error } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', message.id);

      if (error) {
        logWithCorrelation(correlationId, `Error updating message ${message.id} in media group: ${error.message}`, 'ERROR', functionName);
        // Continue with other messages even if one fails
      }
    }

    logWithCorrelation(correlationId, `Successfully synced captions for media group ${mediaGroupId}`, 'INFO', functionName);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception syncing media group captions: ${errorMessage}`, 'ERROR', functionName);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Input parameters for triggering caption parsing.
 */
export interface TriggerCaptionParsingParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Message ID to process */
  messageId: string;
  /** Correlation ID for request tracking */
  correlationId: string;
}

/**
 * Triggers the caption parser for a message.
 * This should be called when a caption has been updated and needs to be reprocessed.
 * 
 * @param params - The input parameters
 * @returns Operation result with success status
 * @example
 * const result = await triggerCaptionParsing({
 *   supabaseClient,
 *   messageId: "123e4567-e89b-12d3-a456-426614174000",
 *   correlationId: "abc-123"
 * });
 * 
 * if (result.success) {
 *   console.log("Caption parsing triggered successfully");
 * } else {
 *   console.error(`Failed to trigger caption parsing: ${result.error}`);
 * }
 */
export async function triggerCaptionParsing(
  params: TriggerCaptionParsingParams
): Promise<DbOperationResult<void>> {
  const { supabaseClient, messageId, correlationId } = params;
  const functionName = "triggerCaptionParsing";
  
  logWithCorrelation(correlationId, `Triggering caption parsing for message ${messageId}`, 'INFO', functionName);
  
  try {
    // First, get the message to check if it has a caption and media group ID
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, caption, processing_state, media_group_id')
      .eq('id', messageId)
      .single();
    
    if (fetchError) {
      logWithCorrelation(correlationId, `Error fetching message ${messageId}: ${fetchError.message}`, 'ERROR', functionName);
      return {
        success: false,
        error: fetchError.message,
        errorCode: fetchError.code
      };
    }
    
    if (!message) {
      logWithCorrelation(correlationId, `Message ${messageId} not found`, 'ERROR', functionName);
      return {
        success: false,
        error: 'Message not found'
      };
    }
    
    if (!message.caption) {
      logWithCorrelation(correlationId, `Message ${messageId} has no caption to parse`, 'WARN', functionName);
      return {
        success: true,
        data: undefined
      };
    }
    
    // Call the manual caption parser Edge Function
    const parserUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/manual-caption-parser`;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!parserUrl || !serviceKey) {
      const errorMsg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for caption parser call';
      logWithCorrelation(correlationId, `CRITICAL: ${errorMsg}`, 'ERROR', functionName);
      
      await logProcessingEvent(
        supabaseClient,
        'caption_parser_invoke_error',
        messageId,
        correlationId,
        { error: 'Missing env vars for parser' },
        errorMsg
      );
      
      return {
        success: false,
        error: errorMsg
      };
    }
    
    const parserPayload = {
      messageId,
      correlationId,
      isEdit: true
    };
    
    logWithCorrelation(correlationId, `Calling manual caption parser for message ${messageId}`, 'INFO', functionName);
    
    const response = await fetch(parserUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'x-client-info': 'supabase-edge-function-mediaMessageHandler'
      },
      body: JSON.stringify(parserPayload)
    });
    
    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `Error invoking caption parser. Status: ${response.status}, Body: ${errorBody}`;
      logWithCorrelation(correlationId, errorMsg, 'ERROR', functionName);
      
      await logProcessingEvent(
        supabaseClient,
        'caption_parser_invoke_failed',
        messageId,
        correlationId,
        { status: response.status, errorBody },
        `Caption parser invocation failed with status ${response.status}`
      );
      
      return {
        success: false,
        error: errorMsg
      };
    }
    
    logWithCorrelation(correlationId, `Successfully invoked caption parser for message ${messageId}`, 'INFO', functionName);
    
    await logProcessingEvent(
      supabaseClient,
      'caption_parser_invoked',
      messageId,
      correlationId,
      { isEdit: true }
    );
    
    // If this message is part of a media group, we need to sync the analyzed content
    // after the caption parser has completed its work
    if (message.media_group_id) {
      logWithCorrelation(correlationId, `Message ${messageId} is part of media group ${message.media_group_id}. Will sync analyzed content after processing.`, 'INFO', functionName);
      
      // We need to wait a bit for the caption parser to complete its work
      // before syncing the analyzed content
      setTimeout(async () => {
        try {
          // Get the updated message with analyzed content
          const { data: updatedMessage, error: fetchUpdatedError } = await supabaseClient
            .from('messages')
            .select('id, analyzed_content, caption, caption_data, media_group_id')
            .eq('id', messageId)
            .single();
          
          if (fetchUpdatedError || !updatedMessage) {
            logWithCorrelation(correlationId, `Error fetching updated message for media group sync: ${fetchUpdatedError?.message || 'Message not found'}`, 'ERROR', functionName);
            return;
          }
          
          // Only sync if we have analyzed content
          if (updatedMessage.analyzed_content) {
            logWithCorrelation(correlationId, `Syncing analyzed content for media group ${updatedMessage.media_group_id}`, 'INFO', functionName);
            
            // Call the database function to sync media group
            const { data: syncResult, error: syncError } = await supabaseClient.rpc('xdelo_sync_media_group', {
              p_source_message_id: messageId,
              p_media_group_id: updatedMessage.media_group_id,
              p_correlation_id: correlationId,
              p_force_sync: true,
              p_sync_edit_history: true
            });
            
            if (syncError) {
              logWithCorrelation(correlationId, `Error syncing media group: ${syncError.message}`, 'ERROR', functionName);
              await logProcessingEvent(
                supabaseClient,
                'media_group_sync_failed',
                messageId,
                correlationId,
                { 
                  media_group_id: updatedMessage.media_group_id,
                  error: syncError.message
                },
                syncError.message
              );
            } else {
              logWithCorrelation(correlationId, `Successfully synced media group ${updatedMessage.media_group_id}. Synced ${syncResult.synced_count} messages.`, 'INFO', functionName);
              await logProcessingEvent(
                supabaseClient,
                'media_group_synced_after_caption_parsing',
                messageId,
                correlationId,
                { 
                  media_group_id: updatedMessage.media_group_id,
                  synced_count: syncResult.synced_count
                }
              );
            }
          } else {
            logWithCorrelation(correlationId, `No analyzed content available yet for message ${messageId}. Media group sync skipped.`, 'WARN', functionName);
          }
        } catch (syncError) {
          const syncErrorMsg = syncError instanceof Error ? syncError.message : String(syncError);
          logWithCorrelation(correlationId, `Exception during media group sync: ${syncErrorMsg}`, 'ERROR', functionName);
          await logProcessingEvent(
            supabaseClient,
            'media_group_sync_exception',
            messageId,
            correlationId,
            { error: syncErrorMsg },
            syncErrorMsg
          );
        }
      }, 5000); // Wait 5 seconds for the caption parser to complete
    }
    
    return {
      success: true,
      data: undefined
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception triggering caption parsing: ${errorMessage}`, 'ERROR', functionName);
    
    await logProcessingEvent(
      supabaseClient,
      'caption_parser_invoke_exception',
      messageId,
      correlationId,
      { error: errorMessage },
      errorMessage
    );
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
