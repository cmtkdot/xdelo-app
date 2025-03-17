
import { Message } from "@/types/MessagesTypes";
import { useState, useEffect } from 'react';
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
            <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
              <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
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
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="transform scale-90 group-hover:scale-100 transition-transform">
              <ImageIcon className="w-6 h-6 text-white" />
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

  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold mb-4 text-center md:text-left">Public Gallery</h1>
        
        <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            onClick={() => setFilter("all")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Grid3X3 className="mr-2 h-4 w-4" />
            All
          </Button>
          <Button 
            variant={filter === "images" ? "default" : "outline"} 
            onClick={() => setFilter("images")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </Button>
          <Button 
            variant={filter === "videos" ? "default" : "outline"} 
            onClick={() => setFilter("videos")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Film className="mr-2 h-4 w-4" />
            Videos
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredMessages.map(message => (
              <Card key={message.id} className="overflow-hidden hover:shadow-md transition-all duration-200 animate-fade-in">
                <div className="overflow-hidden">
                  <AspectRatio ratio={1}>
                    {renderMedia(message)}
                  </AspectRatio>
                </div>
                
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">
                    {message.analyzed_content?.product_name || message.caption || 'No title'}
                  </h3>
                  
                  <div className="space-y-2.5 text-sm">
                    {message.analyzed_content?.vendor_uid && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Tag className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{message.analyzed_content.vendor_uid}</span>
                      </div>
                    )}
                    
                    {message.analyzed_content?.product_code && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{message.analyzed_content.product_code}</span>
                      </div>
                    )}
                    
                    {message.analyzed_content?.purchase_date && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                        <span>{formatDate(message.analyzed_content.purchase_date)}</span>
                      </div>
                    )}
                    
                    {message.analyzed_content?.notes && (
                      <div className="flex gap-2 text-muted-foreground">
                        <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <ScrollArea className="h-[60px]">
                          <p className="pr-4">{message.analyzed_content.notes}</p>
                        </ScrollArea>
                      </div>
                    )}
                  </div>
                </CardContent>
                
                {message.analyzed_content?.quantity && (
                  <CardFooter className="pt-0">
                    <Badge variant="outline" className="font-medium">
                      Qty: {message.analyzed_content.quantity}
                    </Badge>
                  </CardFooter>
                )}
              </Card>
            ))}
          </div>

          {filteredMessages.length === 0 && (
            <div className="text-center py-12 bg-muted/20 rounded-lg">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No media found</p>
              <p className="text-muted-foreground text-sm mt-1">Try a different filter or check back later</p>
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
