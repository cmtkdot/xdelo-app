
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Message } from "@/types/Message";
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
      
      const typedMessages = (messages || []) as Message[];
      
      const groupedMessages = typedMessages.reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        return groups;
      }, {});

      return Object.values(groupedMessages);
    }
  });

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
          queryClient.invalidateQueries({ queryKey: ['public-messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const handleView = (group: Message[]) => {
    console.log('Viewing media group:', group);
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
