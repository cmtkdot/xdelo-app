
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        // Try to get vendors from a direct query on analyzed_content
        const { data, error } = await supabase
          .from('v_messages_compatibility')
          .select('analyzed_content')
          .not('analyzed_content', 'is', null);
        
        if (error) throw error;
        
        // Extract unique vendor values
        const vendors = new Set<string>();
        
        if (data && Array.isArray(data)) {
          data.forEach(row => {
            if (row.analyzed_content && 
                typeof row.analyzed_content === 'object' && 
                'vendor_uid' in row.analyzed_content) {
              const vendorUid = row.analyzed_content.vendor_uid;
              if (vendorUid && typeof vendorUid === 'string') {
                vendors.add(vendorUid);
              }
            }
          });
        }
        
        return Array.from(vendors).sort();
      } catch (fallbackErr) {
        console.error("Error fetching vendors:", fallbackErr);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
