import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { ProductMediaViewer } from "@/components/ProductMediaViewer";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/hooks/use-toast";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const getMediaCaption = (item: MediaItem): string => {
  const content = item.analyzed_content;
  if (!content) return '';

  let caption = content.product_name || '';
  if (content.product_code) {
    caption += ` #${content.product_code}`;
  }
  if (content.quantity) {
    caption += ` x${content.quantity}`;
  }
  if (content.notes) {
    caption += ` (${content.notes})`;
  }
  return caption;
};

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Create a map to store unique messages with proper typing
      const uniqueMessages = new Map<string, MediaItem>();
      
      (data as MediaItem[]).forEach(message => {
        const key = `${message.file_unique_id}-${message.media_group_id || 'single'}`;
        
        if (!uniqueMessages.has(key)) {
          // If message doesn't exist, add it
          uniqueMessages.set(key, message);
        } else {
          // If message exists, update only if it has newer content
          const existingMessage = uniqueMessages.get(key) as MediaItem;
          if (
            message.analyzed_content && 
            (!existingMessage.analyzed_content || 
             message.updated_at > existingMessage.updated_at)
          ) {
            uniqueMessages.set(key, message);
          }
        }
      });

      return Array.from(uniqueMessages.values());
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload: RealtimePostgresChangesPayload<MediaItem>) => {
          console.log('Real-time update:', payload);
          // Only invalidate query if the update contains new analyzed content
          if (payload.new && 
              ((payload.old && 'analyzed_content' in payload.new && 
                JSON.stringify(payload.new.analyzed_content) !== JSON.stringify(payload.old.analyzed_content)) ||
               payload.eventType === 'INSERT' ||
               payload.eventType === 'DELETE')) {
            queryClient.invalidateQueries({ queryKey: ['products'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleSave = async () => {
    if (!editItem?.analyzed_content) return;

    try {
      // Check if there are other messages in the same group
      if (editItem.media_group_id) {
        const { data: groupMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('media_group_id', editItem.media_group_id);

        // Update all messages in the group with the new content
        if (groupMessages && groupMessages.length > 0) {
          const { error } = await supabase
            .from('messages')
            .update({
              analyzed_content: {
                ...editItem.analyzed_content,
                caption: getMediaCaption(editItem)
              }
            })
            .eq('media_group_id', editItem.media_group_id);

          if (error) throw error;
        }
      } else {
        // Update single message
        const { error } = await supabase
          .from('messages')
          .update({
            analyzed_content: {
              ...editItem.analyzed_content,
              caption: getMediaCaption(editItem)
            }
          })
          .eq('id', editItem.id);

        if (error) throw error;
      }

      toast({
        title: "Changes saved",
        description: "The product details have been updated successfully."
      });

      await refetch();
      setEditItem(null);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes. Please try again.",
        variant: "destructive"
      });
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
        if (a.mime_type?.startsWith('image/') && !b.mime_type?.startsWith('image/')) return -1;
        if (!a.mime_type?.startsWith('image/') && b.mime_type?.startsWith('image/')) return 1;
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
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
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
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
            setEditItem({
              ...editItem,
              analyzed_content: {
                ...(editItem.analyzed_content || {}),
                [field]: value
              }
            });
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
