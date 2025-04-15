
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import type { Database } from '@/integrations/supabase/database.types';

// Define the analytics data type
export interface AnalyticsData {
  totalMessages: number;
  mediaTypes: {
    images: number;
    videos: number;
    documents: number;
    other: number;
  };
  processingStates: Record<string, number>;
  mediaGroups: {
    total: number;
    withCaption: number;
    withoutCaption: number;
  };
  vendorStats: {
    uniqueVendors: number;
    topVendors: Array<{ vendor: string; count: number }>;
  };
  timePeriods: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
  };
}

export const defaultAnalyticsData: AnalyticsData = {
  totalMessages: 0,
  mediaTypes: {
    images: 0,
    videos: 0,
    documents: 0,
    other: 0
  },
  processingStates: {},
  mediaGroups: {
    total: 0,
    withCaption: 0,
    withoutCaption: 0
  },
  vendorStats: {
    uniqueVendors: 0,
    topVendors: []
  },
  timePeriods: {
    today: 0,
    yesterday: 0,
    thisWeek: 0,
    thisMonth: 0
  }
};

type DbMessage = Database['public']['Tables']['messages']['Row'];

export function useMessageAnalytics() {
  const [data, setData] = useState<AnalyticsData>(defaultAnalyticsData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Get message counts
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*');
      
      if (messagesError) {
        throw messagesError;
      }
      
      if (!messagesData) {
        throw new Error('No data found');
      }
      
      // Process results
      const messages = messagesData as DbMessage[];
      const totalMessages = messages.length;
      
      // Initialize media types with zeros
      const mediaTypes = {
        images: 0,
        videos: 0,
        documents: 0,
        other: 0
      };
      
      // Process processing states
      const processingStates: Record<string, number> = {};
      
      // Process time periods
      const today = new Date();
      const yesterday = subDays(today, 1);
      const firstDayOfWeek = subDays(today, today.getDay());
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      
      let todayCount = 0;
      let yesterdayCount = 0;
      let thisWeekCount = 0;
      let thisMonthCount = 0;
      
      // Vendor stats
      const vendorCounts: Record<string, number> = {};
      let uniqueVendorCount = 0;
      
      // Media groups stats
      const mediaGroupsMap = new Map<string, boolean>();
      let withCaptionCount = 0;
      let withoutCaptionCount = 0;
      
      // Process all messages
      messages.forEach((message) => {
        // Media type counts
        const mediaType = message.mime_type || 'unknown';
        if (mediaType.startsWith('image/')) {
          mediaTypes.images++;
        } else if (mediaType.startsWith('video/')) {
          mediaTypes.videos++;
        } else if (mediaType.startsWith('application/')) {
          mediaTypes.documents++;
        } else {
          mediaTypes.other++;
        }
        
        // Processing state counts
        const state = message.processing_state || 'unknown';
        processingStates[String(state)] = (processingStates[String(state)] || 0) + 1;
        
        // Time period counts
        const createdAt = message.created_at ? new Date(message.created_at) : null;
        if (createdAt) {
          if (format(createdAt, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
            todayCount++;
          }
          if (format(createdAt, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
            yesterdayCount++;
          }
          if (createdAt >= firstDayOfWeek) {
            thisWeekCount++;
          }
          if (createdAt >= firstDayOfMonth) {
            thisMonthCount++;
          }
        }
        
        // Vendor stats 
        if (message.analyzed_content && typeof message.analyzed_content === 'object') {
          const analyzedContent = message.analyzed_content as Record<string, any>;
          const vendorUid = analyzedContent.vendor_uid;
          if (vendorUid && typeof vendorUid === 'string') {
            if (!vendorCounts[vendorUid]) {
              uniqueVendorCount++;
            }
            vendorCounts[vendorUid] = (vendorCounts[vendorUid] || 0) + 1;
          }
        }
        
        // Media groups
        if (message.media_group_id) {
          if (!mediaGroupsMap.has(message.media_group_id)) {
            mediaGroupsMap.set(message.media_group_id, !!message.caption);
            if (message.caption) {
              withCaptionCount++;
            } else {
              withoutCaptionCount++;
            }
          }
        }
      });
      
      // Sort vendors by count and get top 5
      const topVendors = Object.entries(vendorCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([vendor, count]) => ({ vendor, count }));
      
      setData({
        totalMessages,
        mediaTypes,
        processingStates,
        mediaGroups: {
          total: mediaGroupsMap.size,
          withCaption: withCaptionCount,
          withoutCaption: withoutCaptionCount
        },
        vendorStats: {
          uniqueVendors: uniqueVendorCount,
          topVendors
        },
        timePeriods: {
          today: todayCount,
          yesterday: yesterdayCount,
          thisWeek: thisWeekCount,
          thisMonth: thisMonthCount
        }
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Return the data with loading property 
  return {
    data,
    loading,
    error,
    refresh: fetchData
  };
}
