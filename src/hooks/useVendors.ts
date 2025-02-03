import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnalyzedContent } from "@/types";

export const useVendors = () => {
  const [vendors, setVendors] = useState<string[]>([]);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("analyzed_content")
          .not("analyzed_content", "is", null);

        if (error) throw error;

        const uniqueVendors = new Set<string>();
        data.forEach((message) => {
          const content = message.analyzed_content as AnalyzedContent;
          if (content?.vendor_uid) {
            uniqueVendors.add(content.vendor_uid);
          }
        });

        setVendors(Array.from(uniqueVendors).sort());
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };

    fetchVendors();
  }, []);

  return vendors;
};