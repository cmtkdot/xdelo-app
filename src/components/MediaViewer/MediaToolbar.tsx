
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Wrench, 
  RefreshCw, 
  Check, 
  ChevronDown,
  ChevronUp,
  FileSearch,
  RefreshCcw,
  Link,
  Copy
} from 'lucide-react';
import { Message } from '@/types';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { getTelegramMessageUrl } from '@/utils/mediaUtils';
import { useToast } from '@/hooks/useToast';

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
  const [isUrlCopied, setIsUrlCopied] = useState(false);
  const telegramUrl = currentMedia ? getTelegramMessageUrl(currentMedia) : null;
  const { toast } = useToast();
  
  const { 
    processingMessageIds,
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    syncMessageCaption,
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

  // Handle syncing caption across the media group
  const handleSyncCaption = async () => {
    if (!currentMedia || !currentMedia.media_group_id) {
      toast({
        title: "Sync not possible",
        description: "Current message is not part of a media group",
        variant: "destructive"
      });
      return;
    }
    
    const result = await syncMessageCaption(currentMedia.id);
    
    if (result.success) {
      toast({
        title: "Caption synced",
        description: `Successfully synced caption to ${result.synced || 0} messages in the group`,
      });
    } else {
      toast({
        title: "Sync failed",
        description: result.message || "Failed to sync caption",
        variant: "destructive"
      });
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
            
            {currentMedia && currentMedia.media_group_id && (
              <Button 
                variant="outline" 
                size="sm"
                disabled={isProcessingAny}
                onClick={handleSyncCaption}
                className="flex items-center gap-1"
              >
                <Copy className="h-4 w-4" />
                <span>Sync Caption</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              size="sm"
              disabled={isProcessingAny || messageIds.length === 0}
              onClick={() => repairMediaBatch(messageIds)}
              className={`flex items-center gap-1 ${currentMedia && currentMedia.media_group_id ? 'col-span-1' : 'col-span-2'}`}
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
