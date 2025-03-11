
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleError } from '../_shared/errorHandler.ts';

const handler = async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Connect to Supabase
    const client = supabaseClient;
    
    // Clear deleted_messages table
    await client.from('deleted_messages').delete().neq('original_message_id', '00000000-0000-0000-0000-000000000000');
    
    // Clear other dependent tables
    await client.from('unified_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await client.from('storage_validations').delete().neq('file_unique_id', '');
    await client.from('sync_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Finally delete all messages
    await client.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Log operation
    await client.from('gl_sync_logs').insert({
      operation: 'clear_all_messages',
      status: 'success',
      record_id: 'system',
      table_name: 'messages'
    });
    
    return new Response(
      JSON.stringify({ success: true, message: 'All messages deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, 'Error clearing messages');
  }
};

serve(handler);
