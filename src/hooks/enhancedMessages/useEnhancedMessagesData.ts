import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';

export interface UseEnhancedMessagesDataOptions {
  limit?: number;
  processingStates?: ProcessingState[];
  searchTerm?: string;
  sortBy?: 'created_at' | 'updated_at' | 'purchase_date';
  sortOrder?: 'asc' | 'desc';
  grouped?: boolean;
}

export function useEnhancedMessagesData({
  limit = 500,
  processingStates = [],
  searchTerm = '',
  sortBy = 'created_at',
  sortOrder = 'desc',
  grouped = true,
}: UseEnhancedMessagesDataOptions = {}) {
  
  return useQuery({
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
        console.error('Error in useEnhancedMessagesData hook:', err);
        throw err;
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}
