
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { Card } from "@/components/ui/card";
import { MediaItem } from "@/types";

const MediaTable = () => {
  const { data: messages, isLoading } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .not('caption', 'is', null)
        .not('caption', 'eq', '')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MediaItem[];
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
