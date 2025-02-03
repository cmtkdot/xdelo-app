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
        let originalCaptionsQuery = supabase
          .from("messages_parsed")
          .select("*", { count: "exact" })
          .eq('is_original_caption', true);

        // Apply filters
        if (filters.search) {
          originalCaptionsQuery = originalCaptionsQuery.or(`product_name.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
        }

        if (filters.vendor !== "all") {
          originalCaptionsQuery = originalCaptionsQuery.eq("vendor_uid", filters.vendor);
        }

        if (filters.productCode) {
          originalCaptionsQuery = originalCaptionsQuery.eq("product_code", filters.productCode);
        }

        if (filters.quantityRange && filters.quantityRange !== 'all') {
          if (filters.quantityRange === 'undefined') {
            originalCaptionsQuery = originalCaptionsQuery.is('quantity', null);
          } else if (filters.quantityRange === '21+') {
            originalCaptionsQuery = originalCaptionsQuery.gte('quantity', 21);
          } else {
            const [min, max] = filters.quantityRange.split('-').map(Number);
            originalCaptionsQuery = originalCaptionsQuery
              .gte('quantity', min)
              .lte('quantity', max);
          }
        }

        if (filters.processingState && filters.processingState !== 'all') {
          originalCaptionsQuery = originalCaptionsQuery.eq("processing_state", filters.processingState);
        }

        if (filters.dateFrom) {
          originalCaptionsQuery = originalCaptionsQuery.gte("purchase_date", filters.dateFrom.toISOString().split('T')[0]);
        }

        if (filters.dateTo) {
          originalCaptionsQuery = originalCaptionsQuery.lte("purchase_date", filters.dateTo.toISOString().split('T')[0]);
        }

        originalCaptionsQuery = originalCaptionsQuery
          .order("created_at", { ascending: filters.sortOrder === "asc" });

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        originalCaptionsQuery = originalCaptionsQuery.range(from, to);

        const { data: originalCaptions, count, error: originalCaptionsError } = await originalCaptionsQuery;

        if (originalCaptionsError) throw originalCaptionsError;

        // Get all media items for the filtered media groups
        const mediaGroupIds = originalCaptions?.map(msg => msg.media_group_id).filter(Boolean) || [];
        
        if (mediaGroupIds.length > 0) {
          const { data: allGroupMedia, error: groupMediaError } = await supabase
            .from("messages")
            .select("*")
            .in("media_group_id", mediaGroupIds);

          if (groupMediaError) throw groupMediaError;

          // Organize messages into groups
          const groups: { [key: string]: MediaItem[] } = {};
          allGroupMedia?.forEach((message) => {
            const groupKey = message.media_group_id || message.id;
            if (!groups[groupKey]) {
              groups[groupKey] = [];
            }
            groups[groupKey].push(message as MediaItem);
          });

          // Sort messages within each group
          Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
              if (a.is_original_caption && !b.is_original_caption) return -1;
              if (!a.is_original_caption && b.is_original_caption) return 1;
              return 0;
            });
          });

          setMediaGroups(groups);
        } else {
          setMediaGroups({});
        }

        const total = count || 0;
        setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));

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
