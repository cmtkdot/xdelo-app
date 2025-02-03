import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { MessageEditor } from "@/components/MessageManager/MessageEditor";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Edit, Trash } from "lucide-react";

const MessageManager = () => {
  const [selectedMessage, setSelectedMessage] = useState<MediaItem | null>(null);
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

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Message Manager</h1>
      <div className="rounded-md border">
        <Table>
          <TableCaption>A list of all messages</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Product Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages?.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  {message.public_url && (
                    <img
                      src={message.public_url}
                      alt="Media thumbnail"
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                </TableCell>
                <TableCell>{message.analyzed_content?.product_name || 'Untitled'}</TableCell>
                <TableCell>{message.analyzed_content?.product_code || '-'}</TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeColor(message.processing_state || '')}>
                    {message.processing_state}
                  </Badge>
                </TableCell>
                <TableCell>
                  {message.created_at ? format(new Date(message.created_at), 'PPpp') : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedMessage(message)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(message.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedMessage && (
        <MessageEditor
          message={selectedMessage}
          onUpdate={handleMessageUpdate}
          onCancel={() => setSelectedMessage(null)}
        />
      )}
    </div>
  );
};

export default MessageManager;