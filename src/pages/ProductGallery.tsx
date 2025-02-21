
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('media-groups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['media-groups'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const handleEdit = (media: MediaItem) => {
    setEditItem(media);
  };

  const handleView = (media: MediaItem) => {
    // Implement view logic here
    console.log('Viewing media:', media);
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
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
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
      <h1 className="text-2xl font-bold">Product Gallery</h1>
      
      {messages && (
        <ProductGrid
          products={Object.values(messages)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={handleView}
        />
      )}

      {editItem && (
        <MediaEditDialog
          isOpen={!!editItem}
          onClose={() => setEditItem(null)}
          mediaItem={editItem}
        />
      )}
    </div>
  );
};

export default ProductGallery;
