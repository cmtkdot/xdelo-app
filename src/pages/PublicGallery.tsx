import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { MediaEditDialog } from "@/components/MediaEditDialog";

const PublicGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);

  const { data: messages } = useQuery({
    queryKey: ['public-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
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

  const handleEdit = (media: MediaItem) => {
    setEditItem(media);
  };

  const handleDelete = () => {
    // Implement delete functionality
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Public Gallery</h1>
      
      {messages && (
        <ProductGrid
          products={Object.values(messages)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onView={() => {}}
        />
      )}

      {editItem && (
        <MediaEditDialog
          editItem={editItem}
          onClose={() => setEditItem(null)}
          onSave={async () => {
            // Implement save functionality
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
};

export default PublicGallery;
