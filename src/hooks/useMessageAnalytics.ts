
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DbMessage, ProcessingState } from '@/types/GlobalTypes';

interface AnalyticsData {
  totalMessages: number;
  messagesWithCaption: number;
  messagesWithProduct: number;
  pendingMessages: number;
  processingMessages: number;
  errorMessages: number;
  completedMessages: number;
  messagesWithProductName: number;
  messagesWithVendorUid: number;
  messagesWithPurchaseDate: number;
  matchedProducts: number;
  unmatchedProducts: number;
  latestMessages: DbMessage[];
  messagesByState: Record<ProcessingState, number>;
  messagesWithImagesByState: Record<ProcessingState, number>;
}

export function useMessageAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    totalMessages: 0,
    messagesWithCaption: 0,
    messagesWithProduct: 0,
    pendingMessages: 0,
    processingMessages: 0,
    errorMessages: 0,
    completedMessages: 0,
    messagesWithProductName: 0,
    messagesWithVendorUid: 0,
    messagesWithPurchaseDate: 0,
    matchedProducts: 0,
    unmatchedProducts: 0,
    latestMessages: [],
    messagesByState: {
      initialized: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0
    },
    messagesWithImagesByState: {
      initialized: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get total message count
      const { count: totalCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      if (countError) throw new Error(countError.message);

      // Get messages with caption
      const { count: captionCount, error: captionError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .not('caption', 'is', null);

      if (captionError) throw new Error(captionError.message);

      // Get counts by processing state
      const { data: stateCountsData, error: stateError } = await supabase
        .from('messages')
        .select('processing_state, count')
        .group('processing_state');

      if (stateError) throw new Error(stateError.message);

      // Get messages with product information
      const { count: productCount, error: productError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .not('analyzed_content->product_name', 'is', null);

      if (productError) throw new Error(productError.message);

      // Get messages with vendor UID
      const { count: vendorCount, error: vendorError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .not('analyzed_content->vendor_uid', 'is', null);

      if (vendorError) throw new Error(vendorError.message);

      // Get messages with purchase date
      const { count: dateCount, error: dateError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .not('analyzed_content->purchase_date', 'is', null);

      if (dateError) throw new Error(dateError.message);

      // Get matched and unmatched products
      const { count: matchedCount, error: matchedError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .not('glide_row_id', 'is', null);

      if (matchedError) throw new Error(matchedError.message);

      // Get latest messages for preview
      const { data: latestMessages, error: latestError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (latestError) throw new Error(latestError.message);

      // Process the state counts
      const messagesByState: Record<ProcessingState, number> = {
        initialized: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        error: 0
      };

      // Process state counts safely with valid state values only
      stateCountsData?.forEach((item) => {
        const state = item.processing_state as string;
        // Only add counts for valid ProcessingState values
        if (state in messagesByState) {
          const count = typeof item.count === 'number' ? item.count : parseInt(String(item.count), 10);
          messagesByState[state as ProcessingState] = count;
        }
      });

      // Populate analytics data
      setData({
        totalMessages: totalCount || 0,
        messagesWithCaption: captionCount || 0,
        messagesWithProduct: productCount || 0,
        pendingMessages: messagesByState.pending || 0,
        processingMessages: messagesByState.processing || 0,
        errorMessages: messagesByState.error || 0,
        completedMessages: messagesByState.completed || 0,
        messagesWithProductName: productCount || 0,
        messagesWithVendorUid: vendorCount || 0,
        messagesWithPurchaseDate: dateCount || 0,
        matchedProducts: matchedCount || 0,
        unmatchedProducts: (productCount || 0) - (matchedCount || 0),
        latestMessages: latestMessages || [],
        messagesByState,
        // This is a simplification - in a real app you'd have a separate query
        messagesWithImagesByState: { ...messagesByState }
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    error,
    refresh: fetchAnalytics
  };
}
