import { serve } from "https://deno.land/std@0.177.0/http/server.ts"; // Assuming this version is correct/intended
import {
  createHandler,
  // createSuccessResponse, // Not using standard success wrapper for proxy
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { corsHeaders } from "../_shared/cors.ts"; // Import corsHeaders for direct response modification
// Optional: Import logProcessingEvent if specific logging needed
// import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

// Define expected request body structure
interface OpenAIRequestBody {
  model: string;
  messages: Array<Record<string, unknown>>; // Basic structure, consider more specific types
  temperature?: number;
  max_tokens?: number;
  // Add other potential OpenAI parameters if needed
}

// Core logic for proxying OpenAI requests
async function handleOpenAIRequest(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing openai-request`);

  // --- Environment Variable Check ---
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    console.error(`[${correlationId}] OPENAI_API_KEY environment variable is not set`);
    throw new Error('Configuration error: OpenAI API key is missing.');
  }

  // --- Request Body Parsing and Validation ---
  let requestBody: OpenAIRequestBody;
  try {
    requestBody = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { model, messages, temperature, max_tokens } = requestBody;

  if (!model || !messages || !Array.isArray(messages) || messages.length === 0) {
     console.error(`[${correlationId}] Invalid request parameters. Required: model and non-empty messages array.`);
     throw new Error('Invalid request parameters. Required: model and non-empty messages array.');
  }

  // Log sanitized request info
  console.log(`[${correlationId}] Proxying request to OpenAI. Model: ${model}, Messages: ${messages.length}`);
  // Optional: Log more details if needed using logProcessingEvent

  // --- OpenAI API Call ---
  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId, // Pass correlation ID downstream
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7, // Use nullish coalescing for default
        max_tokens: max_tokens ?? 1000, // Use nullish coalescing for default
        // Add other parameters as needed
      })
    });

    // Check if OpenAI call was successful
    if (!openaiResponse.ok) {
      let errorBody: any = null;
      try {
        errorBody = await openaiResponse.json();
      } catch (_) {
        // Ignore if error response is not JSON
      }
      const errorMsg = errorBody?.error?.message || openaiResponse.statusText || `HTTP ${openaiResponse.status}`;
      console.error(`[${correlationId}] OpenAI API error (${openaiResponse.status}): ${errorMsg}`, errorBody);
      // Throw an error that includes the status code if possible
      throw new Error(`OpenAI API Error (${openaiResponse.status}): ${errorMsg}`);
    }

    // Stream the response body directly back to the client
    // Important: We need to clone the headers and add CORS
    const responseHeaders = new Headers(openaiResponse.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
    });
    // Add correlation ID back to the response if desired
    responseHeaders.set('X-Correlation-ID', correlationId);

    console.log(`[${correlationId}] Successfully received response from OpenAI.`);

    // Return OpenAI's response directly, including status code and headers
    return new Response(openaiResponse.body, {
        status: openaiResponse.status,
        headers: responseHeaders
    });

  } catch (fetchError: unknown) {
     // Catch fetch errors or errors thrown from response handling
     const errorMessage = fetchError instanceof Error ? fetchError.message : "OpenAI API request failed";
     // Avoid logging the same error twice if it was already logged above
     if (!errorMessage.startsWith('OpenAI API Error')) {
        console.error(`[${correlationId}] Exception during OpenAI API call: ${errorMessage}`);
     }
     // Re-throw the error to be handled by unifiedHandler
     throw fetchError;
  }
}

// Create and configure the handler
const handler = createHandler(handleOpenAIRequest)
  .withMethods(['POST']) // OpenAI chat completions use POST
  .withSecurity(SecurityLevel.AUTHENTICATED) // Requires user authentication
  .build();

// Serve the handler
serve(handler);

console.log("openai-request function deployed and listening.");
