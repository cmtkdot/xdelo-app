
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_distinct_vendors', {})
        .order('vendor', { ascending: true });

      if (error) throw error;
      
      // If the RPC function doesn't exist yet, fall back to a simple query
      if (!data) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('v_messages_compatibility')
          .select('analyzed_content->vendor_uid')
          .not('analyzed_content->vendor_uid', 'is', null);
        
        if (fallbackError) throw fallbackError;
        
        // Extract unique vendor values
        const vendors = new Set<string>();
        
        fallbackData?.forEach(row => {
          if (row.analyzed_content?.vendor_uid) {
            vendors.add(row.analyzed_content.vendor_uid as string);
          }
        });
        
        return Array.from(vendors).sort();
      }
      
      return data.map(item => item.vendor);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
