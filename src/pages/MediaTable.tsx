import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnhancedMessages } from "@/hooks/useEnhancedMessages";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  const { messages, isLoading, error } = useEnhancedMessages({
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

  // Handle loading state with better skeleton UI
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold">Media Table</h1>
        <Card className="p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-10 w-[100px]" />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-8 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-12" />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-2xl font-bold">Media Table</h1>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load messages: {error.message || "Unknown error"}. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Media Table</h1>
        <div className="text-sm text-muted-foreground">
          Showing {filteredMessages.length} out of {messages.length} messages
        </div>
      </div>
      
      {filteredMessages.length > 0 ? (
        <MessagesTable messages={filteredMessages} />
      ) : (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">No messages with analyzed content found.</p>
          <p className="text-xs mt-2">Try uploading media with captions or analyzing existing media.</p>
        </Card>
      )}
    </div>
  );
};

export default MediaTable;
