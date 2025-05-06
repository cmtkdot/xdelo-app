// CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
export { supabaseClient, createSupabaseClient, handleSupabaseError, executeQuery } from './supabaseClient.ts';
/**
 * Checks if a request is a CORS preflight request
 * @param req The request object
 * @returns True if the request is a preflight request
 */ export function isPreflightRequest(req) {
  return req.method === 'OPTIONS' && req.headers.has('Access-Control-Request-Method');
}
/**
 * Handles CORS preflight requests
 * @returns A response with CORS headers
 */ export function handleOptionsRequest() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
/**
 * Creates a response with CORS headers
 * @param body The response body (will be JSON stringified)
 * @param options Response options (status, headers)
 * @returns A Response object with CORS headers
 */ export function createCorsResponse(body, options = {}) {
  const { status = 200, headers = {} } = options;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...headers
    }
  });
}
