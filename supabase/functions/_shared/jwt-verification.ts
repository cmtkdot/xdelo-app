
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Define security levels
export enum SecurityLevel {
  PUBLIC = 'public',         // No JWT verification required
  AUTHENTICATED = 'authenticated', // Requires a valid user JWT
  SERVICE_ROLE = 'service_role'    // Requires a service role JWT
}

export interface JwtVerificationOptions {
  securityLevel: SecurityLevel;
  fallbackToPublic?: boolean; // If true, falls back to public access when JWT verification fails
  bypassForServiceRole?: boolean; // If true, allows service role tokens to bypass security
}

const defaultOptions: JwtVerificationOptions = {
  securityLevel: SecurityLevel.PUBLIC,
  fallbackToPublic: false,
  bypassForServiceRole: true
};

export async function verifyJWT(
  req: Request, 
  options: Partial<JwtVerificationOptions> = {}
): Promise<{ 
  isAuthorized: boolean; 
  userId?: string; 
  isServiceRole?: boolean;
  error?: string;
}> {
  // Merge options with defaults
  const configuredOptions: JwtVerificationOptions = {
    ...defaultOptions,
    ...options
  };

  // If security level is PUBLIC, return authorized without checking
  if (configuredOptions.securityLevel === SecurityLevel.PUBLIC) {
    return { isAuthorized: true };
  }

  // Get the JWT from the Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    // Return unauthorized if no auth header and not falling back to public
    if (!configuredOptions.fallbackToPublic) {
      return { 
        isAuthorized: false, 
        error: 'Authorization header missing' 
      };
    }
    return { isAuthorized: true };
  }

  try {
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '');
    
    // Check if this is a service role token (using a basic check)
    // Service role tokens are usually longer and have different claims
    const isServiceRoleCheck = token.length > 500;
    
    // Create Supabase client for token verification
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // A service role token can bypass other checks if configured to
    if (isServiceRoleCheck && configuredOptions.bypassForServiceRole) {
      return { 
        isAuthorized: true, 
        isServiceRole: true 
      };
    }
    
    // For authenticated or service role levels, verify the token
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      // If fallback is enabled, still authorize
      if (configuredOptions.fallbackToPublic) {
        return { isAuthorized: true };
      }
      return { 
        isAuthorized: false, 
        error: error?.message || 'Invalid token' 
      };
    }
    
    // If we made it here, the token is valid and the user is authenticated
    return { 
      isAuthorized: true, 
      userId: user.id,
      isServiceRole: isServiceRoleCheck
    };
  } catch (error) {
    console.error('JWT verification error:', error);
    
    // Fall back to public access if configured
    if (configuredOptions.fallbackToPublic) {
      return { isAuthorized: true };
    }
    
    return { 
      isAuthorized: false, 
      error: `JWT verification error: ${error.message}` 
    };
  }
}

// Create a handler wrapper with JWT verification
export function createSecureHandler(
  handlerFn: (req: Request, userId?: string, isServiceRole?: boolean) => Promise<Response>,
  options: Partial<JwtVerificationOptions> = {}
) {
  return async (req: Request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Verify the JWT
    const { isAuthorized, userId, isServiceRole, error } = await verifyJWT(req, options);
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ 
          error: error || 'Unauthorized',
          message: 'You must be logged in to access this resource'
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // If authorized, call the handler function
    try {
      return await handlerFn(req, userId, isServiceRole);
    } catch (error) {
      console.error('Error in secure handler:', error);
      
      return new Response(
        JSON.stringify({ 
          error: error.message || 'Internal Server Error',
          message: 'An error occurred while processing your request'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}

// Enhanced error handler that includes JWT verification
export function withSecureErrorHandling(
  functionName: string, 
  handler: Function, 
  jwtOptions?: Partial<JwtVerificationOptions>
) {
  return async (req: Request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const correlationId = crypto.randomUUID();
    
    // If security is enabled, verify the JWT
    if (jwtOptions && jwtOptions.securityLevel !== SecurityLevel.PUBLIC) {
      const { isAuthorized, error } = await verifyJWT(req, jwtOptions);
      
      if (!isAuthorized) {
        console.error(`Unauthorized access attempt to ${functionName}:`, error);
        
        // Create Supabase client for error logging
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Log the unauthorized access attempt
        try {
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'unauthorized_access_attempt',
            error_message: error,
            correlation_id: correlationId,
            metadata: {
              function_name: functionName,
              request_method: req.method,
              request_url: req.url
            },
            event_timestamp: new Date().toISOString()
          });
        } catch (logError) {
          console.error('Failed to log unauthorized access:', logError);
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized',
            message: error || 'You must be logged in to access this resource',
            correlation_id: correlationId
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    try {
      return await handler(req, correlationId);
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      // Create Supabase client for error logging
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Log the error to database
      try {
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: `${functionName}_error`,
          error_message: error.message,
          correlation_id: correlationId,
          metadata: {
            error_stack: error.stack,
            request_method: req.method,
            request_url: req.url
          },
          event_timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      // Return error response
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          correlation_id: correlationId
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}
