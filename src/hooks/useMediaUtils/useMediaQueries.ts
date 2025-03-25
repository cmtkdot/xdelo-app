
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types/entities/Message';

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
    
    return await query;
  };

  /**
   * Get a specific message by ID
   */
  const getMessageById = async (id: string): Promise<{
    data: Message | null;
    error: any;
  }> => {
    return await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();
  };

  /**
   * Update a message with new data
   */
  const updateMessage = async (
    id: string,
    data: Partial<Message>
  ): Promise<{
    data: any;
    error: any;
  }> => {
    const result = await supabase
      .from('messages')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (!result.error) {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['message', id] });
    }
    
    return result;
  };

  return {
    getMessages,
    getMessageById,
    updateMessage
  };
}
