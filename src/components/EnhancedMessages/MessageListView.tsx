
import React from 'react';
import { Message } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  Calendar, 
  Tag, 
  Image as ImageIcon, 
  FileVideo, 
  FileText, 
  Clock, 
  Edit 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MessageListViewProps {
  messages: Message[][];
  onSelect: (message: Message) => void;
  onView: (group: Message[]) => void;
  selectedId?: string;
}

export const MessageListView: React.FC<MessageListViewProps> = ({
  messages,
  onSelect,
  onView,
  selectedId
}) => {
  // Add defensive check to ensure messages is an array
  if (!messages || !Array.isArray(messages)) {
    console.error('MessageListView: messages is not an array', messages);
    return <div>No messages to display</div>;
  }

  return (
    <div className="space-y-3">
      {messages.map((group, groupIndex) => {
        // Skip empty groups
        if (!group || !Array.isArray(group) || group.length === 0) {
          console.warn(`Skipping empty or invalid group at index ${groupIndex}`, group);
          return null;
        }
        
        // Get main message for display
        const mainMessage = group[0];
        if (!mainMessage || !mainMessage.id) {
          console.warn(`No valid main message found in group at index ${groupIndex}`, group);
          return null;
        }
        
        // Determine message type icon
        let TypeIcon = FileText;
        if (mainMessage.mime_type?.startsWith('image/')) {
          TypeIcon = ImageIcon;
        } else if (mainMessage.mime_type?.startsWith('video/')) {
          TypeIcon = FileVideo;
        }
        
        // Get product name or use caption as fallback
        const productName = mainMessage.analyzed_content?.product_name || mainMessage.caption || 'Untitled';
        
        // Format dates safely
        let createdDate = 'Unknown';
        try {
          if (mainMessage.created_at) {
            createdDate = format(new Date(mainMessage.created_at), 'MMM d, yyyy h:mm a');
          }
        } catch (e) {
          console.warn('Error formatting created date:', e);
        }
        
        let purchaseDate = null;
        try {
          if (mainMessage.analyzed_content?.purchase_date) {
            purchaseDate = format(new Date(mainMessage.analyzed_content.purchase_date), 'MMM d, yyyy');
          }
        } catch (e) {
          console.warn('Error formatting purchase date:', e);
        }
        
        // Get edit count
        const hasEdits = mainMessage.edit_count && mainMessage.edit_count > 0;
        
        // Determine if this is the selected message
        const isSelected = selectedId === mainMessage.id;
        
        return (
          <Card 
            key={mainMessage.id} 
            className={cn(
              "overflow-hidden hover:bg-accent/5 cursor-pointer transition-colors", 
              isSelected && "ring-1 ring-primary bg-accent/10"
            )}
            onClick={() => onSelect(mainMessage)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Thumbnail preview */}
                <div className="flex-shrink-0 w-16 h-16 rounded-md border overflow-hidden bg-muted">
                  {mainMessage.mime_type?.startsWith('video/') ? (
                    <video
                      src={mainMessage.public_url || ''}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      onError={(e) => {
                        console.error("Video failed to load:", mainMessage.public_url);
                        const target = e.target as HTMLVideoElement;
                        target.classList.add('bg-muted');
                      }}
                    />
                  ) : (
                    <img
                      src={mainMessage.public_url || '/placeholder.svg'}
                      alt={productName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder.svg';
                      }}
                    />
                  )}
                </div>
                
                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium truncate flex items-center gap-1">
                        <TypeIcon className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
                        {productName}
                        {hasEdits && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Edit className="h-3 w-3 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edited {mainMessage.edit_count} time{mainMessage.edit_count !== 1 ? 's' : ''}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {createdDate}
                        </span>
                        
                        {mainMessage.analyzed_content?.vendor_uid && (
                          <span className="flex items-center">
                            <Tag className="h-3 w-3 mr-1" />
                            {mainMessage.analyzed_content.vendor_uid}
                          </span>
                        )}
                        
                        {purchaseDate && (
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {purchaseDate}
                          </span>
                        )}
                      </div>
                      
                      {mainMessage.caption && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {mainMessage.caption}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex-shrink-0 flex items-start gap-2 ml-2">
                      <Badge variant={
                        mainMessage.processing_state === 'completed' ? 'default' :
                        mainMessage.processing_state === 'error' ? 'destructive' :
                        mainMessage.processing_state === 'processing' ? 'secondary' :
                        'outline'
                      }>
                        {mainMessage.processing_state || 'unknown'}
                      </Badge>
                      
                      {group.length > 1 && (
                        <Badge variant="outline">
                          {group.length} items
                        </Badge>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(group);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
