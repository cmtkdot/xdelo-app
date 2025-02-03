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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { page = 1, filters = {} } = await req.json() as { page: number; filters: FilterValues };
    const ITEMS_PER_PAGE = 16;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build the base query for messages with original captions
    let query = supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq('is_original_caption', true)
      .not('analyzed_content', 'is', null);

    // Apply text search filter across product name in analyzed_content
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      query = query.ilike('analyzed_content->product_name', searchTerm);
    }

    // Apply vendor filter using vendor_uid from analyzed_content
    if (filters.vendor && filters.vendor !== "all") {
      query = query.eq('analyzed_content->vendor_uid', filters.vendor);
    }

    // Apply product code filter using product_code from analyzed_content
    if (filters.productCode && filters.productCode !== 'all') {
      query = query.eq('analyzed_content->product_code', filters.productCode);
    }

    // Apply quantity range filter using quantity from analyzed_content
    if (filters.quantityRange && filters.quantityRange !== 'all') {
      if (filters.quantityRange === 'undefined') {
        query = query.is('analyzed_content->quantity', null);
      } else if (filters.quantityRange === '21+') {
        query = query.gte('analyzed_content->quantity', 21);
      } else {
        const [min, max] = filters.quantityRange.split('-').map(Number);
        query = query
          .gte('analyzed_content->quantity', min)
          .lte('analyzed_content->quantity', max);
      }
    }

    // Apply processing state filter
    if (filters.processingState && filters.processingState !== 'all') {
      query = query.eq("processing_state", filters.processingState);
    }

    // Apply date range filters using purchase_date from analyzed_content
    if (filters.dateFrom) {
      query = query.gte('analyzed_content->purchase_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('analyzed_content->purchase_date', filters.dateTo);
    }

    // Apply sorting
    query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    console.log('Executing query for original messages...');
    const { data: originalMessages, count, error: originalMessagesError } = await query;

    if (originalMessagesError) {
      console.error('Error fetching original messages:', originalMessagesError);
      throw originalMessagesError;
    }

    // Get all media group IDs from the original messages
    const mediaGroupIds = originalMessages
      ?.map(msg => msg.media_group_id)
      .filter(Boolean) || [];

    const groups: Record<string, any[]> = {};

    // If we have media groups, fetch all related media
    if (mediaGroupIds.length > 0) {
      console.log('Fetching related media for groups:', mediaGroupIds);
      const { data: allGroupMedia, error: groupMediaError } = await supabase
        .from("messages")
        .select("*")
        .in("media_group_id", mediaGroupIds);

      if (groupMediaError) {
        console.error('Error fetching group media:', groupMediaError);
        throw groupMediaError;
      }

      if (allGroupMedia) {
        // Organize messages into groups
        allGroupMedia.forEach((message) => {
          const groupKey = message.media_group_id || message.id;
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(message);
        });

        // Sort messages within each group
        Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
            // Prioritize messages with original captions
            if (a.is_original_caption && !b.is_original_caption) return -1;
            if (!a.is_original_caption && b.is_original_caption) return 1;
            
            // Then sort by creation date
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
        });
      }
    }

    console.log('Returning response with groups:', {
      groupCount: Object.keys(groups).length,
      totalMessages: count,
      totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
    });

    return new Response(
      JSON.stringify({
        mediaGroups: groups,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-media-groups function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});