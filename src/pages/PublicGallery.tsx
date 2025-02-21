import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";

const PublicGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Set up realtime subscription
  useEffect(() => {
    const subscription = supabase
      .from('messages')
      .on('*', (payload) => {
        // Invalidate and refetch messages
        queryClient.invalidateQueries(['public-messages']);
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, [queryClient]);

  const { data: messages } = useQuery({
    queryKey: ['public-messages'],
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
          analyzed_content,
          error_message,
          created_at,
          updated_at,
          message_url
        `)
        .eq('processing_state', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Group messages by media_group_id
      const groups = (data as MediaItem[]).reduce((acc, message) => {
        const key = message.media_group_id || message.id;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(message);
        return acc;
      }, {} as Record<string, MediaItem[]>);

      return groups;
    }
  });

  const handleEdit = async (media: MediaItem) => {
    setEditItem(media);
  };

  const handleDelete = async (media: MediaItem) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', media.id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media has been successfully deleted.",
      });

      // Refetch messages
      queryClient.invalidateQueries(['public-messages']);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete media. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Public Gallery</h1>
      
      {messages && (
        <ProductGrid
          products={Object.values(messages)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {editItem && (
        <MediaEditDialog
          media={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
};

export default PublicGallery;
