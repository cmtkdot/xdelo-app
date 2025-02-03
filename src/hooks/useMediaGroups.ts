import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { useToast } from "@/components/ui/use-toast";

export const useMediaGroups = (currentPage: number, filters: FilterValues) => {
  const [mediaGroups, setMediaGroups] = useState<{ [key: string]: MediaItem[] }>({});
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const ITEMS_PER_PAGE = 16;

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        let query = supabase
          .from("messages")
          .select("*", { count: "exact" });

        if (filters.search) {
          query = query.textSearch(
            "analyzed_content->>'product_name'", 
            filters.search
          );
        }

        if (filters.vendor !== "all") {
          query = query.eq("analyzed_content->>'vendor_uid'", filters.vendor);
        }

        if (filters.dateFrom) {
          query = query.gte("created_at", filters.dateFrom.toISOString());
        }

        if (filters.dateTo) {
          query = query.lte("created_at", filters.dateTo.toISOString());
        }

        query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) throw error;

        const total = count || 0;
        setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));

        const groups: { [key: string]: MediaItem[] } = {};
        data?.forEach((message) => {
          const groupKey = message.media_group_id || message.id;
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(message as MediaItem);
        });

        Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
            if (a.is_original_caption && !b.is_original_caption) return -1;
            if (!a.is_original_caption && b.is_original_caption) return 1;
            return 0;
          });
        });

        setMediaGroups(groups);
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, currentPage, filters]);

  return { mediaGroups, totalPages };
};