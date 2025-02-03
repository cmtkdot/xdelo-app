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

    // Build the query for original caption messages only
    let query = supabase
      .from("messages")
      .select("*", { count: "exact" })
      .eq('is_original_caption', true)
      .not('analyzed_content', 'is', null);

    // Apply JSON filters
    if (filters.search) {
      query = query.or(`analyzed_content->product_name.ilike.%${filters.search}%,analyzed_content->notes.ilike.%${filters.search}%,caption.ilike.%${filters.search}%`);
    }

    if (filters.vendor && filters.vendor !== "all") {
      query = query.eq("analyzed_content->vendor_uid", filters.vendor);
    }

    if (filters.productCode && filters.productCode !== 'all') {
      query = query.eq("analyzed_content->product_code", filters.productCode);
    }

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

    if (filters.processingState && filters.processingState !== 'all') {
      query = query.eq("processing_state", filters.processingState);
    }

    if (filters.dateFrom) {
      query = query.gte("analyzed_content->purchase_date", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("analyzed_content->purchase_date", filters.dateTo);
    }

    query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    const { data: originalMessages, count, error: originalMessagesError } = await query;

    if (originalMessagesError) throw originalMessagesError;

    const mediaGroupIds = originalMessages?.map(msg => msg.media_group_id).filter(Boolean) || [];
    const groups: Record<string, any[]> = {};

    if (mediaGroupIds.length > 0) {
      const { data: allGroupMedia, error: groupMediaError } = await supabase
        .from("messages")
        .select("*")
        .in("media_group_id", mediaGroupIds);

      if (groupMediaError) throw groupMediaError;

      if (allGroupMedia) {
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
            if (a.is_original_caption && !b.is_original_caption) return -1;
            if (!a.is_original_caption && b.is_original_caption) return 1;
            return 0;
          });
        });
      }
    }

    return new Response(
      JSON.stringify({
        mediaGroups: groups,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching media groups:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});