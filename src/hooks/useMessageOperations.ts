import { useState } from 'react';
import { useSupabaseClient, useSession } from '@supabase/auth-helpers-react';
import { useToast } from '@/hooks/useToast';
import { useRouter } from 'next/router';
import { logEvent, LogEventType } from "@/lib/logUtils";

export function useMessageOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useSupabaseClient();
  const { toast } = useToast();
  const router = useRouter();
  const { session, auth } = useSession();

  // Function to handle message updates
  const updateMessage = async (messageId: string, updates: any) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .update(updates)
        .eq('id', messageId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Message updated',
        description: 'The message has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Failed to update message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a message
  const deleteMessage = async (messageId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        throw error;
      }

      toast({
        title: 'Message deleted',
        description: 'The message has been deleted successfully.',
      });

      router.push('/');
    } catch (error) {
      toast({
        title: 'Failed to delete message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Log user actions
  const logUserAction = async (messageId: string, action: string, details?: any) => {
    try {
      await logEvent(
        LogEventType.USER_ACTION,
        messageId,
        {
          action,
          user_id: auth?.user?.id,
          timestamp: new Date().toISOString(),
          ...details
        }
      );
    } catch (error) {
      console.error("Error logging user action:", error);
    }
  };

  // Function to reprocess a message
  const reprocessMessage = async (messageId: string) => {
    setIsLoading(true);
    try {
      // Call the function to reprocess the message
      const { error } = await supabase.functions.invoke('xdelo_process_message', {
        body: {
          message_id: messageId,
          force_reprocess: true
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Message reprocessing initiated',
        description: 'The message will be reprocessed shortly.',
      });
    } catch (error) {
      toast({
        title: 'Failed to reprocess message',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    updateMessage,
    deleteMessage,
    reprocessMessage,
    logUserAction
  };
}
