
import { corsHeaders, handleOptionsRequest, createCorsResponse, isPreflightRequest } from './cors.ts';

// Security level enum for edge functions
export enum SecurityLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  SERVICE_ROLE = 'service_role',
}

type EdgeFunctionHandler = (req: Request, correlationId: string) => Promise<Response>;

interface HandlerOptions {
  enableCors?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  securityLevel?: SecurityLevel;
  fallbackToPublic?: boolean;
}

const defaultOptions: HandlerOptions = {
  enableCors: true,
  enableMetrics: true,
  enableLogging: true,
  securityLevel: SecurityLevel.PUBLIC,
  fallbackToPublic: true,
};

/**
 * Creates a standardized handler function for edge functions
 */
export function createHandler(
  handlerFn: EdgeFunctionHandler,
  options: Partial<HandlerOptions> = {}
): (req: Request) => Promise<Response> {
  // Merge options with defaults
  const config = { ...defaultOptions, ...options };
  
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (config.enableCors && isPreflightRequest(req)) {
      return handleOptionsRequest();
    }

    try {
      // Generate a correlation ID for request tracking
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      const startTime = Date.now();
      
      // Add correlation ID to headers for logging
      const headers = new Headers(req.headers);
      headers.set('X-Correlation-ID', correlationId);
      
      // Create a new request with the correlation ID
      const enhancedRequest = new Request(req.url, {
        method: req.method,
        headers,
        body: req.body,
        redirect: req.redirect
      });
      
      // Log the request if enabled
      if (config.enableLogging) {
        console.log(JSON.stringify({
          level: 'info',
          correlation_id: correlationId,
          message: `Request received: ${req.method} ${new URL(req.url).pathname}`,
          timestamp: new Date().toISOString(),
          headers: Object.fromEntries([...req.headers.entries()].filter(([key]) => 
            !['authorization', 'cookie'].includes(key.toLowerCase())
          ))
        }));
      }
      
      // Check authentication if required
      if (config.securityLevel !== SecurityLevel.PUBLIC) {
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return createCorsResponse({ 
            error: 'Missing authorization token',
            success: false 
          }, { status: 401 });
        }
        
        // For actual JWT validation, we would use Deno's JWT libraries
        // This implementation assumes JWT verification is disabled for now
      }
      
      // Call the handler function
      const response = await handlerFn(enhancedRequest, correlationId);
      
      // Calculate duration
      const duration = Date.now() - startTime;
      
      if (!config.enableCors) {
        return response;
      }
      
      // Add performance metrics headers if enabled
      const enhancedHeaders: Record<string, string> = {};
      
      if (config.enableMetrics) {
        enhancedHeaders['X-Correlation-ID'] = correlationId;
        enhancedHeaders['X-Processing-Time'] = `${duration}ms`;
        enhancedHeaders['X-Function-Version'] = '1.0';
      }
      
      // Clone the response with CORS headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders,
          ...enhancedHeaders
        }
      });
      
      // Log the response if enabled
      if (config.enableLogging) {
        console.log(JSON.stringify({
          level: 'info',
          correlation_id: correlationId,
          message: `Response sent: ${response.status}`,
          timestamp: new Date().toISOString(),
          duration_ms: duration,
          status: response.status
        }));
      }
      
      return enhancedResponse;
      
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Error in edge function',
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }));
      
      // Return standardized error response
      return createCorsResponse({
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  };
}

/**
 * Helper function for simplifying fetch operations with better error handling and retry logic
 */
export async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 500
): Promise<Response> {
  let attempt = 1;
  let lastError;

  // Generate a unique ID for this fetch operation for logging
  const fetchId = crypto.randomUUID().substring(0, 8);
  
  console.log(JSON.stringify({
    level: 'info',
    message: `Starting fetch to ${url.split('?')[0]}`,
    fetch_id: fetchId,
    max_retries: maxRetries,
    timestamp: new Date().toISOString()
  }));

  while (attempt <= maxRetries) {
    try {
      // Apply basic rate limiting
      const now = Date.now();
      const timeSinceLastCall = now - (globalThis as any).lastFetchTime || 0;
      const minInterval = 50; // ms between API calls
      
      if (timeSinceLastCall < minInterval) {
        const waitTime = minInterval - timeSinceLastCall;
        console.log(JSON.stringify({
          level: 'debug',
          message: `Rate limiting, waiting ${waitTime}ms before request`,
          fetch_id: fetchId,
          attempt,
          wait_time: waitTime,
          timestamp: new Date().toISOString()
        }));
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      (globalThis as any).lastFetchTime = Date.now();
      
      // Log request details
      console.log(JSON.stringify({
        level: 'debug',
        message: `Attempt ${attempt}/${maxRetries}: Fetching ${url.split('?')[0]}`,
        fetch_id: fetchId,
        attempt,
        method: options.method || 'GET',
        timestamp: new Date().toISOString()
      }));
      
      // Make the actual request
      const startTime = Date.now();
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      
      // Log response details
      console.log(JSON.stringify({
        level: 'debug',
        message: `Response received in ${duration}ms with status ${response.status}`,
        fetch_id: fetchId,
        attempt,
        status: response.status,
        status_text: response.statusText,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }));
      
      // Check if the response is OK (status in 200-299 range)
      if (!response.ok) {
        // Try to get response text for better error logging
        let responseText = '';
        try {
          // Clone the response to not consume the original
          const clonedResponse = response.clone();
          responseText = await clonedResponse.text();
        } catch (textError) {
          responseText = 'Could not extract response text';
        }
        
        console.error(JSON.stringify({
          level: 'error',
          message: `HTTP error ${response.status}: ${response.statusText}`,
          fetch_id: fetchId,
          attempt,
          status: response.status,
          status_text: response.statusText,
          response_text: responseText,
          timestamp: new Date().toISOString()
        }));
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
      }
      
      console.log(JSON.stringify({
        level: 'info',
        message: `Fetch successful on attempt ${attempt}`,
        fetch_id: fetchId,
        attempt,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }));
      return response;
    } catch (error) {
      lastError = error;
      
      // Categorize the error type for better debugging
      let errorType = 'Unknown';
      if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('network'))) {
        errorType = 'Network';
      } else if (error.message.includes('timeout')) {
        errorType = 'Timeout';
      } else if (error.message.includes('HTTP error')) {
        errorType = 'HTTP';
      } else {
        errorType = 'Other';
      }
      
      console.error(JSON.stringify({
        level: 'error',
        message: `Attempt ${attempt}/${maxRetries} failed`,
        fetch_id: fetchId,
        attempt,
        url: url.split('?')[0],
        error_message: error.message,
        error_type: errorType,
        retry_delay: baseDelay * Math.pow(2, attempt - 1),
        timestamp: new Date().toISOString()
      }));
      
      // Calculate exponential backoff delay with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  console.error(JSON.stringify({
    level: 'error',
    message: `All ${maxRetries} retry attempts failed`,
    fetch_id: fetchId,
    url: url.split('?')[0],
    error_message: lastError?.message,
    timestamp: new Date().toISOString()
  }));
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
