import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

interface MessageListProps {
  onMessageSelect: (message: MediaItem) => void;
}

export const MessageList = ({ onMessageSelect }: MessageListProps) => {
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

  if (isLoading) return <div>Loading...</div>;

  return (
    <ScrollArea className="h-[600px] rounded-md border p-4">
      <div className="space-y-4">
        {messages?.map((message) => (
          <Card
            key={message.id}
            className="p-4 cursor-pointer hover:bg-gray-50"
            onClick={() => onMessageSelect(message)}
          >
            <div className="flex items-start gap-4">
              {message.public_url && (
                <img
                  src={message.public_url}
                  alt="Media thumbnail"
                  className="w-20 h-20 object-cover rounded"
                />
              )}
              <div>
                <h3 className="font-medium">
                  {message.analyzed_content?.product_name || 'Untitled'}
                </h3>
                <p className="text-sm text-gray-500">
                  {message.caption || 'No caption'}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(message.created_at || '').toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
};