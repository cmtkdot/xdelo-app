/// <reference types="https://unpkg.com/@supabase/functions-js@2.1.1/src/edge-runtime.d.ts" />

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { logProcessingEvent } from './utils/dbOperations.ts';
import { Logger } from './utils/logger.ts';
import { isMessageForwarded } from '../_shared/consolidatedMessageUtils.ts';
import { TelegramMessage, MessageContext } from './types.ts';

// Helper to manually create CORS response
function createManualCorsResponse(body: object | string | null, options: ResponseInit = {}): Response {
    const bodyString = typeof body === 'string' ? body : body ? JSON.stringify(body) : null;
    const headers = { 
        ...corsHeaders, 
        ...(bodyString && { 'Content-Type': 'application/json' }),
        ...options.headers 
    };
    return new Response(bodyString, { ...options, headers });
}

serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const logger = new Logger(correlationId, 'telegram-webhook');
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    logger.debug('Received OPTIONS request, returning CORS headers');
    // Use manual helper for OPTIONS response
    return createManualCorsResponse(null);
  }

  try {
    logger.info('Webhook received', { method: req.method, url: req.url });
    
    let update;
    try {
      const bodyText = await req.text();
      if (!bodyText) {
          throw new Error('Request body is empty');
      }
      update = JSON.parse(bodyText);
      logger.debug('Received Telegram update', { update_id: update.update_id });
    } catch (error) {
      const errorMsg = `Failed to parse request body: ${error.message}`;
      logger.error(errorMsg, { bodyPreview: error instanceof SyntaxError ? req.body?.toString().substring(0,100) : 'N/A' });
      await logProcessingEvent("webhook_parse_error", null, correlationId, { error: errorMsg }, errorMsg);
      // Use manual helper for error response
      return createManualCorsResponse({ success: false, error: 'Invalid JSON in request body', correlationId }, { status: 400 });
    }

    const message: TelegramMessage | undefined = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    
    if (!message) {
      logger.warn('No processable message found in update', { update_keys: Object.keys(update) });
      await logProcessingEvent("webhook_no_message", null, correlationId, { update_keys: Object.keys(update) }, "No processable message found");
      // Use manual helper for error response
      return createManualCorsResponse({ success: false, message: "No processable message found", correlationId }, { status: 200 });
    }

    const isEdit = !!(update.edited_message || update.edited_channel_post);
    const context: MessageContext = {
      isChannelPost: !!(update.channel_post || update.edited_channel_post),
      isForwarded: isMessageForwarded(message),
      correlationId,
      isEdit: isEdit,
      logger,
      startTime: new Date(startTime).toISOString()
    };

    logger.info(`Processing message ${message.message_id}`, {
      chat_id: message.chat?.id, chat_type: message.chat?.type,
      is_edit: context.isEdit,
      is_forwarded: context.isForwarded,
      message_type: message.text ? 'text' : (message.photo ? 'photo' : (message.video ? 'video' : (message.document ? 'document' : 'other'))),
      media_group_id: message.media_group_id
    });

    let response: Promise<Response>;
    const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!telegramToken) {
        logger.error("TELEGRAM_BOT_TOKEN environment variable not set.");
        await logProcessingEvent("config_error", null, correlationId, { variable: "TELEGRAM_BOT_TOKEN" }, "Bot token not configured");
        throw new Error("TELEGRAM_BOT_TOKEN environment variable not set.");
    }

    if (context.isEdit) {
      logger.info(`Routing to handleEditedMessage`, { message_id: message.message_id });
      response = handleEditedMessage(message, context);
    }
    else if (message.photo || message.video || message.document) {
      logger.info(`Routing to handleMediaMessage`, { message_id: message.message_id });
      response = handleMediaMessage(telegramToken, message, context);
    }
    else if (message.text) {
      logger.info(`Routing to handleOtherMessage`, { message_id: message.message_id });
      response = handleOtherMessage(message, context);
    }
    else {
      logger.warn(`Unsupported new message type received`, { message_id: message.message_id, message_keys: Object.keys(message) });
      await logProcessingEvent("webhook_unsupported_new_type", null, correlationId, { message_id: message.message_id }, "Unsupported new message type");
      // Use manual helper for skipped response
      response = Promise.resolve(createManualCorsResponse({ success: true, operation: 'skipped', reason: 'Unsupported message type', correlationId }, { status: 200 }));
    }

    const resultResponse = await response;
    const duration = Date.now() - startTime;
    logger.info(`Finished processing message ${message.message_id}`, { 
        status: resultResponse.status, 
        durationMs: duration 
    });
    return resultResponse;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Unhandled error in webhook entry point', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    
    await logProcessingEvent("webhook_critical_failure", null, correlationId, { error: errorMessage }, errorMessage);
    
    // Use manual helper for 500 error response
    return createManualCorsResponse({ success: false, error: 'Internal Server Error', correlationId }, { status: 500 });
  }
});
