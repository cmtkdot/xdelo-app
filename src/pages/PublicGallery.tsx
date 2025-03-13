
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { MediaFixButton } from '@/components/ProductGallery/MediaFixButton';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Image, Loader2 } from "lucide-react";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const [isFixingImages, setIsFixingImages] = useState(false);
  const [filter, setFilter] = useState<string>("all"); // all, images, videos

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

  const handleQuickFixImages = async () => {
    setIsFixingImages(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
        body: { 
          limit: 100, 
          dryRun: false,
          onlyImages: true
        }
      });
      
      if (error) {
        throw error;
      }
      
      toast.success(`Successfully fixed ${data.results.fixed} image URLs`);
      
      // Refresh the gallery
      const { data: refreshedData } = await supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false)
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (refreshedData) {
        setMessages(refreshedData as unknown as Message[]);
      }
      
    } catch (error) {
      console.error('Error fixing images:', error);
      toast.error('Failed to fix images: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsFixingImages(false);
    }
  };

  const renderMedia = (message: Message) => {
    if (!message.public_url) {
      return (
        <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-md">
          <span className="text-xs text-gray-500">No URL</span>
        </div>
      );
    }

    if (message.mime_type?.startsWith('video/')) {
      return (
        <div className="relative w-32 h-32 cursor-pointer" onClick={() => handleMediaClick(message)}>
          <video src={message.public_url} className="w-full h-full object-cover rounded-md" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            </div>
          </div>
        </div>
      );
    }

    if (message.mime_type?.startsWith('image/')) {
      return (
        <div className="relative w-32 h-32">
          <img
            src={message.public_url}
            alt={message.caption || 'Media'}
            className="w-full h-full object-cover rounded-md cursor-pointer"
            onClick={() => handleMediaClick(message)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder.svg';
              target.classList.add('bg-gray-200');
            }}
          />
        </div>
      );
    }

    return (
      <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-md">
        <span className="text-xs text-gray-500">{message.mime_type || 'Unknown type'}</span>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Public Gallery</h1>
      
      <div className="flex flex-wrap gap-2 mb-4">
        <Button 
          variant={filter === "all" ? "default" : "outline"} 
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button 
          variant={filter === "images" ? "default" : "outline"} 
          onClick={() => setFilter("images")}
        >
          Images
        </Button>
        <Button 
          variant={filter === "videos" ? "default" : "outline"} 
          onClick={() => setFilter("videos")}
        >
          Videos
        </Button>
        
        <Button 
          variant="outline" 
          className="ml-auto flex items-center gap-2"
          onClick={handleQuickFixImages}
          disabled={isFixingImages}
        >
          {isFixingImages ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
          Fix Images
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredMessages.map(message => (
              <div key={message.id} className="border rounded-md p-2">
                {renderMedia(message)}
                <p className="text-sm mt-2 truncate">{message.caption || 'No caption'}</p>
                <p className="text-xs text-gray-500 truncate">{message.mime_type || 'Unknown type'}</p>
              </div>
            ))}
          </div>

          {filteredMessages.length === 0 && (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No media found</p>
            </div>
          )}

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
