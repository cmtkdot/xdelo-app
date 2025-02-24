import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { MediaEditDialog } from "@/components/MediaEditDialog/MediaEditDialog";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";

const PublicGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: mediaGroups } = useQuery({
    queryKey: ['public-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('processing_state', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Group messages by media_group_id
      const groupedMessages = (data as Message[]).reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        return groups;
      }, {});

      return groupedMessages;
    }
  });

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('public-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['public-messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const handleEdit = (media: Message) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to edit media.",
        variant: "destructive",
      });
      return;
    }
    setEditItem(media);
  };

  const handleView = () => {
    // View logic implementation
    console.log('Viewing media');
  };

  const handleDelete = async (media: Message) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to delete media.",
        variant: "destructive",
      });
      return;
    }

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
      queryClient.invalidateQueries({ queryKey: ['public-messages'] });
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
      
      {mediaGroups && (
        <ProductGrid
          products={Object.values(mediaGroups)}
          onEdit={user ? handleEdit : undefined}
          onDelete={user ? handleDelete : undefined}
          onView={handleView}
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
