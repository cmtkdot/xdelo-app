import { serve } from "std/http/server.ts"; // Use mapped import
import { createHandler, SecurityLevel, RequestMetadata, createSuccessResponse } from '../_shared/unifiedHandler.ts';
import { OpenAI } from "https://esm.sh/openai@4.20.1";

const analyzeHandler = async (req: Request, metadata: RequestMetadata) => {
  const { messageId, caption } = await req.json();

  if (!messageId || !caption) {
    // Throw error for unified handler to catch
    throw new Error('Missing required parameters: messageId and caption');
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.error(`[${metadata.correlationId}] Missing OpenAI API key`);
    // Throw error for unified handler
    throw new Error('Configuration error: Missing API key');
  }

  const openai = new OpenAI({
    apiKey,
    timeout: 15000, // 15 second timeout
  });

  console.log(`[${metadata.correlationId}] Processing AI analysis for message ${messageId}`);

  // Define a retry mechanism
  const maxRetries = 2;
  let retries = 0;
  let response;
  let lastError;

  while (retries <= maxRetries) {
    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a product information extraction assistant... (system prompt omitted for brevity)` // Keep the original prompt
          },
          {
            role: "user",
            content: `Extract product details from this caption: "${caption}"`
          }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      // If successful, break the loop
      break;
    } catch (err) {
      lastError = err;
      console.error(`[${metadata.correlationId}] AI analysis attempt ${retries + 1} failed:`, err);

      // Exponential backoff
      if (retries < maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        console.log(`[${metadata.correlationId}] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      retries++;
    }
  }

  if (!response) {
    // Throw the last encountered error if all retries failed
    throw lastError || new Error('Failed to get response from AI after retries');
  }

  const result = response.choices[0].message.content;
  console.log(`[${metadata.correlationId}] AI analysis completed successfully`);

  try {
    // Verify we have valid JSON output
    const parsedResult = JSON.parse(result);
    // Use helper for success response
    return createSuccessResponse({ data: parsedResult }, metadata.correlationId);
  } catch (parseError) {
    console.error(`[${metadata.correlationId}] Invalid JSON returned from AI:`, parseError);
    // Throw a specific error for invalid format
    const formatError = new Error('AI returned invalid format');
    (formatError as any).partialResult = result; // Attach partial result if needed
    throw formatError;
  }
  // The main try/catch is handled by unifiedHandler now
};

// Create the handler instance using the builder
const handler = createHandler(analyzeHandler)
  .withMethods(['POST']) // Allow only POST
  .withSecurity(SecurityLevel.AUTHENTICATED) // Requires authentication
  .withLogging(true)
  .withMetrics(true);

// Serve the built handler
serve(handler.build());

// Note: The system prompt for OpenAI was shortened for brevity in this example.
// Ensure the full, original prompt is used in the actual implementation.
