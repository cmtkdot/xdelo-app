
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { GalleryFilters } from "@/components/PublicGallery/GalleryFilters";
import { GalleryCard } from "@/components/PublicGallery/GalleryCard";
import { EmptyState } from "@/components/PublicGallery/EmptyState";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all"); // all, images, videos
  const { id } = useParams();

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false)
        .order('created_at', { ascending: false });
      
      // If an ID is provided in the URL, filter for that specific ID
      if (id && id !== 'public') {
        query = query.eq('media_group_id', id);
      }
      
      const { data, error } = await query.limit(50);

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
  }, [id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

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
    <div className="container mx-auto px-2 md:px-4 py-4 md:py-8 max-w-7xl">
      <div className="mb-4 md:mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold mb-3 md:mb-4 text-center md:text-left">
          {id && id !== 'public' ? 'Media Group' : 'Public Gallery'}
        </h1>
        
        <GalleryFilters 
          filter={filter} 
          setFilter={setFilter} 
        />
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6">
            {filteredMessages.map(message => (
              <GalleryCard 
                key={message.id} 
                message={message} 
                onMediaClick={handleMediaClick} 
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
