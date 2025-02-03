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
      const { data, error } = await supabase
        .from('messages_parsed')
        .select('*')
        .is('is_original_caption', true)
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <ScrollArea className="h-[600px] rounded-md border p-4">
        {messages?.map((message) => (
          <Card key={message.id} className="p-4 mb-4">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h3 className="font-semibold">
                  {message.analyzed_content?.product_name || 'Untitled Product'}
                </h3>
                <p className="text-sm text-gray-500">
                  {message.caption || 'No caption'}
                </p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Product Code: {message.analyzed_content?.product_code || 'N/A'}</p>
                  <p>Vendor: {message.analyzed_content?.vendor_uid || 'N/A'}</p>
                  <p>Quantity: {message.analyzed_content?.quantity || 'N/A'}</p>
                  <p>Purchase Date: {message.analyzed_content?.purchase_date || 'N/A'}</p>
                  <p>Notes: {message.analyzed_content?.notes || 'N/A'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMessageSelect(message)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteMessage(message)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </ScrollArea>

      <DeleteConfirmDialog
        open={!!deleteMessage}
        onOpenChange={(open) => !open && setDeleteMessage(null)}
        onConfirm={handleDelete}
      />
    </>
  );
};