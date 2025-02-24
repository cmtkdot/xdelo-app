
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";
import { MediaEditDialog } from "@/components/media-edit/media-edit-dialog";
import { useToast } from "@/hooks/useToast";
import { ProductGrid } from "@/components/product-gallery/product-grid";
import { useMediaGroups } from "@/hooks/useMediaGroups";

export const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mediaGroups = [] } = useMediaGroups();

  const handleEdit = (media: Message) => {
    setEditItem(media);
  };

  const handleView = () => {
    console.log('Viewing media');
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

  // Convert mediaGroups object to array of arrays
  const productsArray = Object.values(mediaGroups || {});

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Gallery</h1>
      
      <ProductGrid
        products={productsArray}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
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
