
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";
import { GlProductGrid } from "@/components/gl-products/gl-product-grid";
import { MediaEditDialog } from "@/components/media-edit/media-edit-dialog";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";

export const PublicGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: mediaGroups, isLoading } = useQuery<Message[][]>({
    queryKey: ['public-messages'],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('processing_state', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Ensure messages is an array and properly typed
      const typedMessages = (messages || []) as Message[];
      
      // Group messages by media_group_id
      const groupedMessages = typedMessages.reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        return groups;
      }, {});

      // Convert groups object to array of arrays
      return Object.values(groupedMessages);
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

  const handleView = (group: Message[]) => {
    // View logic implementation
    console.log('Viewing media group:', group);
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Public Gallery</h1>
      
      {mediaGroups && (
        <GlProductGrid
          products={mediaGroups}
          onViewProduct={handleView}
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
