
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Card } from "@/components/ui/card";
import { useEnhancedMessages } from "@/hooks/useEnhancedMessages";

const MediaTable = () => {
  const queryClient = useQueryClient();

  // Set up realtime subscription using channel
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['enhanced-messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  // Use the new hook with filter for messages with analyzed_content and caption
  const { messages, isLoading } = useEnhancedMessages({
    limit: 100,
    enableRealtime: true,
    grouped: false // We want a flat list for the table
  });

  // Filter for messages with analyzed content and non-empty caption
  const filteredMessages = messages.filter(msg => 
    msg.analyzed_content && 
    msg.caption && 
    msg.caption.trim() !== ''
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card className="p-4">
          <div className="h-8 w-full animate-pulse bg-muted rounded" />
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Media Table</h1>
      <MessagesTable messages={filteredMessages} />
    </div>
  );
};

export default MediaTable;
