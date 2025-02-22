import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Card } from "@/components/ui/card";
import { Message } from "@/types";

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
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          telegram_message_id,
          chat_id,
          chat_type,
          chat_title,
          media_group_id,
          caption,
          file_id,
          file_unique_id,
          public_url,
          mime_type,
          file_size,
          width,
          height,
          duration,
          is_edited,
          edit_date,
          processing_state,
          processing_started_at,
          processing_completed_at,
          analyzed_content,
          error_message,
          created_at,
          updated_at,
          message_url,
          group_caption_synced,
          retry_count,
          last_error_at
        `)
        .not('analyzed_content', 'is', null)
        .gt('caption', '')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as Message[];
    }
  });

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
      <MessagesTable messages={messages || []} />
    </div>
  );
};

export default MediaTable;
