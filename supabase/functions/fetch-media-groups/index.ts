// @ts-expect-error - Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error - Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MessageGroup {
  [key: string]: Array<{
    id: string;
    caption: string | null;
    media_group_id: string | null;
    chat_id: string;
    vendor_name: string | null;
    analyzed_content: Record<string, unknown>;
    created_at: string;
    is_deleted: boolean;
    processing_state: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, filters = {}, itemsPerPage = 16 } = await req.json();

    // @ts-expect-error - Deno environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // @ts-expect-error - Deno environment
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

    // Apply simple sorting based on dateField
    const sortOrder = filters.sortOrder || 'desc';
    const dateField = filters.dateField || 'created_at';
    
    query = query.order(dateField === 'purchase_date' ? 'analyzed_content->purchase_date' : 'created_at', { 
      ascending: sortOrder === 'asc',
      nullsLast: true 
    });

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
    const groups: MessageGroup = {};
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
