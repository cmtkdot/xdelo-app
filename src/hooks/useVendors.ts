
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnalyzedContent } from "@/types";

export const useVendors = () => {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select('analyzed_content')
          .not('analyzed_content', 'is', null)
          .is('is_original_caption', true);

        if (error) throw error;

        const uniqueVendors = new Set<string>();
        data.forEach((item) => {
          const content = item.analyzed_content as AnalyzedContent;
          if (content?.vendor_uid) {
            uniqueVendors.add(content.vendor_uid);
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
