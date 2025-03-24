
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

interface JwtVerificationOptions {
  securityLevel: SecurityLevel;
  adminOnly?: boolean;
}

/**
 * Verify JWT token in the request
 */
export async function verifyJWT(
  req: Request, 
  options: JwtVerificationOptions
): Promise<{ userId: string | null; error?: Error }> {
  // For PUBLIC level, we don't need to verify JWT
  if (options.securityLevel === SecurityLevel.PUBLIC) {
    return { userId: null };
  }
  
  try {
    // Get JWT from request
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }
    
    const jwt = authHeader.replace('Bearer ', '');
    
    // Create anon supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    
    if (error || !user) {
      throw new Error(error?.message || 'Invalid JWT token');
    }
    
    // If adminOnly is true, verify user has admin role
    if (options.adminOnly) {
      // Implement admin check based on your system
      // For example:
      // const isAdmin = user.app_metadata?.role === 'admin';
      // if (!isAdmin) {
      //   throw new Error('Admin access required');
      // }
    }
    
    return { userId: user.id };
  } catch (error) {
    return { userId: null, error };
  }
}

/**
 * Wrap a handler function with error handling and JWT verification
 */
export function withSecureErrorHandling(
  functionName: string,
  handler: (req: Request, userId?: string) => Promise<Response>,
  options: JwtVerificationOptions
) {
  return async (req: Request): Promise<Response> => {
    try {
      if (options.securityLevel !== SecurityLevel.PUBLIC) {
        const { userId, error } = await verifyJWT(req, options);
        
        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Authentication failed: ${error.message}`
            }),
            { status: 401, headers: { "Content-Type": "application/json" } }
          );
        }
        
        return await handler(req, userId || undefined);
      }
      
      return await handler(req);
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || "An unexpected error occurred"
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  };
}

/**
 * Create a secure handler with JWT verification
 */
export function createSecureHandler(
  handler: (req: Request, userId?: string) => Promise<Response>,
  options: JwtVerificationOptions
) {
  return withSecureErrorHandling("secure-handler", handler, options);
}
