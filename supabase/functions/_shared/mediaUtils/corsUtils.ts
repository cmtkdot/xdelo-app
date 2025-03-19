
// Re-export CORS headers from the shared CORS utility
import { corsHeaders } from '../cors.ts';

export { corsHeaders };

/**
 * Simple utility to add CORS headers to a Response
 * @param response The response to add CORS headers to
 * @returns The response with CORS headers
 */
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
