/**
 * Unified Edge Function Handler
 * 
 * This file consolidates functionality from:
 * - baseHandler.ts
 * - standardHandler.ts
 * - errorHandler.ts
 * 
 * It provides a standardized way to create Supabase Edge Functions with
 * consistent error handling, logging, correlation IDs, and metrics.
 */

import { corsHeaders, handleOptionsRequest, createCorsResponse, isPreflightRequest } from './cors.ts';
import { createSupabaseClient } from './supabase.ts';
import { Logger, createLogger } from './logger/index.ts';

// Types and interfaces
export type EdgeFunctionHandler = (req: Request, context: HandlerContext) => Promise<Response>;

export interface HandlerContext {
  correlationId: string;
  logger: Logger;
  startTime: number;
  customData?: Record<string, any>;
}

export interface HandlerOptions {
  // Core options
  enableCors: boolean;
  enableMetrics: boolean;
  functionName: string;
  
  // Logging options
  enableLogging: boolean;
  logRequests: boolean;
  logResponses: boolean;
  logToDatabase: boolean;
  
  // Error handling options
  logErrorsToDatabase: boolean;
}

// Default handler options
const defaultOptions: HandlerOptions = {
  enableCors: true,
  enableMetrics: true,
  functionName: 'edge-function',
  enableLogging: true,
  logRequests: true,
  logResponses: true,
  logToDatabase: true,
  logErrorsToDatabase: true
};

// Interfaces for error handling
export interface ErrorDetail {
  messageId?: string;
  errorMessage: string;
  correlationId: string;
  functionName: string;
  metadata?: Record<string, any>;
  errorType?: string;
  errorStack?: string;
}

/**
 * Log an error to the database for auditing
 */
export async function logErrorToDatabase(error: ErrorDetail): Promise<string | null> {
  const supabaseClient = createSupabaseClient();
  
  try {
    const { data, error: dbError } = await supabaseClient
      .from("unified_audit_logs")
      .insert({
        event_type: "edge_function_error",
        entity_id: error.messageId || crypto.randomUUID(),
        metadata: {
          function_name: error.functionName,
          error_time: new Date().toISOString(),
          error_type: error.errorType,
          ...error.metadata
        },
        error_message: error.errorMessage,
        correlation_id: error.correlationId
      })
      .select('id')
      .single();
      
    if (dbError) {
      console.error("Failed to log error to database:", dbError);
      return null;
    }
    
    return data?.id || error.correlationId;
  } catch (e) {
    console.error("Exception logging error to database:", e);
    return null;
  }
}

/**
 * Create a standardized handler for Edge Functions with error handling
 */
export function createEdgeHandler(
  handlerFn: EdgeFunctionHandler,
  options: Partial<HandlerOptions> = {}
): (req: Request) => Promise<Response> {
  // Merge options with defaults
  const config = { ...defaultOptions, ...options };
  
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (config.enableCors && isPreflightRequest(req)) {
      return handleOptionsRequest();
    }
    
    try {
      // Generate a correlation ID for request tracking
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      const startTime = performance.now();
      
      // Create a logger for this request
      const logger = createLogger(config.functionName, correlationId);
      
      // Create the context to pass to the handler
      const context: HandlerContext = {
        correlationId,
        logger,
        startTime,
        customData: {}
      };
      
      // Log request if enabled
      if (config.enableLogging && config.logRequests) {
        logger.info(`Request received`, {
          method: req.method,
          url: req.url,
          headers: Object.fromEntries(req.headers.entries())
        });
      }
      
      // Call the handler function
      const response = await handlerFn(req, context);
      
      // Calculate duration
      const duration = performance.now() - startTime;
      
      if (!config.enableCors) {
        return response;
      }
      
      // Add performance metrics headers if enabled
      const enhancedHeaders: Record<string, string> = {};
      
      if (config.enableMetrics) {
        enhancedHeaders['X-Correlation-ID'] = correlationId;
        enhancedHeaders['X-Processing-Time'] = `${duration.toFixed(2)}ms`;
        enhancedHeaders['X-Function-Name'] = config.functionName;
      }
      
      // Clone the response with enhanced headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders,
          ...enhancedHeaders
        }
      });
      
      // Log response if enabled
      if (config.enableLogging && config.logResponses) {
        logger.info(`Request completed`, {
          status: response.status,
          duration_ms: Math.round(duration),
          content_type: response.headers.get('content-type')
        });
      }
      
      return enhancedResponse;
      
    } catch (error) {
      // Get error details
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error instanceof Error ? error.name : 'UnknownError';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Create a logger for this error
      const logger = createLogger(config.functionName, correlationId);
      
      // Log the error
      logger.error(`Error in edge function: ${errorMessage}`, error);
      
      // Log to database if enabled
      if (config.logErrorsToDatabase) {
        await logErrorToDatabase({
          functionName: config.functionName,
          errorMessage,
          correlationId,
          errorType,
          errorStack,
          metadata: {
            url: req.url,
            method: req.method
          }
        });
      }
      
      // Return standardized error response
      return createCorsResponse({
        success: false,
        error: errorMessage,
        error_type: errorType,
        correlation_id: correlationId,
        function_name: config.functionName,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  };
}

/**
 * Type-safe wrapper for HTTP methods
 */
export function createMethodHandler<T>(
  methods: { [K in 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH']?: (req: Request, context: HandlerContext, body?: T) => Promise<Response> },
  options: Partial<HandlerOptions> = {}
): (req: Request) => Promise<Response> {
  return createEdgeHandler(async (req: Request, context: HandlerContext) => {
    const method = req.method.toUpperCase();
    
    // Check if method is supported
    const handler = methods[method as keyof typeof methods];
    
    if (!handler) {
      return createCorsResponse({
        success: false,
        error: `Method ${method} not allowed`,
        correlation_id: context.correlationId
      }, { status: 405 });
    }
    
    try {
      // Parse body for methods that may have one
      let body: T | undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          body = await req.json() as T;
        }
      }
      
      // Call the handler with the body if needed
      return await handler(req, context, body);
    } catch (error) {
      context.logger.error(`Error in ${method} handler:`, error);
      
      return createCorsResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.name : 'UnknownError',
        correlation_id: context.correlationId
      }, { status: 500 });
    }
  }, options);
}

/**
 * Helper to create a standard success response
 */
export function createSuccessResponse(data: any, message?: string): Response {
  return createCorsResponse({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to create a standard error response
 */
export function createErrorResponse(
  error: Error | string, 
  status = 500, 
  correlationId?: string,
  additionalData: Record<string, any> = {}
): Response {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : error.name;
  
  return createCorsResponse({
    success: false,
    error: errorMessage,
    error_type: errorType,
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    ...additionalData
  }, { status });
}

/**
 * Update a message record with error information
 */
export async function updateMessageWithError(
  messageId: string, 
  errorMessage: string, 
  correlationId?: string,
  errorType?: string
): Promise<boolean> {
  if (!messageId) return false;
  
  const supabaseClient = createSupabaseClient();
  
  try {
    const { error: updateError } = await supabaseClient
      .from("messages")
      .update({
        processing_state: "error",
        error_message: errorMessage,
        error_type: errorType,
        last_error_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq("id", messageId);
      
    if (updateError) {
      console.error("Failed to update message with error:", updateError);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error("Exception updating message with error:", e);
    return false;
  }
} 