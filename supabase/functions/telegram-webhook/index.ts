
import { corsHeaders, handleOptionsRequest, isPreflightRequest } from '../_shared/cors.ts';
import { generateCorrelationId } from '../_shared/logger.ts';
import { handleMediaMessage, handleOtherMessage, handleEditedMessage } from './handlers/index.ts';
import { TelegramMessage, MessageContext } from './types.ts';
import { xdelo_getTelegramSettings } from '../_shared/telegramSettings.ts';
import { CONFIG } from '../_shared/config.ts';

// Create a RequestHandler for the Telegram webhook endpoint
Deno.serve(async (req) => {
  // Handle CORS
  if (isPreflightRequest(req)) {
    return handleOptionsRequest();
  }

  try {
    // Generate a correlation ID for tracking this request through different systems
    const correlationId = generateCorrelationId();
    console.log(`[${correlationId}] Received Telegram webhook request`);

    // Verify Telegram authentication if webhook secret is configured
    if (CONFIG.TELEGRAM.WEBHOOK_SECRET) {
      const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (secretToken !== CONFIG.TELEGRAM.WEBHOOK_SECRET) {
        console.error(`[${correlationId}] Authentication failed: Invalid secret token`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: CONFIG.ERROR_MESSAGES.AUTHORIZATION_FAILED, 
            correlationId 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
    }
    
    // Get Telegram settings from database
    const settings = await xdelo_getTelegramSettings();
    if (!settings.isValid) {
      console.error(`[${correlationId}] Telegram settings invalid:`, settings.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Telegram settings invalid: ${settings.errors.join(', ')}`, 
          correlationId 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 503 // Service Unavailable
        }
      );
    }

    // Parse request body
    const data = await req.json();
    
    // Log incoming webhook data for debugging
    console.log(`[${correlationId}] Webhook data:`, JSON.stringify(data).substring(0, 200) + '...');

    // Determine what type of message it is
    let message: TelegramMessage | null = null;
    let isEdit = false;
    let isChannelPost = false;

    if (data.message) {
      message = data.message;
    } else if (data.edited_message) {
      message = data.edited_message;
      isEdit = true;
    } else if (data.channel_post) {
      message = data.channel_post;
      isChannelPost = true;
    } else if (data.edited_channel_post) {
      message = data.edited_channel_post;
      isEdit = true;
      isChannelPost = true;
    }

    // If no supported message type found
    if (!message) {
      console.log(`[${correlationId}] Unsupported message type in webhook`);
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported message type', correlationId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build message context object
    const context: MessageContext = {
      correlationId,
      isEdit,
      isChannelPost,
      startTime: new Date(),
      botToken: settings.botToken
    };

    // Handle different types of messages
    if (isEdit) {
      // Handle edited messages
      return await handleEditedMessage(message, context);
    } else if (message.photo || message.video || message.document) {
      // Handle media messages
      return await handleMediaMessage(message, context);
    } else {
      // Handle text and other non-media messages
      return await handleOtherMessage(message, context);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
