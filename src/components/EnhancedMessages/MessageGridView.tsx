
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Edit, Trash2, FileX } from 'lucide-react';
import { Message } from '@/types';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

interface MessageGridViewProps {
  messages: Message[];
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  selectedId?: string;
}

export function MessageGridView({ 
  messages, 
  onSelect, 
  onView,
  onEdit,
  onDelete,
  selectedId
}: MessageGridViewProps) {
  const isMobile = useIsMobile();
  const [mediaErrors, setMediaErrors] = useState<Record<string, boolean>>({});
  
  const getProcessingStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300';
    }
  };

  // Handle media load error
  const handleMediaError = (messageId: string) => {
    console.log(`Media load error for message: ${messageId}`);
    setMediaErrors(prev => ({ ...prev, [messageId]: true }));
  };

  // Determine if a message is a video based on mime type or URL pattern
  const isVideoMessage = (message: Message) => {
    return message.mime_type?.startsWith('video/') || 
           (message.public_url && /\.(mp4|mov|webm|avi)$/i.test(message.public_url));
  };

  if (!messages || messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border rounded-md bg-card text-card-foreground">
        <FileX className="h-12 w-12 text-muted-foreground mb-2" />
        <h3 className="text-lg font-medium">No messages found</h3>
        <p className="text-muted-foreground text-center mt-1">
          Try adjusting your filters or refresh the data
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "grid gap-3",
      isMobile
        ? "grid-cols-2"
        : "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    )}>
      {messages.map((message) => (
        <Card 
          key={message.id} 
          className={cn(
            "overflow-hidden transition-all hover:shadow-md cursor-pointer group",
            selectedId === message.id && "ring-2 ring-primary"
          )}
          onClick={() => onSelect(message)}
        >
          <div className="relative aspect-square overflow-hidden bg-muted/20">
            {message.public_url && !mediaErrors[message.id] ? (
              isVideoMessage(message) ? (
                // Video thumbnail with poster or first frame
                <div className="w-full h-full relative">
                  <video 
                    className="w-full h-full object-cover"
                    src={message.public_url}
                    preload="metadata"
                    poster="/placeholder.svg"
                    onError={() => handleMediaError(message.id)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Badge className="bg-black/70 text-white">Video</Badge>
                  </div>
                </div>
              ) : (
                // Image
                <img 
                  src={message.public_url} 
                  alt={message.caption || 'Media'} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => handleMediaError(message.id)}
                />
              )
            ) : (
              // Error or no media fallback
              <div className="flex flex-col items-center justify-center h-full bg-muted/30">
                <FileX className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-muted-foreground text-xs text-center px-2">
                  {mediaErrors[message.id] ? 'Media failed to load' : 'No media available'}
                </span>
              </div>
            )}
            
            {/* Action overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onView([message]);
                }}
              >
                <Eye className="h-4 w-4" />
              </Button>
              
              {onEdit && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(message);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              
              {onDelete && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 bg-white/10 hover:bg-red-500/70 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(message);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {/* Processing state badge */}
            {message.processing_state && (
              <Badge 
                className={cn(
                  "absolute bottom-2 left-2 text-xs font-normal px-1.5 py-0.5",
                  getProcessingStateColor(message.processing_state)
                )}
              >
                {message.processing_state}
              </Badge>
            )}
          </div>
          
          <CardContent className={cn(
            "p-2", 
            isMobile ? "space-y-1" : "space-y-2"
          )}>
            <div className="line-clamp-2 text-xs font-medium">
              {message.caption || "No caption"}
            </div>
            
            <div className="flex flex-wrap gap-1 items-center text-[10px] text-muted-foreground">
              <span>
                {new Date(message.created_at).toLocaleDateString()}
              </span>
              {message.analyzed_content?.vendor_uid && (
                <Badge variant="outline" className="text-[9px] h-4 px-1">
                  {message.analyzed_content.vendor_uid}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
