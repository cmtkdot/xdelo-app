
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requestData = await req.json();
    const { limit = 1000, dryRun = false } = requestData;

    // 1. Check if bucket is public
    const { data: bucketData, error: bucketError } = await supabase
      .from('storage')
      .select('public')
      .eq('name', 'telegram-media')
      .single();

    // If bucket doesn't exist or isn't public, make it public
    if (bucketError || !bucketData?.public) {
      console.log('Setting telegram-media bucket to public');
      await supabase.rpc('xdelo_execute_sql_query', {
        p_query: `
          UPDATE storage.buckets 
          SET public = true 
          WHERE name = 'telegram-media';
        `,
        p_params: []
      });
    }

    // 2. Make sure RLS policy exists
    const { data: policyData, error: policyError } = await supabase.rpc('xdelo_execute_sql_query', {
      p_query: `
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Public Access to Telegram Media'
      `,
      p_params: []
    });

    if (policyError || !policyData || policyData.length === 0) {
      console.log('Creating RLS policy for telegram-media bucket');
      await supabase.rpc('xdelo_execute_sql_query', {
        p_query: `
          CREATE POLICY "Public Access to Telegram Media" 
          ON storage.objects 
          FOR SELECT
          USING (bucket_id = 'telegram-media');
        `,
        p_params: []
      });
    }

    // 3. Fix all the URLs for the files
    // Get base URL for storage
    const baseUrl = supabaseUrl.replace(/\/$/, '') + '/storage/v1/object/public/telegram-media';
    
    // Get messages that need fixing
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, file_unique_id, mime_type, storage_path, public_url')
      .is('deleted_from_telegram', false)
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (messagesError) {
      throw messagesError;
    }
    
    console.log(`Found ${messages.length} messages to process`);
    
    const results = {
      processed: 0,
      fixed: 0,
      skipped: 0,
      errors: 0
    };
    
    const fixResults = [];
    
    // Process each message to fix URLs
    if (!dryRun) {
      for (const message of messages) {
        try {
          results.processed++;
          
          // Skip if already has correct URL
          if (message.public_url && message.public_url.startsWith(baseUrl)) {
            results.skipped++;
            continue;
          }
          
          // Determine content disposition based on MIME type
          const isViewable = message.mime_type && (
            message.mime_type.startsWith('image/') || 
            message.mime_type.startsWith('video/') || 
            message.mime_type.startsWith('audio/') || 
            message.mime_type === 'application/pdf'
          );
          
          const contentDisposition = isViewable ? 'inline' : 'attachment';
          
          // Fix metadata in storage.objects
          await supabase.rpc('xdelo_execute_sql_query', {
            p_query: `
              UPDATE storage.objects
              SET metadata = jsonb_build_object(
                'contentType', $1,
                'cacheControl', '3600',
                'contentDisposition', $2
              )
              WHERE bucket_id = 'telegram-media' AND name = $3
            `,
            p_params: [message.mime_type || 'application/octet-stream', contentDisposition, message.storage_path]
          });
          
          // Update message with correct public URL
          const newPublicUrl = `${baseUrl}/${message.storage_path}`;
          
          await supabase
            .from('messages')
            .update({
              public_url: newPublicUrl,
              mime_type_verified: true,
              content_disposition: contentDisposition,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
          
          fixResults.push({
            id: message.id,
            old_url: message.public_url,
            new_url: newPublicUrl,
            mime_type: message.mime_type,
            content_disposition: contentDisposition
          });
          
          results.fixed++;
        } catch (error) {
          console.error(`Error fixing message ${message.id}:`, error);
          results.errors++;
        }
      }
    }
    
    // Log the operation
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'media_urls_fixed',
        entity_id: 'system',
        metadata: {
          ...results,
          dry_run: dryRun,
          timestamp: new Date().toISOString()
        },
        correlation_id: crypto.randomUUID()
      });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${results.processed} files, fixed ${results.fixed}, skipped ${results.skipped}, errors ${results.errors}`,
        results,
        details: fixResults.slice(0, 10) // Return first 10 fixed entries
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fixing media URLs:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
