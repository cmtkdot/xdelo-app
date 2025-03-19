
import { xdelo_fetchWithRetry } from '../standardizedHandler.ts';

// Export the fetch utility from baseHandler for consistency
export { xdelo_fetchWithRetry };

// Simple rate limiter for API calls
export const rateLimitTracker = {
  lastCallTime: 0,
  minInterval: 50, // ms between API calls
};

/**
 * Fetch with retry logic for network resilience
 * This is kept for backward compatibility, but now it just calls the shared implementation
 */
export async function xdelo_fetchWithRetryLegacy(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 500
): Promise<Response> {
  return xdelo_fetchWithRetry(url, options, maxRetries, baseDelay);
}
