import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler (requires authentication)
const handleUserData = async (req: Request, correlationId: string) => {
  console.log(`Processing user data request with correlation ID: ${correlationId}`);
  
  try {
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
    console.log(`Request from user: ${userId}`);
    
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
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'user_data_accessed',
      entity_id: userId,
      correlation_id: correlationId,
      metadata: {
        user_id: userId,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: userData,
        user_id: userId,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling user data request:', error);
    throw error; // This will be caught by the error handler wrapper
  }
};

// Serve with error handling and JWT verification
serve(withErrorHandling(
  'user-data', 
  handleUserData, 
  { 
    securityLevel: SecurityLevel.AUTHENTICATED,
    fallbackToPublic: false
  }
));
