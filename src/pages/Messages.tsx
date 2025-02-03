import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { ProductGroup } from "@/components/ProductGroup";
import { ProductMediaViewer } from "@/components/ProductMediaViewer";
import { useToast } from "@/components/ui/use-toast";
import { MediaEditDialog } from "@/components/MediaEditDialog";

const Messages = () => {
  const [mediaGroups, setMediaGroups] = useState<{ [key: string]: MediaItem[] }>({});
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<MediaItem[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Group messages by media_group_id or individual messages
        const groups: { [key: string]: MediaItem[] } = {};
        data.forEach((message) => {
          const groupKey = message.media_group_id || message.id;
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(message as MediaItem);
        });

        // Sort messages within each group to ensure original caption messages are first
        Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
            if (a.is_original_caption && !b.is_original_caption) return -1;
            if (!a.is_original_caption && b.is_original_caption) return 1;
            return 0;
          });
        });

        setMediaGroups(groups);
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Real-time update:", payload);
          fetchMessages(); // Refresh the messages when there's an update
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    // Find the message with original caption or use the provided media
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setSelectedMedia(mainMedia);
    setSelectedGroup(group);
    setViewerOpen(true);
  };

  const handleEdit = (media: MediaItem) => {
    // Find the message with original caption or use the provided media
    const groupKey = media.media_group_id || media.id;
    const group = mediaGroups[groupKey];
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setEditItem(mainMedia);
  };

  const handleItemChange = (field: string, value: any) => {
    if (editItem) {
      setEditItem({
        ...editItem,
        analyzed_content: {
          ...editItem.analyzed_content,
          [field]: value
        }
      });
    }
  };

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          analyzed_content: editItem.analyzed_content
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product details updated successfully.",
      });
      
      setEditItem(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update product details.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Messages</h2>
      </div>

      {Object.keys(mediaGroups).length === 0 ? (
        <Card className="p-6">
          <p className="text-gray-500">No messages yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.values(mediaGroups).map((group) => (
            <ProductGroup
              key={group[0].id}
              group={group}
              onMediaClick={handleMediaClick}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <ProductMediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedGroup}
      />

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
        onItemChange={handleItemChange}
        formatDate={formatDate}
      />
    </div>
  );
};

export default Messages;