
import React from 'react';
import { Message } from '@/types';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Edit, Eye, FileX } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface MessageGridProps {
  mediaGroups: Message[][];
  isLoading?: boolean;
  onView: (group: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onToggleSelect?: (message: Message, selected: boolean) => void;
  selectedMessages?: Record<string, boolean>;
}

export const MessageGrid: React.FC<MessageGridProps> = ({
  mediaGroups,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
  selectedMessages = {}
}) => {
  // Handle selecting a group - we'll use the first message as the representative
  const handleToggleGroup = (group: Message[], selected: boolean) => {
    if (!onToggleSelect || group.length === 0) return;
    onToggleSelect(group[0], selected);
  };

  // Check if a group is selected
  const isGroupSelected = (group: Message[]) => {
    if (group.length === 0 || !selectedMessages) return false;
    return !!selectedMessages[group[0].id];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading media...</span>
      </div>
    );
  }

  if (mediaGroups.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-semibold mb-2">No media found</h3>
        <p className="text-muted-foreground">There are no media items to display.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {mediaGroups.map((group, index) => {
        // Skip empty groups
        if (group.length === 0) return null;
        
        // Get the main message from the group
        const mainMessage = group.find(msg => msg.caption) || group[0];
        
        return (
          <Card key={mainMessage.id || `group-${index}`} className="overflow-hidden">
            <div className="relative">
              {onToggleSelect && (
                <div className="absolute top-2 left-2 z-10">
                  <Checkbox 
                    checked={isGroupSelected(group)}
                    onCheckedChange={(checked) => handleToggleGroup(group, !!checked)}
                    className="bg-white/80 backdrop-blur-sm"
                  />
                </div>
              )}
              
              <AspectRatio ratio={1} className="bg-muted">
                {mainMessage.public_url ? (
                  <img 
                    src={mainMessage.public_url} 
                    alt={mainMessage.caption || "Media"} 
                    className="object-cover w-full h-full hover:opacity-90 transition-opacity cursor-pointer"
                    onClick={() => onView(group)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/placeholder.svg";
                    }}
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center cursor-pointer"
                    onClick={() => onView(group)}
                  >
                    <FileX className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </AspectRatio>
            </div>
            
            <CardContent className="p-3">
              <p className="text-sm font-medium line-clamp-2 h-10">
                {mainMessage.caption || "No caption"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {group.length > 1 ? `${group.length} items` : "1 item"}
              </p>
            </CardContent>
            
            <CardFooter className="p-3 pt-0 flex justify-between">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onView(group)}
              >
                <Eye className="h-3 w-3 mr-1" />
                View
              </Button>
              
              <div className="flex space-x-1">
                {onEdit && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEdit(mainMessage)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
                
                {onDelete && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDelete(mainMessage.id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
};
