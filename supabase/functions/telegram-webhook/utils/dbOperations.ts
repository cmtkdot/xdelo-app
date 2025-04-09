/**
 * dbOperations.ts
 * 
 * Higher-level database operation functions for Telegram webhook handlers.
 * These functions encapsulate common database patterns and implement
 * proper TypeScript interfaces for improved type safety.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { TelegramMessage, ForwardInfo, Updates } from "../types.ts";
import { ProcessingResult } from "../../_shared/MediaProcessor.ts";
import { Database, Json } from "../../_shared/types.ts";
import { logWithCorrelation } from "./logger.ts";

/**
 * Define ProcessingState type
 */
export type ProcessingState =
	| "initialized"
	| "pending"
	| "processing"
	| "processed"
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
	/** Processed caption data */
	caption_data?: Json | null;
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
export async function createMessageRecord(
	params: CreateMessageParams
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = "createMessageRecord";
	const { correlationId, messageId, chatId, supabaseClient } = params;
	logWithCorrelation(correlationId, `Creating MEDIA message record for ${messageId} in chat ${chatId}`);

	try {
		// Prepare message record from params
		const messageRecord: Omit<Database["public"]["Tables"]["messages"]["Insert"], "id" | "created_at" | "updated_at"> = {
			telegram_message_id: messageId,
			chat_id: chatId,
			chat_type: params.messageData?.chat?.type, // Extract from messageData if possible
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
	supabaseClient: SupabaseClient<Database>;
	messageId: number; // Telegram Message ID
	chatId: number;
	// Fields to update - make all optional except identifiers
	messageDate?: Date; // Keep for potential future use?
	editDate?: Date | null;
	caption?: string | null; // Allow updating caption
	mediaType?: string | null;
	fileId?: string | null;
	fileUniqueId?: string | null;
	storagePath?: string | null;
	publicUrl?: string | null;
	mimeType?: string | null;
	extension?: string | null;
	messageData?: Json;
	processingState?: ProcessingState;
	processingError?: string | null;
	captionData?: Json | null;
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
		if (params.captionData !== undefined) updates.caption_data = params.captionData;
		// Optionally add logic to push to edit_history if needed

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
	supabaseClient: SupabaseClient<Database>,
	eventType: string,
	entityId: string,
	correlationId: string,
	metadata?: Record<string, any>,
	errorMessage?: string
): Promise<DbOperationResult<{ id: string }>> {
	const functionName = 'logProcessingEvent';

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
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logWithCorrelation(correlationId, `Exception creating audit log: ${errorMessage}`, "error");
		return {
			success: false,
			error: errorMessage,
		};
	}
}

/**
 * Extract forward information from a Telegram message
 * 
 * @param message - The Telegram message
 * @returns Forward information or undefined if not forwarded
 */
function extractForwardInfo(message: TelegramMessage): ForwardInfo | undefined {
	if (!message) return undefined;

	// Check if message is forwarded
	if (!message.forward_date) return undefined;

	const forwardInfo: ForwardInfo = {
		date: message.forward_date,
		fromChatId: message.forward_from_chat?.id,
		fromChatType: message.forward_from_chat?.type,
		fromMessageId: message.forward_from_message_id,
		fromName: message.forward_sender_name,
		fromUserId: message.forward_from?.id,
		fromUserIsBot: message.forward_from?.is_bot,
		signature: message.forward_signature
	};

	return forwardInfo;
}

/**
 * Input parameters for creating a record in the other_messages table.
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
 * Create a new record in the other_messages table.
 *
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
 * Input parameters for upserting a media message record.
 */
export interface UpsertMediaMessageParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient<Database>;
  /** Telegram message ID */
  messageId: number;
  /** Chat ID where the message was sent */
  chatId: number;
  /** User ID who sent the message (optional) */
  userId?: number;
  /** Date when the message was sent */
  messageDate: Date;
  /** Caption text for media (optional) */
  caption?: string | null;
  /** Type of media (photo, video, document, etc.) */
  mediaType?: string | null;
  /** Telegram file ID for downloading */
  fileId?: string | null;
  /** Unique file identifier from Telegram */
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
  /** Processed caption data */
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
    // Call the database function to handle the upsert
    const { data, error } = await supabaseClient.rpc('upsert_media_message', {
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
      p_user_id: params.userId,
      p_media_group_id: params.mediaGroupId,
      p_forward_info: params.forwardInfo as Json | null,
      p_processing_error: params.processingError,
      p_caption_data: params.captionData as Json | null
    });

    if (error) {
      logWithCorrelation(correlationId, `Error upserting media message: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }

    // The function returns the message ID
    const messageId = data;
    
    logWithCorrelation(correlationId, `Successfully upserted media message with ID: ${messageId}`);
    
    // Log the event
    await logProcessingEvent(
      supabaseClient,
      'media_message_upserted',
      messageId,
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
      data: { id: messageId }
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
  
  logWithCorrelation(correlationId, `Triggering caption parsing for message ${messageId}`);
  
  try {
    const parserUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/manual-caption-parser`;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!parserUrl || !serviceKey) {
      const errorMsg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for caption parser call';
      logWithCorrelation(correlationId, `CRITICAL: ${errorMsg}`, 'ERROR');
      
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
      logWithCorrelation(correlationId, errorMsg, 'ERROR');
      
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
    
    logWithCorrelation(correlationId, `Successfully invoked caption parser for message ${messageId}`);
    
    await logProcessingEvent(
      supabaseClient,
      'caption_parser_invoked',
      messageId,
      correlationId,
      { isEdit: true }
    );
    
    return {
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception invoking caption parser: ${errorMessage}`, 'ERROR');
    
    await logProcessingEvent(
      supabaseClient,
      'caption_parser_invoke_exception',
      messageId,
      correlationId,
      { errorMessage, stack: error instanceof Error ? error.stack : undefined },
      `Fetch exception invoking caption parser: ${errorMessage}`
    );
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
