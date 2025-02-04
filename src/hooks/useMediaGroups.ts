import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, MediaItem } from "@/types";

interface MediaGroupsResponse {
  mediaGroups: { [key: string]: MediaItem[] };
  totalPages: number;
}

export const useMediaGroups = (page: number, filters: FilterValues) => {
  return useQuery<MediaGroupsResponse, Error>({
    queryKey: ['mediaGroups', page, filters],
    queryFn: async () => {
      console.log('Fetching media groups with filters:', filters);
      
      const { data, error } = await supabase.functions.invoke<MediaGroupsResponse>('fetch-media-groups', {
        body: {
          page,
          filters: {
            ...filters,
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString(),
            dateField: filters.dateField || 'purchase_date',
            sortOrder: filters.sortOrder || 'desc',
            nullsLast: true, // This will ensure items without dates appear last
          },
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