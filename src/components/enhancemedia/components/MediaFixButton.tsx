
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileDown, Settings, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { useMediaOperations } from '@/hooks/useMediaOperations';
import { useToast } from '@/hooks/useToast';

interface MediaFixButtonProps {
  messageId: string;
  buttonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function MediaFixButton({
  messageId,
  buttonVariant = 'outline',
  buttonSize = 'sm',
  showLabel = false,
  className
}: MediaFixButtonProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'disposition' | 'reupload' | null>(null);
  const { fixContentDispositionForMessage, reuploadMediaFromTelegram, processingMessageIds } = useMediaOperations();
  const { toast } = useToast();
  
  const isProcessing = processingMessageIds[messageId];

  const handleFixContentDisposition = async () => {
    try {
      await fixContentDispositionForMessage(messageId);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error fixing content disposition:', error);
    }
  };

  const handleReuploadMedia = async () => {
    try {
      await reuploadMediaFromTelegram(messageId);
      setConfirmDialogOpen(false);
    } catch (error) {
      console.error('Error reuploading media:', error);
    }
  };

  const openConfirmDialog = (type: 'disposition' | 'reupload') => {
    setActionType(type);
    setConfirmDialogOpen(true);
  };

  const handleAction = () => {
    if (actionType === 'disposition') {
      handleFixContentDisposition();
    } else if (actionType === 'reupload') {
      handleReuploadMedia();
    }
  };

  const getDialogContent = () => {
    if (actionType === 'disposition') {
      return {
        title: 'Fix Content Disposition',
        description: 'This will update the file metadata to ensure proper browser handling. Continue?'
      };
    } else if (actionType === 'reupload') {
      return {
        title: 'Reupload Media from Telegram',
        description: 'This will redownload the file from Telegram and update the storage. This may take a moment. Continue?'
      };
    }
    return { title: '', description: '' };
  };

  const dialogContent = getDialogContent();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={buttonVariant} 
            size={buttonSize}
            className={className}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Settings className="h-4 w-4" />
            )}
            {showLabel && <span className="ml-2">Fix</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openConfirmDialog('disposition')}>
            <FileDown className="mr-2 h-4 w-4" />
            <span>Fix Content Disposition</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openConfirmDialog('reupload')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            <span>Reupload from Telegram</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogContent.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogContent.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
