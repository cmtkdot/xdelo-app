import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useVendors = () => {
  const [vendors, setVendors] = useState<string[]>([]);

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("analyzed_content->vendor_uid")
          .not("analyzed_content->vendor_uid", "is", null)
          .not("analyzed_content->vendor_uid", "eq", "");

        if (error) throw error;

        const uniqueVendors = new Set<string>();
        data.forEach((item) => {
          if (item.vendor_uid) {
            uniqueVendors.add(item.vendor_uid);
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