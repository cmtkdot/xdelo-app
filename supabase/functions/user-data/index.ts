import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { createEdgeHandler } from "../_shared/edgeHandler.ts";

// Create Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler (requires authentication)
const handleUserData = async (req: Request, context: { correlationId: string, logger: any }) => {
  const { correlationId, logger } = context;
  logger.info(`Processing user data request`, { correlationId });
  
  // Get the JWT from the request
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Authorization header missing');
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  // Get the user from the token
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
  
  if (authError || !user) {
    throw new Error(authError?.message || 'Invalid token');
  }
  
  const userId = user.id;
  logger.info(`Request from user`, { userId });
  
  // Get the user's data (adjust table and query as needed)
  const { data: userData, error: dataError } = await supabaseClient
    .from('messages')
    .select('id, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (dataError) {
    throw new Error(`Error fetching user data: ${dataError.message}`);
  }
  
  // Log the successful request
  try {
    // Import the logging function
    const { xdelo_logProcessingEvent } = await import('../_shared/databaseOperations.ts');
    
    // Use the proper logging function with UUID handling
    await xdelo_logProcessingEvent(
      'user_data_accessed',
      crypto.randomUUID().toString(),
      correlationId,
      {
        user_id: userId,
        timestamp: new Date().toISOString()
      }
    );
  } catch (logError) {
    console.error('Error logging user data access:', logError);
    // Continue execution - don't fail if logging fails
  }
  
  return {
    success: true,
    data: userData,
    user_id: userId,
    correlation_id: correlationId
  };
};

// Create handler with the new edge handler
const handler = createEdgeHandler(handleUserData, {
  requireAuth: true,
  corsEnabled: true,
  logLevel: 'info'
});

// Serve the handler
serve(handler);
