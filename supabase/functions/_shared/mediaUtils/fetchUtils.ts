
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

  while (attempt <= maxRetries) {
    try {
      // Apply basic rate limiting
      const now = Date.now();
      const timeSinceLastCall = now - rateLimitTracker.lastCallTime;
      
      if (timeSinceLastCall < rateLimitTracker.minInterval) {
        await new Promise(resolve => setTimeout(resolve, rateLimitTracker.minInterval - timeSinceLastCall));
      }
      
      rateLimitTracker.lastCallTime = Date.now();
      
      // Make the actual request
      const response = await fetch(url, options);
      
      // Check if the response is OK (status in 200-299 range)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      // Calculate exponential backoff delay with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
