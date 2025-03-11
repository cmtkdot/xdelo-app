
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { action, fileData, storagePath, upsert = true } = await req.json();
    const correlationId = crypto.randomUUID();
    
    console.log(`Handling ${action} request:`, { storagePath, correlationId });
    
    switch (action) {
      case 'upload':
        // Upload with upsert enabled, letting Supabase handle content type
        const { data: uploadData, error: uploadError } = await supabaseClient
          .storage
          .from('telegram-media')
          .upload(storagePath, fileData, {
            upsert: true // Always enable overwriting existing files
          });
          
        if (uploadError) throw uploadError;
        
        const publicUrl = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${storagePath}`;
        
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: 'media_management_upload',
          correlation_id: correlationId,
          metadata: {
            storage_path: storagePath,
          }
        });
        
        return new Response(
          JSON.stringify({ success: true, publicUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      case 'validate':
        // Check if a file exists in storage
        const { storagePath: pathToValidate } = await req.json();
        const [bucket, ...pathParts] = pathToValidate.split('/');
        const filePath = pathParts.join('/');
        
        const { data: validateData, error: validateError } = await supabaseClient
          .storage
          .from(bucket || 'telegram-media')
          .download(filePath, { range: { offset: 0, length: 1 } });
          
        return new Response(
          JSON.stringify({ 
            success: true, 
            exists: !validateError && !!validateData 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
