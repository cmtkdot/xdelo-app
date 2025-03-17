
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2, CalendarIcon, Package, Tag, FileText } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
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

  // Helper function to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
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
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredMessages.map(message => (
              <div key={message.id} className="border rounded-md p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-3">
                  {renderMedia(message)}
                </div>
                
                {/* Product Information */}
                <div className="space-y-2">
                  <h3 className="font-medium text-md truncate">
                    {message.analyzed_content?.product_name || message.caption || 'No title'}
                  </h3>
                  
                  {message.analyzed_content?.vendor_uid && (
                    <div className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {message.analyzed_content.vendor_uid}
                      </span>
                    </div>
                  )}
                  
                  {message.analyzed_content?.product_code && (
                    <div className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {message.analyzed_content.product_code}
                      </span>
                    </div>
                  )}
                  
                  {message.analyzed_content?.purchase_date && (
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {formatDate(message.analyzed_content.purchase_date)}
                      </span>
                    </div>
                  )}
                  
                  {message.analyzed_content?.notes && (
                    <div className="flex items-start gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-muted-foreground line-clamp-2">
                        {message.analyzed_content.notes}
                      </span>
                    </div>
                  )}
                  
                  {message.analyzed_content?.quantity && (
                    <Badge variant="outline" className="mt-1">
                      Qty: {message.analyzed_content.quantity}
                    </Badge>
                  )}
                </div>
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
