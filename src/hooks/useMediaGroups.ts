import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { useMessageSearch } from "./useMessageSearch";

export const useMediaGroups = (currentPage: number, filters: FilterValues) => {
  const [mediaGroups, setMediaGroups] = useState<{ [key: string]: MediaItem[] }>({});
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const { buildSearchQuery, buildVendorFilter, buildDateFilter } = useMessageSearch();
  const ITEMS_PER_PAGE = 16;

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        let query = supabase
          .from("messages")
          .select("*", { count: "exact" });

        // Apply filters using the search utility functions
        query = buildSearchQuery(query, filters.search);
        query = buildVendorFilter(query, filters.vendor);
        query = buildDateFilter(query, filters.dateFrom, filters.dateTo);

        // Prioritize original caption messages and apply sorting
        query = query
          .order("is_original_caption", { ascending: false })
          .order("created_at", { ascending: filters.sortOrder === "asc" });

        // Apply pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        const total = count || 0;
        setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));

        // Group messages and prioritize original captions
        const groups: { [key: string]: MediaItem[] } = {};
        data?.forEach((message) => {
          const groupKey = message.media_group_id || message.id;
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(message as MediaItem);
        });

        // Sort messages within groups
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

    // Set up real-time subscription
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