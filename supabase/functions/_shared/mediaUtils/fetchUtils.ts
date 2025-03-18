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
      
      // For Telegram API responses, check the JSON response
      if (url.includes('api.telegram.org') && !url.includes('/file/')) {
        const clonedResponse = response.clone();
        try {
          const data = await clonedResponse.json();
          if (!data.ok) {
            const errorMessage = `HTTP error! Status: ${response.status} - ${response.statusText}. Response: ${JSON.stringify(data)}`;
            
            // Detect file_id errors specifically
            if (data.description && (
                data.description.includes('wrong file_id') || 
                data.description.includes('file is temporarily unavailable')
              )) {
              throw new Error(`File ID error: ${data.description}`);
            }
            
            throw new Error(errorMessage);
          }
        } catch (parseError) {
          // Only throw if it's our custom file_id error
          if (parseError.message && parseError.message.includes('File ID error')) {
            throw parseError;
          }
          // Otherwise continue with the standard response checks
        }
      }
      
      // Check if the response is OK (status in 200-299 range)
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Handle file_id errors immediately, don't retry these
      if (error.message && error.message.includes('wrong file_id')) {
        console.error(`File ID error detected, not retrying: ${error.message}`);
        throw new Error(`Download failed: ${error.message}`);
      }
      
      console.error(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      // Calculate exponential backoff delay with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.1);
      console.log(`Retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempt++;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Check if a file_id error indicates the file is permanently unavailable
 */
export function isFileIdPermanentlyUnavailable(errorMessage: string): boolean {
  if (!errorMessage) return false;
  
  return errorMessage.includes('wrong file_id') && 
         !errorMessage.includes('temporarily unavailable');
}

/**
 * Check if a file_id error indicates the file might be available later
 */
export function isFileIdTemporarilyUnavailable(errorMessage: string): boolean {
  if (!errorMessage) return false;
  
  return errorMessage.includes('temporarily unavailable');
}
