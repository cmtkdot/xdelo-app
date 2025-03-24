import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createStandardHandler, SecurityLevel } from "../_shared/standardHandler.ts";

// Main handler for setting the Telegram webhook
const setWebhookHandler = createStandardHandler(async (req: Request, correlationId: string) => {
  const TELEGRAM_WEBHOOK_URL = `${Deno.env.get('SUPABASE_URL') || ''}/functions/v1/telegram-webhook`;
  
  // Log the start of the operation
  console.log(`[${correlationId}] Setting Telegram webhook: ${TELEGRAM_WEBHOOK_URL}`);
  
  try {
    // Parse the request body for the bot token
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Bot token is required",
          correlationId
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Configure the parameters for the setWebhook method
    const webhookParams = {
      url: TELEGRAM_WEBHOOK_URL,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post"],
      drop_pending_updates: false,
      secret_token: correlationId // Use the correlation ID as a secret token for additional security
    };
    
    // Call the Telegram API to set the webhook
    const telegramApiUrl = `https://api.telegram.org/bot${token}/setWebhook`;
    const response = await fetch(telegramApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(webhookParams)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${correlationId}] Telegram API error: ${response.status} ${errorText}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Telegram API error: ${response.status}`,
          details: errorText,
          correlationId
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    // Parse the Telegram API response
    const telegramResponse = await response.json();
    
    // For verification purposes, also get the current webhook info
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const webhookInfo = await webhookInfoResponse.json();
    
    // Create a verification URL for frontend testing
    const verificationUrl = `https://api.telegram.org/bot${token.substring(0, 5)}...${token.substring(token.length - 5)}/getWebhookInfo`;
    
    // Return success response with detailed information
    return new Response(
      JSON.stringify({
        success: telegramResponse.ok === true,
        webhook_set: telegramResponse,
        webhook_info: webhookInfo.result,
        webhook_url: TELEGRAM_WEBHOOK_URL,
        verification_urls: {
          get_webhook_info: verificationUrl
        },
        correlationId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error setting webhook:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error",
        correlationId
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
}, { securityLevel: SecurityLevel.PUBLIC });

// Serve the handler
serve(setWebhookHandler); 