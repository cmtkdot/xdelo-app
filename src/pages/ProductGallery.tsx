
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Message } from "@/types/Message";
import { MediaEditDialog } from "@/components/media-edit/media-edit-dialog";
import { useToast } from "@/hooks/useToast";
import { GlProductGrid } from "@/components/gl-products/gl-product-grid";
import { useMediaGroups } from "@/hooks/useMediaGroups";

export const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mediaGroups = [] } = useMediaGroups();

  const handleEdit = (media: Message) => {
    setEditItem(media);
  };

  const handleView = (group: Message[]) => {
    console.log('Viewing media group:', group);
  };

  const handleDelete = async (media: Message) => {
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

      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete media. Please try again.",
        variant: "destructive",
      });
    }
  };

  const products = Array.isArray(mediaGroups) ? mediaGroups : [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Gallery</h1>
      
      <GlProductGrid
        products={products}
        onViewProduct={handleView}
      />

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

export default ProductGallery;
