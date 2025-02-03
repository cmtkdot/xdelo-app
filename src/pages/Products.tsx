import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { ProductMediaViewer } from "@/components/ProductMediaViewer";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/hooks/use-toast";

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

  // Query for products with real-time updates
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

  // Set up real-time subscription for updates
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
        (payload) => {
          console.log('Real-time update:', payload);
          queryClient.invalidateQueries({ queryKey: ['products'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Mutation for retrying analysis
  const analyzeContentMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-content', {
        body: { message_id: messageId }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Analysis started",
        description: "The content analysis has been initiated."
      });
    },
    onError: (error) => {
      console.error('Error initiating analysis:', error);
      toast({
        title: "Error",
        description: "Failed to start content analysis. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mutation for retrying failed analyses
  const retryMutation = useMutation({
    mutationFn: async (messageId: string) => {
      // Reset the message state to trigger reanalysis
      const { error } = await supabase
        .from('messages')
        .update({
          processing_state: 'caption_ready',
          error_message: null,
          retry_count: 0
        })
        .eq('id', messageId);

      if (error) throw error;
      
      return analyzeContentMutation.mutateAsync(messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: "Analysis retry initiated",
        description: "The product analysis will be attempted again."
      });
    },
    onError: (error) => {
      console.error('Error retrying analysis:', error);
      toast({
        title: "Error",
        description: "Failed to retry analysis. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSave = async () => {
    if (!editItem) return;

    try {
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
                ...editItem.analyzed_content,
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