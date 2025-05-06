import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createCorsResponse, handleOptionsRequest } from "../_shared/cors.ts";
import {
  EventType,
  OperationStage,
  createResponse,
  generateCorrelationId,
  logError,
  logEvent,
  logOperationComplete,
  logOperationStart
} from "../_shared/logging.ts";
import { createSupabaseClient } from "../_shared/supabaseClient.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest();
  }

  // Generate a correlation ID for this deletion operation
  const correlationId = generateCorrelationId('telegram_delete');

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const { message_id, chat_id, media_group_id } = await req.json();
    console.log(`[${correlationId}] Deleting message:`, { message_id, chat_id, media_group_id });

    if (!message_id || !chat_id) {
      const error = new Error("Missing required fields: message_id and chat_id are required");
      await logError(
        EventType.MESSAGE_DELETED,
        'validation_error',
        error.message,
        correlationId,
        { telegram_message_id: message_id, chat_id }
      );
      return createCorsResponse({
        success: false,
        message: error.message,
        correlation_id: correlationId
      }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Find the message in the database to get its ID
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('id')
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .single();

    if (messageError) {
      await logError(
        EventType.MESSAGE_DELETED,
        'unknown',
        messageError.message,
        correlationId,
        {
          telegram_message_id: message_id,
          chat_id: chat_id,
          media_group_id,
          stage: 'find_message'
        }
      );
      return createCorsResponse({
        success: false,
        message: `Error finding message: ${messageError.message}`,
        correlation_id: correlationId
      }, { status: 404 });
    }

    const messageId = messageData.id;

    // Log the start of the deletion process
    await logOperationStart(
      EventType.MESSAGE_DELETED,
      messageId,
      'deletion',
      {
        telegram_message_id: message_id,
        chat_id: chat_id,
        media_group_id
      },
      correlationId
    );

    // Delete message from Telegram
    const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        message_id: message_id,
      }),
    });

    const result = await response.json();
    console.log(`[${correlationId}] Telegram deletion result:`, result);

    if (!result.ok) {
      let status = 500;
      // Handle common Telegram API errors
      if (result.description?.includes('message to delete not found')) {
        status = 404;
      } else if (result.description?.includes('message can\'t be deleted')) {
        status = 403;
      }

      const errorMsg = `Failed to delete Telegram message: ${result.description}`;
      await logError(
        EventType.MESSAGE_DELETED,
        messageId,
        errorMsg,
        correlationId,
        {
          telegram_message_id: message_id,
          chat_id: chat_id,
          media_group_id,
          telegram_result: result,
          stage: 'telegram_api_call'
        }
      );

      return createCorsResponse({
        success: false,
        message: errorMsg,
        telegram_result: result,
        correlation_id: correlationId
      }, { status });
    }

    // Mark the message as deleted from Telegram
    await supabase
      .from('messages')
      .update({
        deleted_from_telegram: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Log successful deletion from Telegram
    await logEvent(
      EventType.MESSAGE_DELETED,
      messageId,
      {
        telegram_message_id: message_id,
        chat_id: chat_id,
        media_group_id,
        telegram_result: result,
        operation: 'deletion_successful'
      },
      correlationId
    );

    // If it's part of a media group, delete all related messages
    if (media_group_id) {
      // Log the start of media group deletion
      await logOperationStart(
        EventType.MEDIA_GROUP_DELETED,
        messageId,
        'media_group_deletion',
        {
          telegram_message_id: message_id,
          chat_id: chat_id,
          media_group_id
        },
        correlationId
      );

      const { data: relatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id, telegram_message_id, chat_id')
        .eq('media_group_id', media_group_id)
        .neq('telegram_message_id', message_id); // Skip the one we just deleted

      if (fetchError) {
        await logError(
          EventType.MEDIA_GROUP_DELETED,
          messageId,
          fetchError.message,
          correlationId,
          {
            telegram_message_id: message_id,
            chat_id: chat_id,
            media_group_id,
            stage: 'fetch_related_messages'
          }
        );
        // Continue with the response since the primary message was deleted
      } else {
        // Delete all related messages from Telegram
        const groupResults = [];
        const successCount = {
          success: 0,
          failed: 0,
          total: relatedMessages?.length || 0
        };

        for (const msg of relatedMessages || []) {
          try {
            const groupResponse = await fetch(deleteUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: msg.chat_id,
                message_id: msg.telegram_message_id,
              }),
            });

            const groupResult = await groupResponse.json();
            groupResults.push({
              id: msg.id,
              telegram_message_id: msg.telegram_message_id,
              result: groupResult
            });

            // Mark the message as deleted from Telegram
            if (groupResult.ok) {
              await supabase
                .from('messages')
                .update({
                  deleted_from_telegram: true,
                  updated_at: new Date().toISOString()
                })
                .eq('id', msg.id);

              // Log successful group message deletion
              await logEvent(
                EventType.MESSAGE_DELETED,
                msg.id,
                {
                  telegram_message_id: msg.telegram_message_id,
                  chat_id: msg.chat_id,
                  media_group_id,
                  parent_message_id: messageId,
                  operation: 'group_message_deleted'
                },
                correlationId
              );

              successCount.success++;
            } else {
              successCount.failed++;
              await logError(
                EventType.MESSAGE_DELETED,
                msg.id,
                `Telegram API error: ${groupResult.description || 'Unknown error'}`,
                correlationId,
                {
                  telegram_message_id: msg.telegram_message_id,
                  chat_id: msg.chat_id,
                  media_group_id,
                  parent_message_id: messageId,
                  telegram_result: groupResult,
                  operation: 'group_message_deletion_failed'
                }
              );
            }
          } catch (groupError) {
            console.error(`[${correlationId}] Error deleting group message ${msg.telegram_message_id}:`, groupError);

            // Continue with other messages even if one fails
            groupResults.push({
              id: msg.id,
              telegram_message_id: msg.telegram_message_id,
              error: groupError.message
            });

            // Log failed group message deletion
            await logError(
              EventType.MESSAGE_DELETED,
              msg.id,
              groupError.message,
              correlationId,
              {
                telegram_message_id: msg.telegram_message_id,
                chat_id: msg.chat_id,
                media_group_id,
                parent_message_id: messageId,
                operation: 'group_message_deletion_failed'
              }
            );

            successCount.failed++;
          }
        }

        // Log completion of media group deletion with success stats
        const operationStage =
          successCount.success === successCount.total ? OperationStage.COMPLETED :
            successCount.success > 0 ? OperationStage.PARTIAL_SUCCESS :
              OperationStage.FAILED;

        await logEvent(
          EventType.MEDIA_GROUP_DELETED,
          messageId,
          {
            operation: `media_group_deletion_${operationStage}`,
            media_group_id,
            success_count: successCount.success,
            failed_count: successCount.failed,
            total_count: successCount.total,
            group_results: groupResults
          },
          correlationId
        );
      }
    }

    // Log overall operation completion
    await logOperationComplete(
      EventType.MESSAGE_DELETED,
      messageId,
      'deletion',
      {
        telegram_message_id: message_id,
        chat_id: chat_id,
        media_group_id
      },
      correlationId
    );

    return createCorsResponse(createResponse(
      true,
      'Message successfully deleted from Telegram',
      correlationId,
      {
        message_id: messageId,
        telegram_message_id: message_id,
        media_group_deleted: !!media_group_id
      }
    ));
  } catch (error) {
    console.error(`[${correlationId}] Unhandled error:`, error);

    await logError(
      EventType.MESSAGE_DELETED,
      'unknown',
      error.message,
      correlationId,
      { operation: 'unhandled_error' }
    );

    return createCorsResponse({
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
      correlation_id: correlationId
    }, { status: 500 });
  }
});
