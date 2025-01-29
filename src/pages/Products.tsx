import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { ProductMediaViewer } from "@/components/ProductMediaViewer";
import { MediaEditDialog } from "@/components/MediaEditDialog";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data as MediaItem[];
    }
  });

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          message_media_data: {
            ...editItem.message_media_data,
            message: {
              ...editItem.message_media_data?.message,
              caption: getMediaCaption(editItem)
            }
          },
          product_name: editItem.product_name,
          product_code: editItem.product_code,
          quantity: editItem.quantity,
          vendor_uid: editItem.vendor_uid,
          purchase_date: editItem.purchase_date,
          notes: editItem.notes,
        })
        .eq('id', editItem.id);

      if (error) throw error;

      await refetch();
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const groupMediaByProduct = (media: MediaItem[]): MediaItem[][] => {
    if (!media?.length) return [];
    
    const groups = media.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const groupId = item.media_group_id || item.id;
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    }, {});

    return Object.values(groups).map(group => {
      return group.sort((a, b) => {
        if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
        if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  };

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    setSelectedMedia(media);
    setViewerOpen(true);
  };

  const handleEdit = (item: MediaItem) => {
    setEditItem(item);
  };

  const productGroups = groupMediaByProduct(products);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Media Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group) => (
          <ProductGroup
            key={group[0].id}
            group={group}
            onMediaClick={handleMediaClick}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <ProductMediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedMedia ? products.filter(item => 
          item.media_group_id === selectedMedia.media_group_id
        ) : []}
      />

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
        onItemChange={(field, value) => {
          if (editItem) {
            setEditItem({ ...editItem, [field]: value });
          }
        }}
        formatDate={(date) => {
          if (!date) return null;
          return new Date(date).toISOString().split('T')[0];
        }}
      />
    </div>
  );
};

export default Products;
