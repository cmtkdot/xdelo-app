
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';
import { format, subDays, subWeeks, subMonths, parseISO } from 'date-fns';

interface MessageStatistics {
  totalMessages: number;
  mediaTypes: {
    images: number;
    videos: number;
    documents: number;
    other: number;
  };
  processingStates: {
    completed: number;
    error: number;
    processing: number;
    pending: number;
    initialized: number;
  };
  mediaGroups: {
    total: number;
    averageSize: number;
    maxSize: number;
  };
  vendorStats: {
    totalVendors: number;
    topVendors: Array<{ name: string; count: number }>;
  };
  timePeriods: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    older: number;
  };
}

export function useMessageAnalytics() {
  return useQuery({
    queryKey: ['message-analytics'],
    queryFn: async (): Promise<MessageStatistics> => {
      // Fetch messages for analysis
      const { data: messages, error } = await supabase
        .from('v_messages_compatibility')
        .select('*');
        
      if (error) throw error;
      
      // Initialize stats object
      const stats: MessageStatistics = {
        totalMessages: 0,
        mediaTypes: { images: 0, videos: 0, documents: 0, other: 0 },
        processingStates: { 
          completed: 0, 
          error: 0, 
          processing: 0, 
          pending: 0, 
          initialized: 0 
        },
        mediaGroups: { total: 0, averageSize: 0, maxSize: 0 },
        vendorStats: { totalVendors: 0, topVendors: [] },
        timePeriods: { today: 0, thisWeek: 0, thisMonth: 0, older: 0 }
      };
      
      if (!messages || !Array.isArray(messages)) {
        return stats;
      }
      
      // Set total messages
      stats.totalMessages = messages.length;
      
      // For time calculations
      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');
      const oneWeekAgo = subWeeks(now, 1);
      const oneMonthAgo = subMonths(now, 1);
      
      // Media group tracking
      const mediaGroups = new Map<string, Message[]>();
      
      // Vendor tracking
      const vendors = new Map<string, number>();
      
      // Process each message
      messages.forEach((message: Message) => {
        // Media type stats
        if (message.mime_type) {
          if (message.mime_type.startsWith('image/')) {
            stats.mediaTypes.images++;
          } else if (message.mime_type.startsWith('video/')) {
            stats.mediaTypes.videos++;
          } else if (message.mime_type.startsWith('application/')) {
            stats.mediaTypes.documents++;
          } else {
            stats.mediaTypes.other++;
          }
        } else {
          stats.mediaTypes.other++;
        }
        
        // Processing state stats
        if (message.processing_state) {
          const state = message.processing_state as ProcessingState;
          stats.processingStates[state]++;
        }
        
        // Media group stats
        if (message.media_group_id) {
          const group = mediaGroups.get(message.media_group_id) || [];
          group.push(message);
          mediaGroups.set(message.media_group_id, group);
        }
        
        // Vendor stats
        if (message.analyzed_content?.vendor_uid) {
          const vendor = message.analyzed_content.vendor_uid;
          vendors.set(vendor, (vendors.get(vendor) || 0) + 1);
        }
        
        // Time period stats
        if (message.created_at) {
          const createdDate = new Date(message.created_at);
          const createdDateStr = format(createdDate, 'yyyy-MM-dd');
          
          if (createdDateStr === today) {
            stats.timePeriods.today++;
          }
          
          if (createdDate >= oneWeekAgo) {
            stats.timePeriods.thisWeek++;
          } else if (createdDate >= oneMonthAgo) {
            stats.timePeriods.thisMonth++;
          } else {
            stats.timePeriods.older++;
          }
        }
      });
      
      // Process media group stats
      stats.mediaGroups.total = mediaGroups.size;
      
      let totalGroupSize = 0;
      let maxGroupSize = 0;
      
      mediaGroups.forEach(group => {
        const size = group.length;
        totalGroupSize += size;
        maxGroupSize = Math.max(maxGroupSize, size);
      });
      
      stats.mediaGroups.averageSize = mediaGroups.size > 0 
        ? Math.round((totalGroupSize / mediaGroups.size) * 10) / 10 
        : 0;
      stats.mediaGroups.maxSize = maxGroupSize;
      
      // Process vendor stats
      stats.vendorStats.totalVendors = vendors.size;
      
      // Convert vendor map to array and sort by count (highest first)
      stats.vendorStats.topVendors = Array.from(vendors.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      return stats;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
