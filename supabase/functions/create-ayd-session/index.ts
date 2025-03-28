import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts"; // Keep for potential polyfills if needed by dependencies, though likely removable if AYD fetch works directly.
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts"; // Import if specific logging needed beyond unifiedHandler

// Core logic for creating an AYD session
async function handleCreateAydSession(req: Request, metadata: RequestMetadata): Promise<Response> {
  console.log(`[${metadata.correlationId}] Processing create-ayd-session request`);

  const AYD_API_KEY = Deno.env.get('AYD_API_KEY');
  if (!AYD_API_KEY) {
    console.error(`[${metadata.correlationId}] AYD_API_KEY is not set`);
    throw new Error('Configuration error: AYD_API_KEY is not set');
  }

  const CHATBOT_ID = Deno.env.get('AYD_CHATBOT_ID');
  if (!CHATBOT_ID) {
    console.error(`[${metadata.correlationId}] AYD_CHATBOT_ID is not set`);
    throw new Error('Configuration error: AYD_CHATBOT_ID is not set');
  }

  // Create session with AYD API
  const response = await fetch('https://www.askyourdatabase.com/api/chatbot/v2/session', {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AYD_API_KEY}`,
      'X-Correlation-ID': metadata.correlationId, // Pass correlation ID downstream
    },
    body: JSON.stringify({
      chatbotid: CHATBOT_ID,
      name: 'Guest', // Consider making this dynamic if possible/needed
      email: 'guest@example.com' // Consider making this dynamic if possible/needed
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[${metadata.correlationId}] AYD API Error:`, {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    // Throw an error, unifiedHandler will catch and format it
    throw new Error(`Failed to create AYD session: ${response.statusText}. ${errorText}`);
  }

  const data = await response.json();
  console.log(`[${metadata.correlationId}] AYD Session created successfully:`, data);

  // Use createSuccessResponse for standardized success output
  return createSuccessResponse(data, metadata.correlationId);
}

// Create and configure the handler
const handler = createHandler(handleCreateAydSession)
  .withMethods(['POST']) // Only allow POST requests
  .withSecurity(SecurityLevel.PUBLIC) // Accessible publicly, relies on API key internally
  .build();

// Serve the handler
serve(handler);

console.log("create-ayd-session function deployed and listening.");
