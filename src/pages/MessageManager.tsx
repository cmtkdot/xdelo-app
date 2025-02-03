import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { MessageList } from "@/components/MessageManager/MessageList";
import { MessageEditor } from "@/components/MessageManager/MessageEditor";
import { MediaItem } from "@/types";

const MessageManager = () => {
  const [selectedMessage, setSelectedMessage] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const handleMessageSelect = (message: MediaItem) => {
    setSelectedMessage(message);
  };

  const handleMessageUpdate = async (updatedMessage: MediaItem) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          caption: updatedMessage.caption,
          analyzed_content: updatedMessage.analyzed_content
        })
        .eq('id', updatedMessage.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message updated successfully",
      });

      setSelectedMessage(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Message Manager</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessageList onMessageSelect={handleMessageSelect} />
        {selectedMessage && (
          <MessageEditor
            message={selectedMessage}
            onUpdate={handleMessageUpdate}
            onCancel={() => setSelectedMessage(null)}
          />
        )}
      </div>
    </div>
  );
};

export default MessageManager;