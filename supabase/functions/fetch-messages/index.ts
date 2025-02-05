import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface Message {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  caption?: string;
  public_url?: string;
  analyzed_content?: Record<string, any>;
  processing_state?: string;
  created_at?: string;
  updated_at?: string;
}

interface QueryParams {
  page?: number;
  per_page?: number;
  media_group_id?: string;
  processing_state?: string;
  has_analyzed_content?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Processing fetch-messages request');
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 100); // Cap at 100
    const media_group_id = url.searchParams.get('media_group_id') || undefined;
    const processing_state = url.searchParams.get('processing_state') || undefined;
    const has_analyzed_content = url.searchParams.get('has_analyzed_content') === 'true';

    console.log('📊 Query params:', { page, per_page, media_group_id, processing_state, has_analyzed_content });

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Start building the query
    let query = supabaseClient
      .from('messages')
      .select(`
        id,
        telegram_message_id,
        media_group_id,
        caption,
        public_url,
        analyzed_content,
        processing_state,
        created_at,
        updated_at,
        mime_type,
        file_size,
        width,
        height
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (media_group_id) {
      query = query.eq('media_group_id', media_group_id);
    }
    if (processing_state) {
      query = query.eq('processing_state', processing_state);
    }
    if (has_analyzed_content) {
      query = query.not('analyzed_content', 'is', null);
    }

    // Apply pagination
    const start = (page - 1) * per_page;
    query = query.range(start, start + per_page - 1);

    console.log('🔍 Executing query...');
    const { data: messages, error, count } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    // Log success metrics
    console.log('✅ Query successful:', {
      total_messages: messages?.length || 0,
      page,
      per_page,
      data_size: JSON.stringify(messages).length
    });

    // Return the messages data with pagination info
    return new Response(
      JSON.stringify({
        messages,
        pagination: {
          current_page: page,
          per_page,
          total: count,
          total_pages: Math.ceil((count || 0) / per_page)
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Error in fetch-messages:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})