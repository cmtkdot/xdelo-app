
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Wrench, 
  RefreshCw, 
  Check, 
  ChevronDown,
  ChevronUp,
  FileSearch,
  RefreshCcw,
  Download,
  Link
} from 'lucide-react';
import { Message } from '@/types/entities/Message';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { getTelegramMessageUrl } from '@/lib/mediaUtils';

interface GalleryToolbarProps {
  currentMedia: Message;
  showTools: boolean;
  onToggleTools: () => void;
  messageIds: string[];
}

export function GalleryToolbar({ 
  currentMedia, 
  showTools, 
  onToggleTools,
  messageIds
}: GalleryToolbarProps) {
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const telegramUrl = currentMedia ? getTelegramMessageUrl(currentMedia) : null;
  
  const { 
    processingMessageIds,
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    repairMediaBatch
  } = useMediaUtils();
  
  // Check if any of the current messages are being processed
  const isProcessingAny = messageIds.some(id => processingMessageIds[id]);

  // Handle copy telegram URL
  const handleCopyTelegramUrl = async () => {
    if (telegramUrl) {
      try {
        await navigator.clipboard.writeText(telegramUrl);
        setIsUrlCopied(true);
        setTimeout(() => setIsUrlCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  // Generic function to process repair actions and show processing state
  const handleRepairAction = async (action: (id: string) => Promise<any>, id: string) => {
    if (processingMessageIds[id]) return;
    await action(id);
  };

  return (
    <div className="border-t p-2 bg-background">
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          {/* Media Tools Button */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onToggleTools}
            className="flex items-center gap-1"
          >
            <Wrench className="h-4 w-4" />
            <span>Tools</span>
            {showTools ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {/* Telegram Link Button */}
          {telegramUrl && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={handleCopyTelegramUrl}
            >
              {isUrlCopied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" />
                  <span>Telegram URL</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Media Tools Section */}
      {showTools && (
        <div className="pt-2 border-t mt-2">
          <div className="flex flex-wrap gap-2">
            {/* Fix Content Disposition */}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              disabled={isProcessingAny}
              onClick={() => handleRepairAction(fixContentDispositionForMessage, currentMedia.id)}
            >
              <FileSearch className="h-4 w-4" />
              <span>Fix Metadata</span>
              {processingMessageIds[currentMedia.id] && (
                <RefreshCw className="h-3 w-3 ml-1 animate-spin" />
              )}
            </Button>
            
            {/* Reupload from Telegram */}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              disabled={isProcessingAny}
              onClick={() => handleRepairAction(reuploadMediaFromTelegram, currentMedia.id)}
            >
              <RefreshCcw className="h-4 w-4" />
              <span>Reupload</span>
              {processingMessageIds[currentMedia.id] && (
                <RefreshCw className="h-3 w-3 ml-1 animate-spin" />
              )}
            </Button>
            
            {/* Group Repair - only show when multiple messages */}
            {messageIds.length > 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    disabled={isProcessingAny}
                  >
                    <Wrench className="h-4 w-4" />
                    <span>Group Repair</span>
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isProcessingAny}
                      onClick={() => repairMediaBatch(messageIds)}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      <span>Repair All Files</span>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {/* Direct Download Link */}
            {currentMedia?.public_url && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => window.open(currentMedia.public_url, '_blank')}
              >
                <Download className="h-4 w-4" />
                <span>Download</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
