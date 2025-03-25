
import { Message } from "@/types/MessagesTypes";
import { Card, CardContent } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { MediaRenderer } from "./MediaRenderer";
import { CompactContentDisplay } from "./CompactContentDisplay";

interface GalleryCardProps {
  message: Message;
  onClick: (message: Message) => void;
}

export const GalleryCard = ({ message, onClick }: GalleryCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all duration-200 animate-fade-in">
      <div className="overflow-hidden">
        <AspectRatio ratio={1}>
          <MediaRenderer message={message} onClick={onClick} />
        </AspectRatio>
      </div>
      
      <CardContent className="p-3">
        <h3 className="font-medium text-sm mb-2 line-clamp-1">
          {message.analyzed_content?.product_name || message.caption || 'No title'}
        </h3>
        
        <CompactContentDisplay content={message.analyzed_content} />
      </CardContent>
    </Card>
  );
};
