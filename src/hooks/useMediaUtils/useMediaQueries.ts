
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
      
      // Execute the query
      const response = await query;
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      // Process data to ensure it conforms to the Message type
      const messagesData = response.data as any[];
      
      // Transform data to match Message interface
      const typedMessages = messagesData.map((item) => {
        // Ensure is_bot is boolean
        if (typeof item.is_bot === 'string') {
          item.is_bot = item.is_bot === 'true';
        }
        
        // Extract common fields from analyzed_content if available
        if (item.analyzed_content) {
          item.product_name = item.analyzed_content.product_name || item.product_name;
          item.product_code = item.analyzed_content.product_code || item.product_code;
          item.vendor_uid = item.analyzed_content.vendor_uid || item.vendor_uid;
          item.purchase_date = item.analyzed_content.purchase_date || item.purchase_date;
          item.product_quantity = item.analyzed_content.quantity || item.product_quantity;
        }
        
        return item as Message;
      });
      
      return { data: typedMessages, error: null };
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
      
      if (response.error) {
        return { data: null, error: response.error };
      }
      
      // Process data to ensure it conforms to the Message type
      const messageData = response.data as any;
      
      // Ensure is_bot is boolean
      if (typeof messageData.is_bot === 'string') {
        messageData.is_bot = messageData.is_bot === 'true';
      }
      
      // Extract common fields from analyzed_content if available
      if (messageData.analyzed_content) {
        messageData.product_name = messageData.analyzed_content.product_name || messageData.product_name;
        messageData.product_code = messageData.analyzed_content.product_code || messageData.product_code;
        messageData.vendor_uid = messageData.analyzed_content.vendor_uid || messageData.vendor_uid;
        messageData.purchase_date = messageData.analyzed_content.purchase_date || messageData.purchase_date;
        messageData.product_quantity = messageData.analyzed_content.quantity || messageData.product_quantity;
      }
      
      return { data: messageData as Message, error: null };
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
