import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createStandardHandler, SecurityLevel } from "../_shared/standardHandler.ts";

// Main handler for getting Telegram webhook info
const getWebhookInfoHandler = createStandardHandler(async (req: Request, correlationId: string) => {
  // Log the start of the operation
  console.log(`[${correlationId}] Fetching Telegram webhook info`);
  
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
    
    // Call the Telegram API to get webhook info
    const telegramApiUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    const response = await fetch(telegramApiUrl);
    
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
    
    // Create verification URLs with masked tokens for frontend use
    const maskedToken = token.length > 10 
      ? `${token.substring(0, 5)}...${token.substring(token.length - 5)}`
      : "***";
      
    const verificationUrls = {
      get_webhook_info: `https://api.telegram.org/bot${maskedToken}/getWebhookInfo`,
      set_webhook: `https://api.telegram.org/bot${maskedToken}/setWebhook`
    };
    
    // Return success response with detailed information
    return new Response(
      JSON.stringify({
        success: telegramResponse.ok === true,
        webhook_info: telegramResponse.result,
        verification_urls: verificationUrls,
        correlationId
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error getting webhook info:`, error);
    
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
serve(getWebhookInfoHandler); 