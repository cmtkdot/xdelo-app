
import React from "react";
import { Message } from "@/types/MessagesTypes";
import { MediaRenderer } from "./MediaRenderer";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, Package, Tag, FileText } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/useMobile";

interface GalleryCardProps {
  message: Message;
  onMediaClick: (message: Message) => void;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({ 
  message,
  onMediaClick 
}) => {
  const isMobile = useIsMobile();
  
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
    <Card className="overflow-hidden hover:shadow-md transition-all duration-200 animate-fade-in border-muted/60">
      <div className="overflow-hidden">
        <AspectRatio ratio={1}>
          <MediaRenderer 
            message={message} 
            onClick={() => onMediaClick(message)} 
          />
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
  );
};
