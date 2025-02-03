import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { useToast } from "@/components/ui/use-toast";

interface MessageListProps {
  onMessageSelect: (message: MediaItem) => void;
}

export const MessageList = ({ onMessageSelect }: MessageListProps) => {
  const [deleteMessage, setDeleteMessage] = useState<MediaItem | null>(null);
  const { toast } = useToast();
  
  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages_parsed')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MediaItem[];
    },
  });

  const handleDelete = async (deleteTelegram: boolean) => {
    if (!deleteMessage) return;

    try {
      if (deleteTelegram) {
        await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: deleteMessage.telegram_message_id,
            chat_id: deleteMessage.chat_id,
          },
        });
      }

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', deleteMessage.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    } finally {
      setDeleteMessage(null);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  // Group messages by media_group_id
  const groupedMessages = messages?.reduce((acc, message) => {
    const groupId = message.media_group_id || message.id;
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(message);
    return acc;
  }, {} as Record<string, MediaItem[]>) || {};

  return (
    <ScrollArea className="h-[600px] rounded-md border p-4">
      <div className="space-y-4">
        {Object.entries(groupedMessages).map(([groupId, groupMessages]) => {
          const mainMessage = groupMessages.find(m => m.is_original_caption) || groupMessages[0];
          
          return (
            <Card
              key={groupId}
              className="p-4"
            >
              <div className="flex items-start gap-4">
                {mainMessage.public_url && (
                  <img
                    src={mainMessage.public_url}
                    alt="Media thumbnail"
                    className="w-20 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-medium">
                    {mainMessage.analyzed_content?.product_name || 'Untitled'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {mainMessage.caption || 'No caption'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(mainMessage.created_at || '').toLocaleString()}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMessageSelect(mainMessage)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteMessage(mainMessage)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <DeleteConfirmDialog
        open={!!deleteMessage}
        onOpenChange={(open) => !open && setDeleteMessage(null)}
        onConfirm={handleDelete}
      />
    </ScrollArea>
  );
};