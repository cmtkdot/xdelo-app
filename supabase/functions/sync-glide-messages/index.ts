import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_BATCH_SIZE = 500; // Glide's maximum batch size

interface SyncData {
  id: string;
  analyzed_content: Record<string, any>;
  caption?: string;
  public_url?: string;
  media_group_id?: string;
  processing_state: string;
  created_at: string;
  updated_at: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting Glide sync process');

    // Get query parameters
    const url = new URL(req.url);
    const lastSyncTime = url.searchParams.get('last_sync') || '';
    const batchSize = MAX_BATCH_SIZE; // Always use max batch size for Glide

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Build query for messages that need syncing
    let query = supabaseClient
      .from('messages')
      .select(`
        id,
        analyzed_content,
        caption,
        public_url,
        media_group_id,
        processing_state,
        created_at,
        updated_at,
        mime_type,
        file_size,
        width,
        height
      `)
      .order('updated_at', { ascending: true })
      .limit(batchSize);

    // Add last sync filter if provided
    if (lastSyncTime) {
      query = query.gt('updated_at', lastSyncTime);
    }

    console.log('📥 Fetching messages:', {
      last_sync: lastSyncTime || 'none',
      batch_size: batchSize
    });

    const { data: messages, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    if (!messages || messages.length === 0) {
      console.log('ℹ️ No messages found');
      return new Response(
        JSON.stringify([]), // Return empty array for Glide
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // Process messages for Glide - add next_sync_time to each record
    const lastUpdate = messages[messages.length - 1]?.updated_at;
    const processedMessages = messages.map((msg: SyncData) => ({
      id: msg.id,
      analyzed_content: msg.analyzed_content || {},
      caption: msg.caption || '',
      public_url: msg.public_url || '',
      media_group_id: msg.media_group_id || '',
      processing_state: msg.processing_state,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      mime_type: msg.mime_type || '',
      file_size: msg.file_size || 0,
      width: msg.width || 0,
      height: msg.height || 0,
      next_sync_time: lastUpdate // Add this to each record for Glide to use
    }));

    console.log('✅ Sync successful:', {
      messages_processed: processedMessages.length,
      last_update: lastUpdate,
      data_size: JSON.stringify(processedMessages).length
    });

    // Return just the array for Glide
    return new Response(
      JSON.stringify(processedMessages),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Error in sync process:', error);
    return new Response(
      JSON.stringify([]), // Return empty array on error for Glide
      { 
        status: 200, // Return 200 even on error for Glide
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})