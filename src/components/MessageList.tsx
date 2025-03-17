
import React from 'react';
import { Message } from '@/types';
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onView: (message: Message[]) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onToggleSelect?: (message: Message, selected: boolean) => void;
  selectedMessages?: Record<string, boolean>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onToggleSelect,
  selectedMessages = {}
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading messages...</span>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-muted-foreground">There are no messages to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div 
          key={message.id} 
          className="border rounded-md p-4 bg-background shadow-sm hover:shadow transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium">{message.caption || "No caption"}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(message.created_at || Date.now()).toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onView([message])}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              
              {onEdit && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit(message)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onDelete(message.id)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
          
          {onToggleSelect && (
            <div className="mt-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedMessages[message.id] || false}
                  onChange={(e) => onToggleSelect(message, e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm">Select</span>
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
