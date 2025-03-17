
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MediaViewer } from '@/components/MediaViewer/MediaViewer';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Loader2, CalendarIcon, Package, Tag, FileText, ImageIcon, Film, Grid3X3 } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/useMobile";
import { useParams } from "react-router-dom";

const PublicGallery = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const [filter, setFilter] = useState<string>("all"); // all, images, videos
  const isMobile = useIsMobile();
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

  const renderMedia = (message: Message) => {
    if (!message.public_url) {
      return (
        <div className="w-full h-full bg-muted/20 flex items-center justify-center rounded-md">
          <span className="text-xs text-muted-foreground">No media</span>
        </div>
      );
    }

    if (message.mime_type?.startsWith('video/')) {
      return (
        <div className="relative w-full h-full cursor-pointer" onClick={() => handleMediaClick(message)}>
          <video src={message.public_url} className="w-full h-full object-cover rounded-md" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="w-8 h-8 md:w-12 md:h-12 rounded-full bg-white/80 flex items-center justify-center">
              <svg className="w-4 h-4 md:w-6 md:h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            </div>
          </div>
        </div>
      );
    }

    if (message.mime_type?.startsWith('image/')) {
      return (
        <div className="relative w-full h-full group">
          <img
            src={message.public_url}
            alt={message.caption || 'Media'}
            className="w-full h-full object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => handleMediaClick(message)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder.svg';
              target.classList.add('bg-muted');
            }}
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="transform scale-90 group-hover:scale-100 transition-transform">
              <ImageIcon className="w-4 h-4 md:w-6 md:h-6 text-white" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-muted/20 flex items-center justify-center rounded-md">
        <span className="text-xs text-muted-foreground">{message.mime_type || 'Unknown type'}</span>
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

  const renderFilterButtons = () => (
    <div className="flex flex-wrap justify-center md:justify-start gap-1.5 md:gap-2">
      <Button 
        variant={filter === "all" ? "default" : "outline"} 
        onClick={() => setFilter("all")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <Grid3X3 className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        All
      </Button>
      <Button 
        variant={filter === "images" ? "default" : "outline"} 
        onClick={() => setFilter("images")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <ImageIcon className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        Images
      </Button>
      <Button 
        variant={filter === "videos" ? "default" : "outline"} 
        onClick={() => setFilter("videos")}
        className="transition-all duration-200 ease-in-out h-8 px-2.5 text-xs md:h-9 md:px-4 md:text-sm"
        size="sm"
      >
        <Film className="mr-1.5 h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />
        Videos
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-2 md:px-4 py-4 md:py-8 max-w-7xl">
      <div className="mb-4 md:mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold mb-3 md:mb-4 text-center md:text-left">
          {id && id !== 'public' ? 'Media Group' : 'Public Gallery'}
        </h1>
        
        {renderFilterButtons()}
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 md:h-8 md:w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 lg:gap-6">
            {filteredMessages.map(message => (
              <Card key={message.id} className="overflow-hidden hover:shadow-md transition-all duration-200 animate-fade-in border-muted/60">
                <div className="overflow-hidden">
                  <AspectRatio ratio={1}>
                    {renderMedia(message)}
                  </AspectRatio>
                </div>
                
                <CardContent className="p-2 md:p-4 pt-2 md:pt-4">
                  <h3 className="font-semibold text-sm md:text-lg mb-1 md:mb-2 line-clamp-1">
                    {message.analyzed_content?.product_name || message.caption || 'No title'}
                  </h3>
                  
                  <div className="space-y-1.5 md:space-y-2.5 text-xs md:text-sm">
                    {message.analyzed_content?.vendor_uid && (
                      <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                        <Tag className="h-3 w-3 flex-shrink-0 md:h-4 md:w-4" />
                        <span className="truncate">{message.analyzed_content.vendor_uid}</span>
                      </div>
                    )}
                    
                    {message.analyzed_content?.product_code && (
                      <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                        <Package className="h-3 w-3 flex-shrink-0 md:h-4 md:w-4" />
                        <span className="truncate">{message.analyzed_content.product_code}</span>
                      </div>
                    )}
                    
                    {message.analyzed_content?.purchase_date && (
                      <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                        <CalendarIcon className="h-3 w-3 flex-shrink-0 md:h-4 md:w-4" />
                        <span>{formatDate(message.analyzed_content.purchase_date)}</span>
                      </div>
                    )}
                    
                    {isMobile ? (
                      // On mobile, only show notes if there's nothing else to show
                      (!message.analyzed_content?.vendor_uid && 
                       !message.analyzed_content?.product_code && 
                       !message.analyzed_content?.purchase_date && 
                       message.analyzed_content?.notes) && (
                        <div className="flex gap-1 md:gap-2 text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0 mt-0.5 md:h-4 md:w-4" />
                          <p className="line-clamp-1">{message.analyzed_content.notes}</p>
                        </div>
                      )
                    ) : (
                      // On desktop, always show notes if they exist
                      message.analyzed_content?.notes && (
                        <div className="flex gap-1 md:gap-2 text-muted-foreground">
                          <FileText className="h-3 w-3 flex-shrink-0 mt-0.5 md:h-4 md:w-4" />
                          <ScrollArea className="h-[60px]">
                            <p className="pr-4">{message.analyzed_content.notes}</p>
                          </ScrollArea>
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
                
                {message.analyzed_content?.quantity && (
                  <CardFooter className="pt-0 p-2 md:p-4">
                    <Badge variant="outline" className="text-xs md:text-sm">
                      Qty: {message.analyzed_content.quantity}
                    </Badge>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>

          {filteredMessages.length === 0 && (
            <div className="text-center py-8 md:py-12 bg-muted/20 rounded-lg">
              <ImageIcon className="h-8 w-8 md:h-12 md:w-12 text-muted-foreground mx-auto mb-3 md:mb-4" />
              <p className="text-muted-foreground text-base md:text-lg">No media found</p>
              <p className="text-muted-foreground text-xs md:text-sm mt-1">Try a different filter or check back later</p>
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
