
import { corsHeaders, createCorsResponse } from './cors.ts';

// Security level enum for edge functions
export enum SecurityLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  SERVICE_ROLE = 'service_role',
}

/**
 * Helper function to extract the authorization token from a request
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  
  // Handle both "Bearer token" and "token" formats
  return authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
}

/**
 * Higher order function to add JWT verification to an edge function handler
 * Currently this is a stub since JWT verification is disabled
 */
export function withJwtVerification(
  handler: (req: Request) => Promise<Response>,
  securityLevel: SecurityLevel = SecurityLevel.PUBLIC
) {
  return async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    if (securityLevel === SecurityLevel.PUBLIC) {
      return handler(req);
    }
    
    // Extract token
    const token = extractToken(req);
    
    if (!token) {
      return createCorsResponse({ 
        error: 'Missing authorization token',
        success: false 
      }, { status: 401 });
    }
    
    // In a real implementation, we would verify the JWT here
    // For now, we're just checking for token presence
    
    return handler(req);
  };
}

/**
 * Higher order function to add error handling to an edge function handler
 */
export function withErrorHandling(
  componentName: string,
  handler: (req: Request, correlationId: string) => Promise<Response>,
  options: { securityLevel: SecurityLevel, fallbackToPublic: boolean } = {
    securityLevel: SecurityLevel.PUBLIC,
    fallbackToPublic: true
  }
) {
  return async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Generate correlation ID
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      
      // Check security if needed
      if (options.securityLevel !== SecurityLevel.PUBLIC) {
        const token = extractToken(req);
        
        if (!token) {
          if (!options.fallbackToPublic) {
            return createCorsResponse({ 
              error: 'Missing authorization token',
              success: false 
            }, { status: 401 });
          }
          // If fallback is enabled, continue as public endpoint
          console.warn(JSON.stringify({
            level: 'WARN',
            component: componentName,
            correlation_id: correlationId,
            message: 'Missing authorization token, falling back to public access',
            timestamp: new Date().toISOString()
          }));
        }
      }
      
      // Call the handler
      const response = await handler(req, correlationId);
      return response;
    } catch (error) {
      console.error(JSON.stringify({
        level: 'ERROR',
        component: componentName,
        message: 'Unhandled error in edge function',
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }));
      
      return createCorsResponse({
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  };
}
