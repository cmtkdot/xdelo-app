
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
    const ITEMS_PER_PAGE = 16; // 4x4 grid

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Building query with filters:', filters);

    let query = supabase
      .from("messages")
      .select("*", { count: "exact" })
      .is('is_deleted', false); // Exclude deleted messages

    // Apply text search filter
    if (filters.search) {
      query = query.ilike('analyzed_content->>product_name', `%${filters.search}%`);
    }

    // Apply vendor filter
    if (filters.vendor && filters.vendor !== "all") {
      query = query.eq('analyzed_content->>vendor_uid', filters.vendor);
    }

    // Apply product code filter
    if (filters.productCode && filters.productCode !== 'all') {
      query = query.eq('analyzed_content->>product_code', filters.productCode);
    }

    // Apply quantity range filter
    if (filters.quantityRange && filters.quantityRange !== 'all') {
      if (filters.quantityRange === 'undefined') {
        query = query.is('analyzed_content->>quantity', null);
      } else if (filters.quantityRange === '21+') {
        query = query.gte('analyzed_content->>quantity', '21');
      } else {
        const [min, max] = filters.quantityRange.split('-').map(Number);
        query = query
          .gte('analyzed_content->>quantity', min.toString())
          .lte('analyzed_content->>quantity', max.toString());
      }
    }

    // Apply processing state filter
    if (filters.processingState && filters.processingState !== 'all') {
      query = query.eq("processing_state", filters.processingState);
    }

    // Apply date range filters
    const dateField = filters.dateField || 'purchase_date';
    if (filters.dateFrom) {
      query = query.gte(`analyzed_content->>${dateField}`, filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte(`analyzed_content->>${dateField}`, filters.dateTo);
    }

    // Apply sorting with NULLS LAST
    const sortOrder = filters.sortOrder || 'desc';
    if (dateField === 'purchase_date') {
      query = query.order(`analyzed_content->>${dateField}`, { 
        ascending: sortOrder === "asc",
        nullsFirst: false
      });
    } else {
      query = query.order(dateField, { 
        ascending: sortOrder === "asc",
        nullsFirst: false
      });
    }

    // Apply pagination
    const from = (page - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;
    query = query.range(from, to);

    console.log('Executing query for messages...');
    const { data: messages, count, error: messagesError } = await query;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    console.log(`Found ${messages?.length || 0} messages`);

    // Initialize groups object
    const groups: Record<string, any[]> = {};

    // Process messages and organize them into groups
    if (messages) {
      // First, separate original caption messages
      const originalCaptionMessages = messages.filter(msg => msg.is_original_caption);
      const nonOriginalMessages = messages.filter(msg => !msg.is_original_caption);

      // Add original caption messages to groups
      originalCaptionMessages.forEach(msg => {
        const groupKey = msg.media_group_id || msg.id;
        groups[groupKey] = [msg];
      });

      // Add non-original messages to their respective groups
      nonOriginalMessages.forEach(msg => {
        const groupKey = msg.media_group_id || msg.id;
        if (groups[groupKey]) {
          groups[groupKey].push(msg);
        } else {
          // If we don't have the original caption message, start a new group
          groups[groupKey] = [msg];
        }
      });

      // Sort messages within each group
      Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => {
          if (a.is_original_caption && !b.is_original_caption) return -1;
          if (!a.is_original_caption && b.is_original_caption) return 1;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      });
    }

    console.log(`Organized into ${Object.keys(groups).length} groups`);

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
