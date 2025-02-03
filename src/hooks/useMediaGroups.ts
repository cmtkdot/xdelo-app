import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, MediaItem } from "@/types";

export const useMediaGroups = (page: number, filters: FilterValues) => {
  return useQuery({
    queryKey: ['mediaGroups', page, filters],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        mediaGroups: { [key: string]: MediaItem[] };
        totalPages: number;
      }>('fetch-media-groups', {
        body: {
          page,
          filters: {
            ...filters,
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString(),
          },
        },
      });

      if (error) {
        console.error('Error fetching media groups:', error);
        throw error;
      }

      return data;
    },
  });
};