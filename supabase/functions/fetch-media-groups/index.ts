import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FilterValues {
  search?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: "desc" | "asc";
  productCode?: string;
  quantityRange?: string;
  processingState?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, filters = {} } = await req.json() as { page: number; filters: FilterValues };
    const ITEMS_PER_PAGE = 15;

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
      query = query.or(`caption.ilike.%${filters.search}%,analyzed_content->product_name.ilike.%${filters.search}%`);
    }

    // Apply vendor filter
    if (filters.vendor && filters.vendor !== "all") {
      query = query.eq('analyzed_content->vendor_uid', filters.vendor);
    }

    // Apply product code filter
    if (filters.productCode && filters.productCode !== 'all') {
      query = query.eq('analyzed_content->product_code', filters.productCode);
    }

    // Apply quantity range filter
    if (filters.quantityRange && filters.quantityRange !== 'all') {
      if (filters.quantityRange === 'undefined') {
        query = query.is('analyzed_content->quantity', null);
      } else if (filters.quantityRange === '21+') {
        query = query.gte('analyzed_content->quantity', '21');
      } else {
        const [min, max] = filters.quantityRange.split('-').map(Number);
        query = query
          .gte('analyzed_content->quantity', min.toString())
          .lte('analyzed_content->quantity', max.toString());
      }
    }

    // Apply processing state filter
    if (filters.processingState && filters.processingState !== 'all') {
      query = query.eq("processing_state", filters.processingState);
    }

    // Apply date range filters
    if (filters.dateFrom) {
      query = query.gte('analyzed_content->purchase_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('analyzed_content->purchase_date', filters.dateTo);
    }

    // Apply sorting with NULLS LAST
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order('created_at', { 
      ascending: sortOrder === "asc",
      nullsFirst: false
    });

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    console.log('Executing query for original messages...');
    const { data: messages, count, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Group messages by media_group_id or individual message id
    const groups: Record<string, any[]> = {};
    messages?.forEach((message) => {
      const groupKey = message.media_group_id || message.id;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(message);
    });

    // If we have media groups, fetch all related media
    const mediaGroupIds = messages
      ?.filter(msg => msg.media_group_id)
      .map(msg => msg.media_group_id) || [];

    if (mediaGroupIds.length > 0) {
      console.log('Fetching related media for groups:', mediaGroupIds);
      const { data: groupMedia, error: groupMediaError } = await supabase
        .from("messages")
        .select("*")
        .in("media_group_id", mediaGroupIds)
        .eq('is_deleted', false);

      if (groupMediaError) {
        console.error('Error fetching group media:', groupMediaError);
        throw groupMediaError;
      }

      // Add group media to their respective groups
      groupMedia?.forEach((message) => {
        const groupKey = message.media_group_id || message.id;
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        if (!groups[groupKey].some(m => m.id === message.id)) {
          groups[groupKey].push(message);
        }
      });
    }

    // Sort groups internally by creation date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (a.is_original_caption && !b.is_original_caption) return -1;
        if (!a.is_original_caption && b.is_original_caption) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });

    console.log(`Returning ${Object.keys(groups).length} groups with total count ${count}`);

    return new Response(
      JSON.stringify({
        mediaGroups: groups,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
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
          'Content-Type': 'application/json'
        }
      }
    );
  }
});