import { corsHeaders, formatErrorResponse, formatSuccessResponse, logEvent } from './core.ts';
import { HandlerContext, HandlerResponse } from './types.ts';

/**
 * Base request handler with error handling and logging
 */
export async function handleRequest<T>(
  context: HandlerContext,
  handler: (context: HandlerContext) => Promise<T>
): Promise<Response> {
  const { correlationId } = context;
  
  try {
    // Handle CORS preflight
    if (context.request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Execute handler
    const result = await handler(context);
    
    return formatSuccessResponse(result as Record<string, unknown>, correlationId);
  } catch (error) {
    console.error(`[${correlationId}] Error in request handler:`, error);
    
    await logEvent(
      'request_handler_error',
      context.functionName,
      correlationId,
      { error: error.message },
      error.message
    );
    
    return formatErrorResponse(error.message, correlationId);
  }
}

/**
 * Standard request handler with validation
 */
export async function standardHandler<T>(
  request: Request,
  functionName: string,
  validator: (data: any) => Promise<boolean>,
  handler: (data: any, context: HandlerContext) => Promise<T>
): Promise<Response> {
  const correlationId = crypto.randomUUID();
  
  try {
    // Parse request body
    const requestData = await request.json();
    
    // Validate request
    const isValid = await validator(requestData);
    if (!isValid) {
      throw new Error('Invalid request data');
    }
    
    // Create context
    const context: HandlerContext = {
      correlationId,
      functionName,
      request,
      startTime: new Date().toISOString()
    };
    
    // Handle request
    return handleRequest(context, async () => {
      return await handler(requestData, context);
    });
  } catch (error) {
    console.error(`[${correlationId}] Error in standard handler:`, error);
    return formatErrorResponse(error.message, correlationId);
  }
}

/**
 * Validate request data against schema
 */
export async function validateRequest(data: any, schema: any): Promise<boolean> {
  try {
    await schema.parseAsync(data);
    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
} 