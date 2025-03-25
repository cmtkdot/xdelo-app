
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Message } from '@/types/entities/Message';
import { Database } from '@/integrations/supabase/types';

type DbMessage = Database['public']['Tables']['messages']['Row'];

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
      
      const { data, error } = await query;
      
      // Convert the database response to Message type
      const typedData = data as unknown as Message[] | null;
      
      return { data: typedData, error };
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
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .single();
      
      // Convert the database response to Message type
      const typedData = data as unknown as Message | null;
      
      return { data: typedData, error };
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
    data: Partial<Message>
  ): Promise<{
    data: any;
    error: any;
  }> => {
    try {
      // Convert Message type to database type before updating
      const dbData = data as unknown as Partial<DbMessage>;
      
      const result = await supabase
        .from('messages')
        .update(dbData)
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
