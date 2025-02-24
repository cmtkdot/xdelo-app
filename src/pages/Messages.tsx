
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MessageListContainer } from '@/components/Messages/MessageListContainer';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MessagesPage() {
  const { error } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            Failed to load messages. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}

      <MessageListContainer />
    </div>
  );
}
