
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, RefreshCcw, FileEdit } from "lucide-react";
import { Message } from "@/types/MessagesTypes";
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

interface MediaFixToolsProps {
  message: Message;
  onEdit?: () => void;
}

export function MediaFixTools({ message, onEdit }: MediaFixToolsProps) {
  const { reuploadMediaFromTelegram, processingMessageIds } = useMediaUtils();
  const [isRepairing, setIsRepairing] = useState(false);
  const { toast } = useToast();
  const isLoading = processingMessageIds[message.id] || isRepairing;

  const handleReupload = async () => {
    await reuploadMediaFromTelegram(message.id);
  };

  const handleRequestRepair = async () => {
    if (!message.id) return;
    
    try {
      setIsRepairing(true);
      
      // Mark the message for redownload
      const { error } = await supabase
        .from('messages')
        .update({
          needs_redownload: true,
          redownload_reason: 'manually_requested',
          redownload_flagged_at: new Date().toISOString()
        })
        .eq('id', message.id);
        
      if (error) throw error;
      
      // Trigger the redownload process
      const { data, error: functionError } = await supabase.functions.invoke('redownload-missing-files', {
        body: { 
          messageIds: [message.id],
          limit: 1
        }
      });
      
      if (functionError) throw functionError;
      
      if (data?.successful > 0) {
        toast({
          title: 'File Repaired',
          description: 'The file has been successfully repaired.'
        });
      } else {
        toast({
          title: 'Repair Unsuccessful',
          description: 'The file could not be repaired automatically. Please try again later.',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Error requesting file repair:', err);
      toast({
        title: 'Error',
        description: 'Failed to repair file. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleDownload = () => {
    if (message.public_url) {
      window.open(message.public_url, '_blank');
    }
  };

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        title="Download file"
      >
        <FileDown className="h-4 w-4 mr-2" />
        Download
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleReupload}
        disabled={isLoading}
        title="Reupload file from Telegram"
      >
        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Reupload
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleRequestRepair}
        disabled={isLoading}
        title="Attempt to repair file from other sources"
      >
        {isRepairing ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Repairing...
          </>
        ) : (
          <>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Repair File
          </>
        )}
      </Button>
      
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          title="Edit caption"
        >
          <FileEdit className="h-4 w-4 mr-2" />
          Edit Caption
        </Button>
      )}
    </div>
  );
}
