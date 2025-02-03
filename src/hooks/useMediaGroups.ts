import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { useToast } from "@/components/ui/use-toast";

export const useMediaGroups = (currentPage: number, filters: FilterValues) => {
  const [mediaGroups, setMediaGroups] = useState<Record<string, MediaItem[]>>({});
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMediaGroups = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-media-groups', {
          body: { page: currentPage, filters }
        });

        if (error) throw error;

        setMediaGroups(data.mediaGroups);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.error("Error fetching media groups:", error);
        toast({
          title: "Error",
          description: "Failed to load media groups. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchMediaGroups();

    // Subscribe to ALL changes on the messages table
    const channel = supabase
      .channel("media-groups-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Received real-time update:", payload);
          // Fetch fresh data to ensure we have the latest state
          fetchMediaGroups();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, currentPage, filters]);

  return { mediaGroups, totalPages };
};