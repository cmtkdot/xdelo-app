
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { GalleryCard } from "@/components/PublicGallery/GalleryCard";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { EmptyState } from "@/components/PublicGallery/EmptyState";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .is('deleted_from_telegram', false)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error("Error fetching messages:", error);
          toast.error("Error loading gallery");
        }

        if (data) {
          // Use type assertion to convert database response to Message[]
          setMessages(data as unknown as Message[]);
          setFilteredMessages(data as unknown as Message[]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, []);

  // Apply filters whenever messages or filter change
  useEffect(() => {
    if (filter === "all") {
      setFilteredMessages(messages);
    } else if (filter === "images") {
      setFilteredMessages(messages.filter(m => m.mime_type?.startsWith('image/')));
    } else if (filter === "videos") {
      setFilteredMessages(messages.filter(m => m.mime_type?.startsWith('video/')));
    }
  }, [messages, filter]);

  const handleMediaClick = (message: Message) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-3xl font-bold mb-4 text-center md:text-left">Public Gallery</h1>
        <GalleryFilters filter={filter} setFilter={setFilter} />
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {filteredMessages.map(message => (
              <GalleryCard 
                key={message.id} 
                message={message} 
                onClick={handleMediaClick} 
              />
            ))}
          </div>

          {filteredMessages.length === 0 && <EmptyState />}

          <MediaViewer 
            isOpen={isViewerOpen} 
            onClose={() => setIsViewerOpen(false)} 
            currentGroup={selectedMedia} 
          />
        </>
      )}
    </div>
  );
};

export default PublicGallery;
