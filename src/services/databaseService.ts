
import { supabase } from '@/integrations/supabase/client';
import { executeWithTimeout, retryOperation } from '@/utils/databaseUtils';
import { Message } from '@/types/entities/Message';

/**
 * Message service for handling database operations related to messages
 */
export const messageService = {
  /**
   * Get messages with pagination and filtering
   */
  getMessages: async (options: {
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
    orderBy?: string;
    ascending?: boolean;
  } = {}) => {
    const { 
      limit = 50, 
      offset = 0, 
      filters = {}, 
      orderBy = 'created_at',
      ascending = false 
    } = options;
    
    return executeWithTimeout(
      async () => {
        let query = supabase
          .from('messages')
          .select('*')
          .order(orderBy, { ascending })
          .limit(limit)
          .range(offset, offset + limit - 1);
        
        // Apply filters
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
      },
      { operationName: 'Get messages', timeoutMs: 10000 }
    );
  },
  
  /**
   * Get a single message by ID
   */
  getMessageById: async (id: string) => {
    return retryOperation(async () => {
      const response = await supabase
        .from('messages')
        .select('*')
        .eq('id', id)
        .single();
        
      return {
        data: response.data as unknown as Message | null,
        error: response.error
      };
    });
  },
  
  /**
   * Update a message
   */
  updateMessage: async (id: string, updates: Partial<Message>) => {
    return executeWithTimeout(
      async () => {
        // Convert to a plain object
        const updateData = JSON.parse(JSON.stringify(updates));
        
        return await supabase
          .from('messages')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
      },
      { operationName: 'Update message' }
    );
  },
  
  /**
   * Delete a message
   */
  deleteMessage: async (id: string) => {
    return executeWithTimeout(
      async () => {
        return await supabase
          .from('messages')
          .delete()
          .eq('id', id);
      },
      { operationName: 'Delete message' }
    );
  }
};
