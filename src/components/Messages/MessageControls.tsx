
import React from 'react';
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { Message } from '@/types';

interface MessageControlsProps {
  message: Message;
  onRefresh: () => void;
  queue: {
    messages: Message[];
    isLoading: boolean;
    error: Error;
    refetch: () => Promise<void>;
    isRefetching: boolean;
    stats: any;
    handleRefresh: () => Promise<void>;
  };
}

export function MessageControls({ message, onRefresh, queue }: MessageControlsProps) {
  return (
    <div className="flex gap-2 mt-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRefresh}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  );
}
