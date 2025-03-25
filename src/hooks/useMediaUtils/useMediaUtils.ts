import { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useMediaQueries } from './useMediaQueries';
import { useMediaStorage } from './useMediaStorage';
import { MediaUtilsProvider, UseMediaUtilsType } from './types';
import { 
  processMessageCaption, 
  syncMediaGroup, 
  reprocessMessage
} from '@/lib/unifiedProcessor';
import { processDelayedMediaGroupSync } from '@/lib/mediaGroupSync';

export const useMediaUtils = (): UseMediaUtilsType => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Import sub-hooks for different operations
  const { getMessages, getMessageById, updateMessage } = useMediaQueries();
  const { uploadMedia, downloadMedia, deleteMedia } = useMediaStorage();
  
  // Process a message caption
  const processCaptionHandler = async (messageId: string, force: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await processMessageCaption(messageId, force);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process caption');
      }
      
      toast({
        title: 'Caption processed',
        description: 'Message caption was successfully analyzed'
      });
      
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sync media group content
  const syncMediaGroupHandler = async (sourceMessageId: string, mediaGroupId: string, force: boolean = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await syncMediaGroup(sourceMessageId, mediaGroupId, force);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync media group');
      }
      
      toast({
        title: 'Media group synced',
        description: `Content synchronized across ${result.data?.updated_count || 0} messages`
      });
      
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Schedule delayed media group sync 
  const scheduleDelayedSyncHandler = async (messageId: string, mediaGroupId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await processDelayedMediaGroupSync(mediaGroupId, messageId);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to schedule delayed sync');
      }
      
      toast({
        title: 'Sync scheduled',
        description: 'Media group sync has been scheduled'
      });
      
      return result.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    // Loading/error states
    isLoading,
    error,
    
    // Caption processing
    processCaption: processCaptionHandler,
    
    // Media group operations
    syncMediaGroup: syncMediaGroupHandler,
    scheduleDelayedSync: scheduleDelayedSyncHandler,
    
    // Other operations from sub-hooks
    ...useMediaQueries(),
    ...useMediaStorage()
  };
};
