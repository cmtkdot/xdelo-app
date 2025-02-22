
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageList } from './MessageList';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const MessageListContainer: React.FC = () => {
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading messages: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No messages found.
        </AlertDescription>
      </Alert>
    );
  }

  return <MessageList messages={messages} />;
};
