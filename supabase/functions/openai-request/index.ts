
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse,
  xdelo_fetchWithRetry
} from '../_shared/standardizedHandler.ts';

// Define the handler function for OpenAI requests
const handleOpenAIRequest = async (req: Request, correlationId: string): Promise<Response> => {
  const { model, messages, temperature, max_tokens } = await req.json();
  
  // Basic validation
  if (!model || !messages || !Array.isArray(messages)) {
    return xdelo_createErrorResponse(
      'Invalid request parameters. Required: model and messages array.',
      correlationId,
      400
    );
  }

  // Get the OpenAI API key from environment variables
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return xdelo_createErrorResponse(
      'OPENAI_API_KEY environment variable is not set',
      correlationId,
      500
    );
  }

  // Log the request (sanitized)
  console.log(JSON.stringify({
    level: 'info',
    message: 'OpenAI request',
    model,
    messages_count: messages.length,
    correlation_id: correlationId,
    timestamp: new Date().toISOString()
  }));

  try {
    // Make the request to OpenAI with retry logic
    const response = await xdelo_fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 1000
        })
      },
      3,  // max retries
      1000 // base delay in ms
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    // Return the OpenAI response
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'OpenAI request error',
      error: error.message,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));
    
    return xdelo_createErrorResponse(error.message, correlationId, 400);
  }
};

// Use our standardized handler
serve(xdelo_createStandardizedHandler(handleOpenAIRequest));
