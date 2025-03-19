
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleOptionsRequest, isPreflightRequest } from '../_shared/cors.ts';
import { xdelo_getTelegramSettings, xdelo_validateTelegramWebhook, xdelo_setTelegramWebhook } from '../_shared/telegramSettings.ts';
import { CONFIG } from '../_shared/config.ts';

// Function to create error response
function createErrorResponse(error: string, status = 500) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error,
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status 
    }
  );
}

// Function to create success response
function createSuccessResponse(data: any) {
  return new Response(
    JSON.stringify({ 
      success: true, 
      data,
      timestamp: new Date().toISOString()
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Handler function for webhook validation/setup
 */
async function handleRequest(req: Request): Promise<Response> {
  try {
    // Handle CORS preflight request
    if (isPreflightRequest(req)) {
      return handleOptionsRequest();
    }
    
    // Parse request
    const { action } = await req.json();
    
    switch (action) {
      case 'validate':
        // Validate current webhook configuration
        const validationResult = await xdelo_validateTelegramWebhook();
        return createSuccessResponse(validationResult);
        
      case 'setup':
        // Set up or update webhook configuration
        const setupResult = await xdelo_setTelegramWebhook();
        return createSuccessResponse(setupResult);
        
      case 'getSettings':
        // Get settings (masking sensitive values)
        const settings = await xdelo_getTelegramSettings();
        // Mask the bot token for security
        if (settings.botToken) {
          const length = settings.botToken.length;
          settings.botToken = `${settings.botToken.substring(0, 6)}...${settings.botToken.substring(length - 4)}`;
        }
        return createSuccessResponse(settings);
        
      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Error handling webhook validation request:', error);
    return createErrorResponse(`Internal server error: ${error.message}`);
  }
}

// Start the server
serve(handleRequest);
