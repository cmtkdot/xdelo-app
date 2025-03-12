
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types/MessagesTypes';

export function useContentDisposition() {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  /**
   * Fix the content disposition for a specific message
   */
  const fixContentDisposition = async (message: Message, disposition?: 'inline' | 'attachment') => {
    if (!message?.id || isProcessing[message.id]) return;
    
    try {
      setIsProcessing(prev => ({ ...prev, [message.id]: true }));
      setErrors(prev => ({ ...prev, [message.id]: '' }));
      
      console.log(`Fixing content disposition for message ${message.id}`, {
        messageId: message.id,
        file_unique_id: message.file_unique_id,
        current_disposition: message.content_disposition,
        requested_disposition: disposition,
      });
      
      // Call the edge function to fix content disposition
      const { data, error } = await supabase.functions.invoke(
        'xdelo_fix_content_disposition',
        {
          body: {
            messageId: message.id,
            contentDisposition: disposition // if undefined, the function will use the recommended value
          }
        }
      );
      
      if (error) {
        throw new Error(`Failed to fix content disposition: ${error.message}`);
      }
      
      console.log('Content disposition fix result:', data);
      
      toast({
        title: "Media Display Fixed",
        description: `Content disposition set to ${data.content_disposition}`,
      });
      
      return data;
      
    } catch (error: any) {
      console.error('Error fixing content disposition:', error);
      
      const errorMessage = error.message || 'Failed to fix content disposition';
      setErrors(prev => ({ ...prev, [message.id]: errorMessage }));
      
      toast({
        title: "Fix Failed",
        description: errorMessage,
        variant: "destructive"
      });
      
    } finally {
      setIsProcessing(prev => ({ ...prev, [message.id]: false }));
    }
  };

  /**
   * Fix content disposition for multiple messages
   */
  const fixContentDispositionBatch = async (messages: Message[], disposition?: 'inline' | 'attachment') => {
    if (!messages.length) return;
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    for (const message of messages) {
      try {
        await fixContentDisposition(message, disposition);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(error.message || 'Unknown error');
      }
    }
    
    return results;
  };

  return {
    fixContentDisposition,
    fixContentDispositionBatch,
    isProcessing,
    errors
  };
}
