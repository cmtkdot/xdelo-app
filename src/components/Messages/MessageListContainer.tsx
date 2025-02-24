
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Message } from "@/types";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

export function MessageListContainer() {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px] rounded-md border">
      {messages?.map((message) => (
        <Card key={message.id} className="p-4 m-2">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-start">
              <span className="font-medium">
                {message.caption || 'No caption'}
              </span>
              <span className="text-sm text-muted-foreground">
                {message.created_at ? format(new Date(message.created_at), 'PPP') : 'N/A'}
              </span>
            </div>
            {message.public_url && message.media_type === 'photo' && (
              <img 
                src={message.public_url} 
                alt={message.caption || 'Message image'} 
                className="rounded-md w-full h-48 object-cover"
              />
            )}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Type: {message.media_type || 'Unknown'}</span>
              <span>Status: {message.processing_state}</span>
            </div>
          </div>
        </Card>
      ))}
    </ScrollArea>
  );
}
