import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, filters = {}, itemsPerPage = 15 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting fetch-media-groups with filters:', filters);

    let query = supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq('is_deleted', false);

    // Apply text search filter
    if (filters.search) {
      query = query.or(`caption.ilike.%${filters.search}%,analyzed_content->>'product_name'.ilike.%${filters.search}%`);
    }

    // Apply vendor filter using the direct column
    if (filters.vendor && filters.vendor !== "all") {
      query = query.eq('vendor_name', filters.vendor);
      console.log('Applying vendor filter:', filters.vendor);
    }

    // Apply chat ID filter
    if (filters.chatId) {
      query = query.eq('chat_id', filters.chatId);
      console.log('Applying chat ID filter:', filters.chatId);
    }

    // Apply Glide match filter
    if (filters.hasGlideMatch !== undefined) {
      if (filters.hasGlideMatch) {
        query = query.not('glide_match_id', 'is', null);
      } else {
        query = query.is('glide_match_id', null);
      }
      console.log('Applying Glide match filter:', filters.hasGlideMatch);
    }

    // Apply processing state filter
    if (filters.processingState && filters.processingState !== 'all') {
      query = query.eq("processing_state", filters.processingState);
    }

    // Apply date range filters
    if (filters.dateFrom) {
      query = query.gte(`analyzed_content->${filters.dateField}`, filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte(`analyzed_content->${filters.dateField}`, filters.dateTo);
    }

    // Get total count first
    const { count, error: countError } = await query;
    
    if (countError) {
      console.error('Error getting count:', countError);
      throw countError;
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    
    // Validate page number
    const validatedPage = Math.max(1, Math.min(page, totalPages || 1));
    const from = (validatedPage - 1) * itemsPerPage;
    const to = Math.min(from + itemsPerPage - 1, totalCount - 1);

    console.log(`Fetching range ${from} to ${to} of ${totalCount} total items`);

    // Apply sorting based on sortBy field
    const sortOrder = filters.sortOrder || 'desc';
    const sortBy = filters.sortBy || 'date';
    
    switch (sortBy) {
      case 'date':
        query = query.order('created_at', { ascending: sortOrder === 'asc', nullsLast: true });
        break;
      case 'product_name':
        query = query.order('analyzed_content->product_name', { ascending: sortOrder === 'asc', nullsLast: true });
        break;
      case 'vendor':
        query = query.order('vendor_name', { ascending: sortOrder === 'asc', nullsLast: true });
        break;
      case 'chat_id':
        query = query.order('chat_id', { ascending: sortOrder === 'asc', nullsLast: true });
        break;
      default:
        query = query.order('created_at', { ascending: sortOrder === 'asc', nullsLast: true });
    }

    // Apply pagination with validated range
    if (totalCount > 0) {
      query = query.range(from, to);
    }

    console.log('Executing query for original messages...');
    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Group messages by media_group_id
    const groups: { [key: string]: any[] } = {};
    messages?.forEach((message) => {
      const groupId = message.media_group_id || message.id;
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(message);
    });

    console.log(`Returning ${Object.keys(groups).length} media groups`);

    return new Response(
      JSON.stringify({
        mediaGroups: groups,
        totalPages: totalPages || 1
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error in fetch-media-groups function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
