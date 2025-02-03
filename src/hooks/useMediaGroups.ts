import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues, Json } from "@/types";
import { useToast } from "@/components/ui/use-toast";

export const useMediaGroups = (currentPage: number, filters: FilterValues) => {
  const [mediaGroups, setMediaGroups] = useState<Record<string, MediaItem[]>>({});
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const ITEMS_PER_PAGE = 16;

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        // First, check for any initialized messages that need syncing
        const { data: initializedMessages, error: initError } = await supabase
          .from("messages")
          .select("*")
          .eq("processing_state", "initialized")
          .eq("group_caption_synced", false);

        if (initError) throw initError;

        // Sync initialized messages if they belong to a group with analyzed content
        if (initializedMessages?.length) {
          for (const msg of initializedMessages) {
            if (msg.media_group_id) {
              const { data: groupMessages } = await supabase
                .from("messages")
                .select("*")
                .eq("media_group_id", msg.media_group_id)
                .eq("processing_state", "completed")
                .order("created_at", { ascending: true })
                .limit(1);

              if (groupMessages?.[0]?.analyzed_content) {
                const syncDetails = {
                  sync_type: "auto_group_sync",
                  source_message_id: groupMessages[0].id,
                  group_message_count: msg.group_message_count,
                  sync_timestamp: new Date().toISOString()
                };

                // Log sync attempt to audit log
                await supabase.from("analysis_audit_log").insert({
                  message_id: msg.id,
                  media_group_id: msg.media_group_id,
                  event_type: "GROUP_SYNC_INITIATED",
                  old_state: "initialized",
                  new_state: "completed",
                  analyzed_content: groupMessages[0].analyzed_content as Json,
                  processing_details: syncDetails as Json
                });

                // Update the message with synced content
                const { error: updateError } = await supabase
                  .from("messages")
                  .update({
                    analyzed_content: groupMessages[0].analyzed_content,
                    processing_state: "completed",
                    group_caption_synced: true,
                    message_caption_id: groupMessages[0].id,
                    processing_completed_at: new Date().toISOString()
                  })
                  .eq("id", msg.id);

                if (updateError) {
                  // Log sync failure
                  await supabase.from("analysis_audit_log").insert({
                    message_id: msg.id,
                    media_group_id: msg.media_group_id,
                    event_type: "GROUP_SYNC_FAILED",
                    old_state: "initialized",
                    error_message: updateError.message,
                    processing_details: { 
                      error: updateError.message,
                      sync_attempt: syncDetails 
                    } as Json
                  });
                } else {
                  // Log successful sync
                  await supabase.from("analysis_audit_log").insert({
                    message_id: msg.id,
                    media_group_id: msg.media_group_id,
                    event_type: "GROUP_SYNC_COMPLETED",
                    old_state: "initialized",
                    new_state: "completed",
                    analyzed_content: groupMessages[0].analyzed_content as Json,
                    processing_details: syncDetails as Json
                  });
                }
              }
            }
          }
        }

        // Now fetch messages for display
        let query = supabase
          .from("messages")
          .select("*", { count: "exact" })
          .eq('is_original_caption', true);

        if (filters.search) {
          query = query.or(`analyzed_content->product_name.ilike.%${filters.search}%,analyzed_content->notes.ilike.%${filters.search}%`);
        }

        if (filters.vendor !== "all") {
          query = query.eq("analyzed_content->vendor_uid", filters.vendor);
        }

        if (filters.productCode && filters.productCode !== 'all') {
          query = query.eq("analyzed_content->product_code", filters.productCode);
        }

        if (filters.quantityRange && filters.quantityRange !== 'all') {
          if (filters.quantityRange === 'undefined') {
            query = query.is('analyzed_content->quantity', null);
          } else if (filters.quantityRange === '21+') {
            query = query.gte('analyzed_content->quantity', 21);
          } else {
            const [min, max] = filters.quantityRange.split('-').map(Number);
            query = query
              .gte('analyzed_content->quantity', min)
              .lte('analyzed_content->quantity', max);
          }
        }

        if (filters.processingState && filters.processingState !== 'all') {
          query = query.eq("processing_state", filters.processingState);
        }

        if (filters.dateFrom) {
          query = query.gte("analyzed_content->purchase_date", filters.dateFrom.toISOString().split('T')[0]);
        }

        if (filters.dateTo) {
          query = query.lte("analyzed_content->purchase_date", filters.dateTo.toISOString().split('T')[0]);
        }

        query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data: originalMessages, count, error: originalMessagesError } = await query;

        if (originalMessagesError) throw originalMessagesError;

        const mediaGroupIds = originalMessages?.map(msg => msg.media_group_id).filter(Boolean) || [];
        
        if (mediaGroupIds.length > 0) {
          const { data: allGroupMedia, error: groupMediaError } = await supabase
            .from("messages")
            .select("*")
            .in("media_group_id", mediaGroupIds);

          if (groupMediaError) throw groupMediaError;

          const groups: Record<string, MediaItem[]> = {};
          
          if (allGroupMedia) {
            allGroupMedia.forEach((message) => {
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
          }

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