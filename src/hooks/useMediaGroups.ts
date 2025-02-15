import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, MediaItem } from "@/types";
import { useEffect } from "react";

interface MediaGroupsResponse {
  mediaGroups: { [key: string]: MediaItem[] };
  totalPages: number;
}

export const useMediaGroups = (page: number, filters: FilterValues, itemsPerPage: number = 12) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to all changes in the messages table
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Invalidate the query to trigger a refetch
          queryClient.invalidateQueries({
            queryKey: ['mediaGroups', page, filters, itemsPerPage]
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, filters, itemsPerPage, queryClient]);

  return useQuery<MediaGroupsResponse, Error>({
    queryKey: ['mediaGroups', page, filters, itemsPerPage],
    queryFn: async () => {
      console.log('Fetching media groups with filters:', filters);
      
      const { data, error } = await supabase.functions.invoke<MediaGroupsResponse>('fetch-media-groups', {
        body: {
          page,
          filters: {
            ...filters,
            dateField: filters.dateField || 'purchase_date',
            sortOrder: filters.sortOrder || 'desc',
            sortBy: filters.sortBy || 'date',
            hasGlideMatch: filters.hasGlideMatch,
            chatId: filters.chatId,
            nullsLast: true,
          },
          itemsPerPage,
        },
      });

      if (error) {
        console.error('Error fetching media groups:', error);
        throw error;
      }

      if (!data) {
        return { mediaGroups: {}, totalPages: 0 };
      }

      console.log('Received media groups data:', data);
      return data;
    },
    staleTime: 1000 * 60,
    refetchOnWindowFocus: true,
  });
};
