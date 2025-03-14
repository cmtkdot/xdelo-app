
'use client'

import React from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, FileDown, Settings } from "lucide-react";
import { Message } from '@/types/MessagesTypes';
import { MediaFixButton } from '@/components/MediaViewer/MediaFixButton';
import { cn } from '@/lib/utils';
import { getTelegramMessageUrl } from '@/components/MediaViewer/utils/mediaHelpers';

interface MediaToolbarProps {
  currentMedia: Message;
  showTools: boolean;
  onToggleTools: () => void;
  messageIds: string[];
  className?: string;
}

export function MediaToolbar({ 
  currentMedia, 
  showTools, 
  onToggleTools, 
  messageIds, 
  className 
}: MediaToolbarProps) {
  if (!currentMedia) return null;
  
  const telegramUrl = getTelegramMessageUrl(currentMedia);
  const publicUrl = currentMedia.public_url;
  
  // Handle downloading the file
  const handleDownload = () => {
    if (publicUrl) {
      // Create an anchor and trigger download
      const a = document.createElement('a');
      a.href = publicUrl;
      a.download = publicUrl.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  
  return (
    <div className={cn("bg-muted/10 p-2 flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2">
        {publicUrl && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDownload}
            className="flex gap-1 items-center h-8"
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}
        
        {telegramUrl && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(telegramUrl, '_blank')}
            className="flex gap-1 items-center h-8"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Open in Telegram</span>
            <span className="sm:hidden">Telegram</span>
          </Button>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTools}
          className={cn(
            "flex gap-1 items-center h-8",
            showTools && "bg-primary/10"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Tools</span>
        </Button>
        
        {showTools && messageIds.length > 0 && (
          <MediaFixButton 
            messageIds={messageIds} 
            variant="outline" 
            size="sm" 
            onComplete={onToggleTools}
          />
        )}
      </div>
    </div>
  );
}
