
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types/entities/Message';
import { AnalyzedContent } from '@/types/utils/AnalyzedContent';

/**
 * Hook for message querying operations
 */
export function useMediaQueries() {
  const queryClient = useQueryClient();

  /**
   * Get messages with specified criteria
   */
  const getMessages = async (options: {
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
  } = {}): Promise<{
    data: Message[] | null;
    error: any;
  }> => {
    const { limit = 50, offset = 0, filters = {} } = options;
    
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);
      
      // Apply any filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
      
      const response = await query;
      
      return { 
        data: response.data as unknown as Message[] | null, 
        error: response.error 
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      return { data: null, error };
    }
  };

  /**
   * Get a specific message by ID
   */
  const getMessageById = async (id: string): Promise<{
    data: Message | null;
    error: any;
  }> => {
    try {
      const response = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .single();
      
      return { 
        data: response.data as unknown as Message | null, 
        error: response.error 
      };
    } catch (error) {
      console.error('Error fetching message by ID:', error);
      return { data: null, error };
    }
  };

  /**
   * Update a message with new data
   */
  const updateMessage = async (
    id: string,
    updates: Partial<Message>
  ): Promise<{
    data: any;
    error: any;
  }> => {
    try {
      // Convert to a plain object to avoid type issues
      const updateData = JSON.parse(JSON.stringify(updates)) as Record<string, any>;
      
      const result = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (!result.error) {
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        queryClient.invalidateQueries({ queryKey: ['message', id] });
      }
      
      return result;
    } catch (error) {
      console.error('Error updating message:', error);
      return { data: null, error };
    }
  };

  return {
    getMessages,
    getMessageById,
    updateMessage
  };
}
