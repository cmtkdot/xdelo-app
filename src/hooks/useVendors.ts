
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalyzedContent } from "@/types";

export const useVendors = () => {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        // Use the new compatibility view for consistent field naming
        const { data, error } = await supabase
          .from("v_messages_compatibility")
          .select('analyzed_content, vendor_name')
          .not('analyzed_content', 'is', null)
          .is('is_original_caption', true);

        if (error) throw error;

        const uniqueVendors = new Set<string>();
        data.forEach((item) => {
          // First check the direct vendor_name field from the view
          if (item.vendor_name) {
            uniqueVendors.add(item.vendor_name);
          } else if (item.analyzed_content?.vendor_uid) {
            // Fall back to analyzed_content if needed
            uniqueVendors.add(item.analyzed_content.vendor_uid);
          }
        });

        return Array.from(uniqueVendors).sort();
      } catch (error) {
        console.error("Error fetching vendors:", error);
        return [];
      }
    },
    initialData: []
  });
};
