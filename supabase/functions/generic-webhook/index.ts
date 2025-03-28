
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse 
} from "../_shared/standardizedHandler.ts";

// Create a Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Create a standardized handler function
const handleWebhook = async (req: Request, correlationId: string): Promise<Response> => {
  // Parse the webhook payload
  const payload = await req.json();
  const timestamp = new Date().toISOString();
  
  // Log the webhook request
  console.log(JSON.stringify({
    level: 'info',
    timestamp,
    correlation_id: correlationId,
    message: 'Generic webhook received',
    payload_size: JSON.stringify(payload).length
  }));

  // Store the webhook payload in the database
  const { data, error } = await supabase
    .from('webhook_logs')
    .insert({
      webhook_type: 'generic',
      payload: payload,
      correlation_id: correlationId,
      created_at: timestamp
    });

  if (error) {
    throw error;
  }

  // Return success response
  return xdelo_createSuccessResponse(
    { received: true }, 
    correlationId,
    'Webhook processed successfully'
  );
};

// Use our standardized handler
serve(xdelo_createStandardizedHandler(handleWebhook, {
  logRequests: true,
  logResponses: true
}));
