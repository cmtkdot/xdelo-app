
// Simple rate limiter for API calls
export const rateLimitTracker = {
  lastCallTime: 0,
  minInterval: 50, // ms between API calls
};

/**
 * Fetch with retry logic for network resilience
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
  
  console.log(`[FETCH:${fetchId}] Starting fetch to ${url.split('?')[0]} with max ${maxRetries} retries`);

  while (attempt <= maxRetries) {
    try {
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
      console.log(`[FETCH:${fetchId}] Attempt ${attempt}/${maxRetries}: Fetching ${url.split('?')[0]} with method ${options.method || 'GET'}`);
      
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
      
      console.log(`[FETCH:${fetchId}] Fetch successful on attempt ${attempt}`);
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
      
      console.error(`[FETCH:${fetchId}] Attempt ${attempt}/${maxRetries} failed for ${url.split('?')[0]}: 
        ${error.message}
        Type: ${errorType}
        Will retry in ${baseDelay * Math.pow(2, attempt - 1)}ms
      `);
      
      // Calculate exponential backoff delay with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  console.error(`[FETCH:${fetchId}] All ${maxRetries} retry attempts failed for ${url.split('?')[0]}`);
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
