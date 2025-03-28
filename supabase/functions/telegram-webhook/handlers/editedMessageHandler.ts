
/**
 * Handler for edited non-media messages
 */
import { TelegramMessage, MessageContext } from '../types.ts';
import { buildTelegramMessageUrl } from '../utils/urlBuilder.ts';
import { isMessageForwarded } from '../utils/messageUtils.ts';
import { checkExistingMessage, handleEditedMessage } from '../services/databaseService.ts';
import { RetryHandler, shouldRetryOperation } from '../../_shared/retryUtils.ts';
import { createSuccessResponse, createTelegramErrorResponse } from '../services/responseService.ts';
import { logEvent, logErrorEvent } from '../services/loggingService.ts';
import { supabaseClient } from '../../_shared/supabase.ts';

/**
 * Handler for edited messages (text only - media edits are handled by mediaMessageHandler)
 */
export async function handleEditedMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, logger } = context;

    // Check if it contains media - if so, delegate to media handler
    if (message.photo || message.video || message.document) {
      logger?.info(`Edited message ${message.message_id} contains media, delegating to media handler.`);
      return createSuccessResponse({
        success: true,
        message: `Edit for media message ${message.message_id} delegated to media handler.`,
        correlationId,
        action: 'delegated'
      });
    }

    logger?.info(`Processing edited text message ${message.message_id}`);

    // Find existing message with retry
    const retry = new RetryHandler({ maxAttempts: 3 });
    const { exists, id: existingMessageId } = await retry.execute(
      () => checkExistingMessage(message.message_id, message.chat.id),
      shouldRetryOperation
    );

    // Get message URL for reference
    const message_url = buildTelegramMessageUrl(message.chat.id, message.message_id);
    const isChannelPost = message.sender_chat?.type === 'channel';

    if (exists && existingMessageId) {
      logger?.info(`Found existing message ${existingMessageId} for edit`);

      // Call the edit handler with retry
      const editResult = await retry.execute(
        () => handleEditedMessage(
        existingMessageId,
        message.message_id,
        message.chat.id,
        message.text,
        null, // No caption for text messages
        message,
        isChannelPost,
        isChannelPost ? 'channel' : 'user'
      ),
      shouldRetryOperation);

      if (!editResult.success) {
        throw new Error(`Failed to update message: ${editResult.error}`);
      }

      logger?.success(`Successfully updated message ${existingMessageId} via RPC`, { editResult });

      // Log the edit operation
      try {
        await logEvent(
          "message_text_edited",
          existingMessageId,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            edit_history_id: editResult.edit_history_id
          }
        );
      } catch (logError) {
        logger?.error(`Error logging edit operation: ${logError instanceof Error ? logError.message : String(logError)}`);
      }

      return createSuccessResponse({
        success: true,
        messageId: existingMessageId,
        correlationId,
        action: 'updated',
        edit_history_id: editResult.edit_history_id,
        edit_count: editResult.edit_count
      });
    } else {
      // If message not found, create a new record
      logger?.info(`🆕 Original message not found, creating new record for edited message ${message.message_id}`);

      const isForward = isMessageForwarded(message);

      // Insert new message with retry
      const { data, error: insertError } = await retry.execute(
        () => supabaseClient
        .from('messages')
        .insert({
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          text: message.text,
          is_edited: true,
          edit_count: 1,
          last_edit_at: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          last_edit_user_id: message.from?.id,
          is_channel_post: isChannelPost,
          edit_source: isChannelPost ? 'channel' : 'user',
          is_forward: isForward,
          correlation_id: correlationId,
          telegram_data: message,
          message_url: message_url,
          processing_state: 'pending'
        })
        .select('id')
        .single(),
      shouldRetryOperation);

      if (insertError) {
        logger?.error(`Error creating new record for edited message: ${insertError.message}`);

        // Check for unique violation (race condition)
        if (insertError.code === '23505') {
          logger?.warn(`Race condition detected: Message ${message.message_id} likely inserted by another process. Skipping creation.`);

          // Attempt to find the message again
          const { data: raceMessage, error: raceError } = await supabaseClient
            .from('messages')
            .select('id')
            .eq('telegram_message_id', message.message_id)
            .eq('chat_id', message.chat.id)
            .single();

          if (raceError || !raceMessage) {
            logger?.error(`Failed to find message after race condition: ${raceError?.message || 'Not found'}`);
            throw insertError;
          }

          return createSuccessResponse({
            success: true,
            messageId: raceMessage.id,
            correlationId,
            action: 'skipped_creation_race_condition'
          });
        }
        throw insertError;
      }

      logger?.success(`Created new message record ${data.id} for edited message ${message.message_id}`);

      // Log the operation
      try {
        await logEvent(
          "message_created_from_edit",
          data.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id
          }
        );
      } catch (logError) {
        logger?.error(`Error logging message creation: ${logError instanceof Error ? logError.message : String(logError)}`);
      }

      return createSuccessResponse({
        success: true,
        messageId: data.id,
        correlationId,
        action: 'created'
      });
    }
  } catch (error) {
    context.logger?.error(`Error processing edited message: ${error instanceof Error ? error.message : String(error)}`, {
      stack: error instanceof Error ? error.stack : undefined
    });

    // Ensure message object exists for logging context
    const logMessageId = message?.message_id || 'unknown';
    const logChatId = message?.chat?.id || 'unknown';

    await logErrorEvent(
      "edited_message_processing_error",
      `${logChatId}_${logMessageId}`,
      context.correlationId,
      error,
      {
        message_id: logMessageId,
        chat_id: logChatId
      }
    );

    // Return Telegram compatible error response (status 200)
    return createTelegramErrorResponse(error, context.correlationId);
  }
}
