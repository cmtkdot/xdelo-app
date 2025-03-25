
import { xdelo_withNetworkRetry } from '../retryUtils.ts';

// Simple rate limiter for API calls
export const rateLimitTracker = {
  lastCallTime: 0,
  minInterval: 50, // ms between API calls
};

/**
 * Enhanced fetch with comprehensive retry logic for network resilience
 */
export async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 500
): Promise<Response> {
  // Generate a unique ID for this fetch operation for logging
  const fetchId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[FETCH:${fetchId}] Starting fetch to ${url.split('?')[0]} with max ${maxRetries} retries`);

  return await xdelo_withNetworkRetry(url, async () => {
    // Apply basic rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - rateLimitTracker.lastCallTime;
    
    if (timeSinceLastCall < rateLimitTracker.minInterval) {
      const waitTime = rateLimitTracker.minInterval - timeSinceLastCall;
      console.log(`[FETCH:${fetchId}] Rate limiting, waiting ${waitTime}ms before request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    rateLimitTracker.lastCallTime = Date.now();
    
    // Log request details
    console.log(`[FETCH:${fetchId}] Fetching ${url.split('?')[0]} with method ${options.method || 'GET'}`);
    
    // Make the actual request
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    // Log response details
    console.log(`[FETCH:${fetchId}] Response received in ${duration}ms with status ${response.status} ${response.statusText}`);
    
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
      
      console.error(`[FETCH:${fetchId}] HTTP error ${response.status}: ${response.statusText}. Response: ${responseText}`);
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${responseText}`);
    }
    
    console.log(`[FETCH:${fetchId}] Fetch successful`);
    return response;
  }, {
    maxRetries,
    initialDelayMs: baseDelay,
    backoffFactor: 2,
    jitterFactor: 0.25, // Add some randomness to prevent thundering herd
    retryableErrors: [
      // Network errors
      'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE',
      /network/i, /connection/i, /timeout/i, /socket/i,
      // HTTP errors (these can sometimes be retried)
      /^429/, // Too Many Requests
      /^5\d\d/, // 5xx Server errors
      /^408/,  // Request Timeout
      // Fetch-specific errors
      'AbortError', 'TypeError'
    ]
  });
}
