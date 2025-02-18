
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, MediaItem } from "@/types";
import { useEffect } from "react";

interface MediaGroupsResponse {
  mediaGroups: { [key: string]: MediaItem[] };
  totalPages: number;
}

export const useMediaGroups = (page: number, filters: FilterValues, itemsPerPage: number = 16) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          queryClient.invalidateQueries({
            queryKey: ['mediaGroups', page, filters, itemsPerPage]
          });
        }
      )
      .subscribe();

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
            sortOrder: filters.sortOrder || 'desc',
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
