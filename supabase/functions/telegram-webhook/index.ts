import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isMessageForwarded } from '../_shared/consolidatedMessageUtils.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { supabaseClient } from '../_shared/supabaseClient.ts';
import { createRetryHandler } from '../_shared/retryHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { logProcessingEvent } from './utils/dbOperations.ts';
import { logWithCorrelation } from './utils/logger.ts';
// Helper to manually create CORS response
function createManualCorsResponse(body, options = {}) {
  const bodyString = typeof body === 'string' ? body : body ? JSON.stringify(body) : null;
  const headers = {
    ...corsHeaders,
    ...bodyString && {
      'Content-Type': 'application/json'
    },
    ...options.headers
  };
  return new Response(bodyString, {
    ...options,
    headers
  });
}
serve(async (req)=>{
  const correlationId = crypto.randomUUID();
  const functionName = 'telegram-webhook';
  const startTime = Date.now();
  if (req.method === 'OPTIONS') {
    logWithCorrelation(correlationId, 'Received OPTIONS request, returning CORS headers', 'debug', functionName);
    // Use manual helper for OPTIONS response
    return createManualCorsResponse(null);
  }
  // Initialize retry handler with configured parameters
  const retryHandler = createRetryHandler({
    maxRetries: 3,
    initialDelayMs: 30000,
    maxDelayMs: 300000,
    backoffFactor: 2.0,
    useJitter: true // Add jitter to prevent thundering herd
  });
  try {
    logWithCorrelation(correlationId, 'Webhook received', 'info', functionName, {
      method: req.method,
      url: req.url
    });
    let update;
    try {
      const bodyText = await req.text();
      if (!bodyText) {
        throw new Error('Request body is empty');
      }
      update = JSON.parse(bodyText);
      logWithCorrelation(correlationId, 'Received Telegram update', 'debug', functionName, {
        update_id: update.update_id
      });
    } catch (error) {
      const errorMsg = `Failed to parse request body: ${error.message}`;
      logWithCorrelation(correlationId, errorMsg, 'error', functionName, {
        bodyPreview: error instanceof SyntaxError ? req.body?.toString().substring(0, 100) : 'N/A'
      });
      await logProcessingEvent(supabaseClient, "webhook_parse_error", null, correlationId, {
        error: errorMsg
      }, errorMsg);
      // Use manual helper for error response
      return createManualCorsResponse({
        success: false,
        error: 'Invalid JSON in request body',
        correlationId
      }, {
        status: 400
      });
    }
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      logWithCorrelation(correlationId, 'No processable message found in update', 'warn', functionName, {
        update_keys: Object.keys(update)
      });
      await logProcessingEvent(supabaseClient, "webhook_no_message", null, correlationId, {
        update_keys: Object.keys(update)
      }, "No processable message found");
      // Use manual helper for error response
      return createManualCorsResponse({
        success: false,
        message: "No processable message found",
        correlationId
      }, {
        status: 200
      });
    }
    const isEdit = !!(update.edited_message || update.edited_channel_post);
    const context = {
      isChannelPost: !!(update.channel_post || update.edited_channel_post),
      isForwarded: isMessageForwarded(message),
      correlationId,
      isEdit: isEdit,
      startTime: new Date(startTime).toISOString()
    };
    logWithCorrelation(correlationId, `Processing message ${message.message_id}`, 'info', functionName, {
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      is_edit: context.isEdit,
      is_forwarded: context.isForwarded,
      message_type: message.text ? 'text' : message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'other',
      media_group_id: message.media_group_id
    });
    let response;
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!telegramToken) {
      logWithCorrelation(correlationId, "TELEGRAM_BOT_TOKEN environment variable not set.", 'error', functionName);
      await logProcessingEvent(supabaseClient, "config_error", null, correlationId, {
        variable: "TELEGRAM_BOT_TOKEN"
      }, "Bot token not configured");
      throw new Error("TELEGRAM_BOT_TOKEN environment variable not set.");
    }
    if (context.isEdit) {
      logWithCorrelation(correlationId, `Routing to handleEditedMessage with retry support`, 'info', functionName, {
        message_id: message.message_id
      });
      // Use retry handler for edited message processing
      const retryResult = await retryHandler.execute(async ()=>handleEditedMessage(message, context), {
        operationName: 'handleEditedMessage',
        correlationId,
        supabaseClient,
        errorCategory: 'webhook_error',
        contextData: {
          message_id: message.message_id,
          chat_id: message.chat?.id
        }
      });
      if (retryResult.success && retryResult.result) {
        // Check if the result is a messageNotFound response object rather than a Response
        const result = retryResult.result;
        if (result && typeof result === 'object' && 'messageNotFound' in result && result.messageNotFound === true) {
          // We need to handle this as a new message
          logWithCorrelation(correlationId, `Original message not found for edit, processing as new ${result.detailedType} message`, 'INFO', functionName, {
            message_id: message.message_id,
            message_type: result.detailedType,
            is_recovered_edit: true
          });
          
          await logProcessingEvent(supabaseClient, "recovered_edit_fallback", null, correlationId, {
            message_id: message.message_id,
            chat_id: message.chat?.id,
            message_type: result.detailedType,
            detailed_type: result.detailedType
          }, "Falling back to process edited message as new message");
          
          // Create a modified context to indicate this is a recovered edit
          const recoveredContext = {
            ...context,
            isRecoveredEdit: true
          };
          
          // Route to appropriate handler based on message type
          if (result.media) {
            // Handle as new media message
            logWithCorrelation(correlationId, `Routing recovered edit to handleMediaMessage`, 'INFO', functionName);
            const mediaResult = await retryHandler.execute(async ()=>handleMediaMessage(telegramToken, message, recoveredContext), {
              operationName: 'handleMediaMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(mediaResult.success ? mediaResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as media message: ${mediaResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          } else {
            // Handle as new text/other message
            logWithCorrelation(correlationId, `Routing recovered edit to handleOtherMessage`, 'INFO', functionName);
            const textResult = await retryHandler.execute(async ()=>handleOtherMessage(message, recoveredContext), {
              operationName: 'handleOtherMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(textResult.success ? textResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as text message: ${textResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          }
        } else {
          // Normal successful response
          response = Promise.resolve(result);
        }
      } else {
        // All retries failed, create error response
        response = Promise.resolve(createManualCorsResponse({
          success: false,
          error: `Failed to process edited message after ${retryResult.attempts} attempts: ${retryResult.error?.message}`,
          correlationId,
          retryInfo: {
            attempts: retryResult.attempts,
            maxRetriesReached: retryResult.maxRetriesReached,
            totalTimeMs: retryResult.totalTimeMs
          }
        }, {
          status: 500
        }));
      }
    } else if (message.photo || message.video || message.document) {
      logWithCorrelation(correlationId, `Routing to handleMediaMessage with retry support`, 'info', functionName, {
        message_id: message.message_id
      });
      // Use retry handler for media message processing
      const retryResult = await retryHandler.execute(async ()=>handleMediaMessage(telegramToken, message, context), {
        operationName: 'handleMediaMessage',
        correlationId,
        supabaseClient,
        errorCategory: 'webhook_error',
        contextData: {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          media_type: message.photo ? 'photo' : message.video ? 'video' : 'document'
        }
      });
      if (retryResult.success && retryResult.result) {
        // Check if the result is a messageNotFound response object rather than a Response
        const result = retryResult.result;
        if (result && typeof result === 'object' && 'messageNotFound' in result && result.messageNotFound === true) {
          // We need to handle this as a new message
          logWithCorrelation(correlationId, `Original message not found for edit, processing as new ${result.detailedType} message`, 'INFO', functionName, {
            message_id: message.message_id,
            message_type: result.detailedType,
            is_recovered_edit: true
          });
          
          await logProcessingEvent(supabaseClient, "recovered_edit_fallback", null, correlationId, {
            message_id: message.message_id,
            chat_id: message.chat?.id,
            message_type: result.detailedType,
            detailed_type: result.detailedType
          }, "Falling back to process edited message as new message");
          
          // Create a modified context to indicate this is a recovered edit
          const recoveredContext = {
            ...context,
            isRecoveredEdit: true
          };
          
          // Route to appropriate handler based on message type
          if (result.media) {
            // Handle as new media message
            logWithCorrelation(correlationId, `Routing recovered edit to handleMediaMessage`, 'INFO', functionName);
            const mediaResult = await retryHandler.execute(async ()=>handleMediaMessage(telegramToken, message, recoveredContext), {
              operationName: 'handleMediaMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(mediaResult.success ? mediaResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as media message: ${mediaResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          } else {
            // Handle as new text/other message
            logWithCorrelation(correlationId, `Routing recovered edit to handleOtherMessage`, 'INFO', functionName);
            const textResult = await retryHandler.execute(async ()=>handleOtherMessage(message, recoveredContext), {
              operationName: 'handleOtherMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(textResult.success ? textResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as text message: ${textResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          }
        } else {
          // Normal successful response
          response = Promise.resolve(result);
        }
      } else {
        // All retries failed, create error response
        response = Promise.resolve(createManualCorsResponse({
          success: false,
          error: `Failed to process media message after ${retryResult.attempts} attempts: ${retryResult.error?.message}`,
          correlationId,
          retryInfo: {
            attempts: retryResult.attempts,
            maxRetriesReached: retryResult.maxRetriesReached,
            totalTimeMs: retryResult.totalTimeMs
          }
        }, {
          status: 500
        }));
      }
    } else if (message.text) {
      logWithCorrelation(correlationId, `Routing to handleOtherMessage with retry support`, 'info', functionName, {
        message_id: message.message_id
      });
      // Use retry handler for text message processing
      const retryResult = await retryHandler.execute(async ()=>handleOtherMessage(message, context), {
        operationName: 'handleOtherMessage',
        correlationId,
        supabaseClient,
        errorCategory: 'webhook_error',
        contextData: {
          message_id: message.message_id,
          chat_id: message.chat?.id
        }
      });
      if (retryResult.success && retryResult.result) {
        // Check if the result is a messageNotFound response object rather than a Response
        const result = retryResult.result;
        if (result && typeof result === 'object' && 'messageNotFound' in result && result.messageNotFound === true) {
          // We need to handle this as a new message
          logWithCorrelation(correlationId, `Original message not found for edit, processing as new ${result.detailedType} message`, 'INFO', functionName, {
            message_id: message.message_id,
            message_type: result.detailedType,
            is_recovered_edit: true
          });
          
          await logProcessingEvent(supabaseClient, "recovered_edit_fallback", null, correlationId, {
            message_id: message.message_id,
            chat_id: message.chat?.id,
            message_type: result.detailedType,
            detailed_type: result.detailedType
          }, "Falling back to process edited message as new message");
          
          // Create a modified context to indicate this is a recovered edit
          const recoveredContext = {
            ...context,
            isRecoveredEdit: true
          };
          
          // Route to appropriate handler based on message type
          if (result.media) {
            // Handle as new media message
            logWithCorrelation(correlationId, `Routing recovered edit to handleMediaMessage`, 'INFO', functionName);
            const mediaResult = await retryHandler.execute(async ()=>handleMediaMessage(telegramToken, message, recoveredContext), {
              operationName: 'handleMediaMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(mediaResult.success ? mediaResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as media message: ${mediaResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          } else {
            // Handle as new text/other message
            logWithCorrelation(correlationId, `Routing recovered edit to handleOtherMessage`, 'INFO', functionName);
            const textResult = await retryHandler.execute(async ()=>handleOtherMessage(message, recoveredContext), {
              operationName: 'handleOtherMessage_recoveredEdit',
              correlationId,
              supabaseClient,
              errorCategory: 'webhook_error',
              contextData: {
                message_id: message.message_id,
                chat_id: message.chat?.id,
                is_recovered_edit: true
              }
            });
            
            response = Promise.resolve(textResult.success ? textResult.result : createManualCorsResponse({
              success: false,
              error: `Failed to process recovered edit as text message: ${textResult.error?.message}`,
              correlationId
            }, { status: 500 }));
          }
        } else {
          // Normal successful response
          response = Promise.resolve(result);
        }
      } else {
        // All retries failed, create error response
        response = Promise.resolve(createManualCorsResponse({
          success: false,
          error: `Failed to process text message after ${retryResult.attempts} attempts: ${retryResult.error?.message}`,
          correlationId,
          retryInfo: {
            attempts: retryResult.attempts,
            maxRetriesReached: retryResult.maxRetriesReached,
            totalTimeMs: retryResult.totalTimeMs
          }
        }, {
          status: 500
        }));
      }
    } else {
      logWithCorrelation(correlationId, `Unsupported new message type received`, 'warn', functionName, {
        message_id: message.message_id,
        message_keys: Object.keys(message)
      });
      await logProcessingEvent(supabaseClient, "webhook_unsupported_new_type", null, correlationId, {
        message_id: message.message_id
      }, "Unsupported new message type");
      // Use manual helper for skipped response
      response = Promise.resolve(createManualCorsResponse({
        success: true,
        operation: 'skipped',
        reason: 'Unsupported message type',
        correlationId
      }, {
        status: 200
      }));
    }
    const resultResponse = await response;
    const duration = Date.now() - startTime;
    logWithCorrelation(correlationId, `Finished processing message ${message.message_id}`, 'info', functionName, {
      status: resultResponse.status,
      durationMs: duration,
      retry_enabled: true
    });
    // Add retry diagnostic information to the response
    const responseObj = resultResponse instanceof Response ? resultResponse : new Response(JSON.stringify({
      ...typeof resultResponse === 'object' ? resultResponse : {
        data: resultResponse
      },
      processingTime: duration,
      correlationId
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Processing-Time': duration.toString(),
        'X-Correlation-ID': correlationId,
        'X-Retry-Enabled': 'true'
      }
    });
    return responseObj;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, 'Unhandled error in webhook entry point', 'error', functionName, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    await logProcessingEvent(supabaseClient, "webhook_critical_failure", null, correlationId, {
      error: errorMessage
    }, errorMessage);
    // Use manual helper for 500 error response
    return createManualCorsResponse({
      success: false,
      error: 'Internal Server Error',
      correlationId
    }, {
      status: 500
    });
  }
});
