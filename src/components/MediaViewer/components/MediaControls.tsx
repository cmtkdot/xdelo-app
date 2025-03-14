
import React from 'react';
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, X, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/generalUtils";

interface MediaControlsProps {
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onShowTools: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  publicUrl?: string | null;
  telegramUrl?: string | null;
}

export function MediaControls({
  onClose,
  onPrevious,
  onNext,
  onShowTools,
  hasPrevious = false,
  hasNext = false,
  publicUrl,
  telegramUrl
}: MediaControlsProps) {
  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onPrevious && hasPrevious) onPrevious();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNext && hasNext) onNext();
  };

  return (
    <>
      {/* Top navigation bar with product navigation */}
      <div className="px-3 py-2 border-b flex items-center justify-between bg-muted/10">
        <div className="flex items-center">
          {hasPrevious && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handlePrevious} 
              className="mr-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Previous Product</span>
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onShowTools}>
            <Settings className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Tools</span>
          </Button>
          
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Close</span>
          </Button>
        </div>
        
        <div className="flex items-center">
          {hasNext && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleNext}
              className="ml-1"
            >
              <span className="hidden sm:inline">Next Product</span>
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* External links */}
      <div className="py-2 px-3 bg-muted/10 border-t flex flex-wrap justify-center gap-2">
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="flex gap-1 items-center">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">View Original File</span>
              <span className="sm:hidden">File</span>
            </Button>
          </a>
        )}
        
        {telegramUrl && (
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="flex gap-1 items-center">
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Open in Telegram</span>
              <span className="sm:hidden">Telegram</span>
            </Button>
          </a>
        )}
      </div>
    </>
  );
}
