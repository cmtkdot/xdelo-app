import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';

export interface UseEnhancedMessagesOptions {
  limit?: number;
  processingStates?: ProcessingState[];
  searchTerm?: string;
  sortBy?: 'created_at' | 'updated_at' | 'purchase_date';
  sortOrder?: 'asc' | 'desc';
  grouped?: boolean; // Whether to return messages grouped by media_group_id
  enableRealtime?: boolean;
}

export function useEnhancedMessages({
  limit = 500,
  processingStates = [],
  searchTerm = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
  grouped = true, // Default to grouped for better compatibility
  enableRealtime = true
}: UseEnhancedMessagesOptions = {}) {
  const queryClient = useQueryClient();
  const [realtimeEnabled, setRealtimeEnabled] = useState(enableRealtime);
  
  // Set up Supabase realtime subscription
  useEffect(() => {
    if (!realtimeEnabled) return;
    
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['enhanced-messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, realtimeEnabled]);

  const { 
    data: messages,
    isLoading,
    isRefetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['enhanced-messages', limit, processingStates, sortBy, sortOrder, searchTerm, grouped],
    queryFn: async () => {
      try {
        console.log('Fetching enhanced messages with options:', {
          limit, processingStates, sortBy, sortOrder, searchTerm, grouped
        });
        
        // Build the query
        let query = supabase
          .from('v_messages_compatibility')
          .select('*')
          .order(sortBy, { ascending: sortOrder === 'asc' })
          .limit(limit);
        
        // Add processing state filter if specified
        if (processingStates && processingStates.length > 0) {
          query = query.in('processing_state', processingStates);
        }
        
        // Add search filter if provided
        if (searchTerm) {
          query = query.or(`caption.ilike.%${searchTerm}%,analyzed_content->product_name.ilike.%${searchTerm}%`);
        }
        
        // Execute the query
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching messages:', error);
          throw error;
        }
        
        // Early return for empty data
        if (!data || data.length === 0) {
          console.log('No messages found');
          return {
            flatMessages: [],
            groupedMessages: []
          };
        }
        
        console.log(`Retrieved ${data.length} messages from database`);
        
        // Map the data to ensure required fields have values
        const validMessages: Message[] = data.map((rawMessage: any): Message => ({
          id: rawMessage.id || `missing-id-${Date.now()}-${Math.random().toString(36).substring(2)}`,
          file_unique_id: rawMessage.file_unique_id || `missing-file-id-${Date.now()}`,
          public_url: rawMessage.public_url || '/placeholder.svg',
          ...rawMessage
        }));
        
        // Process grouped messages if requested
        if (grouped) {
          const mediaGroups: Record<string, Message[]> = {};
          
          validMessages.forEach((message) => {
            // Use media_group_id if available, otherwise create a single-message group
            const groupId = message.media_group_id || `single-${message.id}`;
            
            if (!mediaGroups[groupId]) {
              mediaGroups[groupId] = [];
            }
            
            mediaGroups[groupId].push(message);
          });
          
          console.log(`Created ${Object.keys(mediaGroups).length} media groups`);
          
          // Sort messages within each group
          Object.values(mediaGroups).forEach(group => {
            group.sort((a, b) => {
              // If we have telegram_message_id, sort by that
              if (a.telegram_message_id && b.telegram_message_id) {
                return a.telegram_message_id - b.telegram_message_id;
              }
              
              // Otherwise sort by created_at
              const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
              const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
              return dateA - dateB;
            });
          });
          
          // Convert to array of arrays for component consumption
          const groupedMessagesArray = Object.values(mediaGroups);
          
          return {
            flatMessages: validMessages,
            groupedMessages: groupedMessagesArray
          };
        }
        
        // Return ungrouped data
        return {
          flatMessages: validMessages,
          groupedMessages: validMessages.map(msg => [msg]) // Create single-item groups for compatibility
        };
        
      } catch (err) {
        console.error('Error in useEnhancedMessages hook:', err);
        throw err;
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Provide a toggle for realtime updates
  const toggleRealtime = () => {
    setRealtimeEnabled(prev => !prev);
  };
  
  return {
    messages: messages?.flatMessages || [],
    groupedMessages: messages?.groupedMessages || [],
    isLoading,
    isRefetching,
    error,
    refetch,
    realtimeEnabled,
    toggleRealtime
  };
}
