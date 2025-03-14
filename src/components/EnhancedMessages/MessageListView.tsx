
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Message } from '@/types';
import { useIsMobile } from '@/hooks/useMobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

interface MessageListViewProps {
  messages: Message[];
  onSelect: (message: Message) => void;
  onView: (messageGroup: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  selectedId?: string;
}

export function MessageListView({ 
  messages, 
  onSelect, 
  onView,
  onEdit,
  onDelete,
  selectedId
}: MessageListViewProps) {
  const isMobile = useIsMobile();
  
  const getProcessingStateColor = (state: string) => {
    switch (state) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300';
    }
  };

  return (
    <div className="border rounded-md divide-y overflow-hidden">
      {messages.map((message) => (
        <div 
          key={message.id} 
          className={cn(
            "flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors",
            selectedId === message.id && "bg-muted/70"
          )}
          onClick={() => onSelect(message)}
        >
          {/* Thumbnail */}
          <div 
            className="w-12 h-12 sm:w-16 sm:h-16 rounded overflow-hidden bg-muted/20 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onView([message]);
            }}
          >
            {message.public_url ? (
              <img 
                src={message.public_url} 
                alt={message.caption || 'Media'} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground text-xs">No image</span>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-grow min-w-0">
            <div className="line-clamp-2 text-sm">
              {message.caption || "No caption"}
            </div>
            
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="truncate">
                {new Date(message.created_at).toLocaleDateString()}
              </span>
              
              {message.processing_state && (
                <Badge 
                  className={cn(
                    "text-[10px] px-1 py-0 h-4",
                    getProcessingStateColor(message.processing_state)
                  )}
                >
                  {message.processing_state}
                </Badge>
              )}
              
              {message.analyzed_content?.vendor_uid && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  {message.analyzed_content.vendor_uid}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Actions */}
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView([message])}>
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(message)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(message)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
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
                  className="h-8 w-8"
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
                  className="h-8 w-8 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(message);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
