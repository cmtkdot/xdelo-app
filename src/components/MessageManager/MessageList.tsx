import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

interface MessageListProps {
  onMessageSelect: (message: MediaItem) => void;
}

export const MessageList = ({ onMessageSelect }: MessageListProps) => {
  const [deleteMessage, setDeleteMessage] = useState<MediaItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      // First, get all unique media group IDs
      const { data: groupIds, error: groupError } = await supabase
        .from('messages_parsed')
        .select('media_group_id')
        .is('is_original_caption', true)
        .order('created_at', { ascending: false });

      if (groupError) throw groupError;

      // Then get all messages for these groups
      const mediaGroupIds = groupIds
        .map(g => g.media_group_id)
        .filter(Boolean) as string[];

      if (mediaGroupIds.length === 0) return [];

      const { data, error } = await supabase
        .from('messages_parsed')
        .select('*')
        .in('media_group_id', mediaGroupIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MediaItem[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages when there's a change
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleDelete = async (deleteTelegram: boolean) => {
    if (!deleteMessage) return;

    try {
      if (deleteTelegram) {
        const { error: webhookError } = await supabase.functions.invoke('delete-telegram-message', {
          body: { 
            message_id: deleteMessage.telegram_message_id,
            chat_id: deleteMessage.chat_id 
          }
        });

        if (webhookError) throw webhookError;
      }

      const { error: dbError } = await supabase
        .from('messages')
        .delete()
        .eq('media_group_id', deleteMessage.media_group_id);

      if (dbError) throw dbError;

      setDeleteMessage(null);
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
      
      // Invalidate the query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  // Group messages by media_group_id
  const groupedMessages = messages?.reduce((acc, message) => {
    if (!message.media_group_id) return acc;
    
    if (!acc[message.media_group_id]) {
      acc[message.media_group_id] = [];
    }
    acc[message.media_group_id].push(message);
    return acc;
  }, {} as Record<string, MediaItem[]>) || {};

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <ScrollArea className="h-[600px] rounded-md border p-4">
        {Object.entries(groupedMessages).map(([groupId, groupMessages]) => {
          const mainMessage = groupMessages.find(m => m.is_original_caption) || groupMessages[0];
          return (
            <Card key={groupId} className="p-4 mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">
                    {mainMessage.analyzed_content?.product_name || 'Untitled Product'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {mainMessage.caption || 'No caption'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Group ID: {groupId} ({groupMessages.length} items)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMessageSelect(mainMessage)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteMessage(mainMessage)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </ScrollArea>

      <DeleteConfirmDialog
        isOpen={!!deleteMessage}
        onClose={() => setDeleteMessage(null)}
        onConfirm={handleDelete}
      />
    </>
  );
};