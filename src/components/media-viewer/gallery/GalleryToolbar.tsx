
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
import { getTelegramMessageUrl } from '@/utils/mediaUtils';

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
      
      {/* Media Tools Section - Only shown when tools are toggled on */}
      {showTools && (
        <div className="mt-2 pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              disabled={isProcessingAny}
              onClick={() => currentMedia && handleRepairAction(fixContentDispositionForMessage, currentMedia.id)}
              className="flex items-center gap-1"
            >
              <FileSearch className="h-4 w-4" />
              <span>Fix Disposition</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              disabled={isProcessingAny}
              onClick={() => currentMedia && handleRepairAction(reuploadMediaFromTelegram, currentMedia.id)}
              className="flex items-center gap-1"
            >
              <RefreshCcw className="h-4 w-4" />
              <span>Reupload</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              disabled={isProcessingAny || messageIds.length === 0}
              onClick={() => repairMediaBatch(messageIds)}
              className="flex items-center gap-1 col-span-2"
            >
              <Wrench className="h-4 w-4" />
              <span>
                {isProcessingAny ? (
                  <>
                    <RefreshCw className="h-3 w-3 inline animate-spin mr-1" />
                    Repairing...
                  </>
                ) : (
                  `Repair All (${messageIds.length})`
                )}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
