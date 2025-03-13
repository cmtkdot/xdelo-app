
import React from 'react';
import { Message } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Info } from 'lucide-react';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MessageGridViewProps {
  messages: Message[][];
  onSelect: (message: Message) => void;
  onView: (group: Message[]) => void;
  selectedId?: string;
}

export const MessageGridView: React.FC<MessageGridViewProps> = ({
  messages,
  onSelect,
  onView,
  selectedId
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {messages.map((group) => {
        // Skip empty groups
        if (!group || group.length === 0) return null;
        
        // Get main message for display
        const mainMessage = group[0];
        if (!mainMessage) return null;
        
        // Determine if this is a video
        const isVideo = mainMessage.mime_type?.startsWith('video/') || 
                        (mainMessage.public_url && /\.(mp4|mov|webm|avi)$/i.test(mainMessage.public_url));
        
        // Get product name or use caption as fallback
        const productName = mainMessage.analyzed_content?.product_name || mainMessage.caption || 'Untitled';
        
        // Get vendor info
        const vendor = mainMessage.analyzed_content?.vendor_uid;
        
        // Get media group info for badge
        const isGroup = group.length > 1;
        
        // Determine if this is the selected message
        const isSelected = selectedId === mainMessage.id;
        
        return (
          <Card 
            key={mainMessage.id} 
            className={cn(
              "overflow-hidden transition-all hover:shadow-md cursor-pointer", 
              isSelected && "ring-2 ring-primary"
            )}
            onClick={() => onSelect(mainMessage)}
          >
            <CardContent className="p-0 relative">
              <AspectRatio ratio={1 / 1}>
                {isVideo ? (
                  <video 
                    src={mainMessage.public_url} 
                    className="w-full h-full object-cover" 
                    preload="metadata"
                    onError={(e) => {
                      console.error("Video failed to load:", mainMessage.public_url);
                      (e.target as HTMLVideoElement).classList.add('bg-muted');
                    }}
                  />
                ) : (
                  <img
                    src={mainMessage.public_url}
                    alt={productName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                      target.classList.add('bg-muted');
                    }}
                  />
                )}
                
                {/* Top-right badges */}
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                  <Badge variant={isGroup ? "default" : "outline"}>
                    {isGroup ? `${group.length} items` : "Single"}
                  </Badge>
                  
                  <Badge variant={
                    mainMessage.processing_state === 'completed' ? 'default' :
                    mainMessage.processing_state === 'error' ? 'destructive' :
                    mainMessage.processing_state === 'processing' ? 'secondary' :
                    'outline'
                  }>
                    {mainMessage.processing_state}
                  </Badge>
                </div>
                
                {/* Overlay gradient for text readability */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"></div>
                
                {/* Caption overlay */}
                {mainMessage.caption && (
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="text-sm font-medium line-clamp-2">{mainMessage.caption}</p>
                  </div>
                )}
              </AspectRatio>
            </CardContent>
            
            <CardFooter className="p-3 bg-card flex justify-between items-center">
              <div className="overflow-hidden">
                <h3 className="text-sm font-medium truncate">{productName}</h3>
                {vendor && (
                  <p className="text-xs text-muted-foreground truncate">
                    Vendor: {vendor}
                  </p>
                )}
              </div>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(group);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>View media</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};
