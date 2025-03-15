
import { corsHeaders } from './corsUtils';

/**
 * Enhanced fetch function with exponential backoff retry logic and improved error handling
 * @param url The URL to fetch
 * @param options Fetch options
 * @param maxRetries Maximum number of retry attempts
 * @param retryDelay Initial delay between retries in ms
 * @returns The fetch response
 */
export async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 5,
  initialRetryDelay: number = 500
): Promise<Response> {
  let retryCount = 0;
  let retryDelay = initialRetryDelay;
  let lastError: Error | null = null;
  
  while (retryCount < maxRetries) {
    try {
      // Add timeout to avoid hanging requests using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const enhancedOptions = {
        ...options,
        signal: controller.signal
      };
      
      // Add detailed logging for debugging
      console.log(`Attempt ${retryCount + 1}/${maxRetries} to fetch ${url.substring(0, 100)}...`);
      
      const response = await fetch(url, enhancedOptions);
      clearTimeout(timeoutId);
      
      // Check if response is OK (status 200-299)
      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to get response text');
        throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${responseText.substring(0, 200)}`);
      }
      
      console.log(`Successfully fetched ${url.substring(0, 100)} on attempt ${retryCount + 1}`);
      return response;
    } catch (error) {
      lastError = error;
      retryCount++;
      
      // Classify errors for better handling
      const isNetworkError = error.message.includes('NetworkError') || 
                            error.message.includes('network') ||
                            error.message.includes('Failed to fetch');
                            
      const isTimeoutError = error.name === 'AbortError' || 
                            error.message.includes('timeout') ||
                            error.message.includes('aborted');
                            
      const isServerError = error.message.includes('5') && 
                           error.message.includes('HTTP error');
      
      // Enhanced logging with error classification
      console.warn(`Fetch attempt ${retryCount}/${maxRetries} failed for ${url.substring(0, 100)}: 
        Error: ${error.message}
        Type: ${isNetworkError ? 'Network Error' : isTimeoutError ? 'Timeout' : isServerError ? 'Server Error' : 'Other'}
        Will ${retryCount < maxRetries ? `retry in ${retryDelay}ms` : 'not retry'}`);
      
      // If we've reached max retries, throw the last error
      if (retryCount >= maxRetries) {
        console.error(`All ${maxRetries} retry attempts failed for ${url.substring(0, 100)}`);
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait with exponential backoff before retrying
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      // Exponential backoff with jitter to avoid thundering herd
      // More aggressive backoff for network errors, more patient for server errors
      const backoffFactor = isNetworkError ? 1.5 : isServerError ? 2.5 : 2;
      retryDelay = Math.min(
        retryDelay * backoffFactor * (0.8 + Math.random() * 0.4),
        60000
      );
    }
  }
  
  // This should never execute but TypeScript needs it
  throw lastError || new Error('Unknown error during fetch');
}

// Track rate limits for Telegram API to avoid hitting limits
export const rateLimitTracker = {
  lastRequestTime: 0,
  requestCount: 0,
  reset() {
    this.lastRequestTime = Date.now();
    this.requestCount = 0;
  },
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    // If it's been more than a minute, reset the counter
    if (elapsed > 60000) {
      this.reset();
      return;
    }
    
    // Telegram's rate limit is roughly 30 requests per second
    // We'll be conservative and limit to 20 per second
    this.requestCount++;
    
    if (this.requestCount > 20) {
      // Wait until the next second before proceeding
      const waitTime = Math.max(1000 - elapsed, 100);
      console.log(`Rate limit approaching, waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.reset();
    }
  }
};
