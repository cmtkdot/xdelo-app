
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message, ProcessingState } from '@/types';

export type RepairOption = 
  | 'fix_content_disposition' 
  | 'fix_mime_types'
  | 'repair_storage_paths'
  | 'recover_metadata'
  | 'repair_all';

export type RepairFilter = {
  processingState?: ProcessingState[];
  mimeType?: string[];
  hasMissingStoragePath?: boolean;
  limit?: number;
};

export type RepairStats = {
  successful: number;
  failed: number;
  contentDispositionFixed: number;
  mimeTypesFixed: number;
  storagePathsRepaired: number;
  metadataRecovered: number;
};

export function useMediaRepair() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Message[]>([]);
  const [results, setResults] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter messages based on criteria for repair
  const filterMessages = async (filter: RepairFilter): Promise<Message[]> => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('deleted_from_telegram', false);

      // Apply processing state filter
      if (filter.processingState && filter.processingState.length > 0) {
        // Cast the array to string[] for the database query
        const stateStrings = filter.processingState as unknown as string[];
        query = query.in('processing_state', stateStrings);
      }

      // Apply MIME type filter
      if (filter.mimeType && filter.mimeType.length > 0) {
        query = query.in('mime_type', filter.mimeType);
      }

      // Filter for missing storage paths
      if (filter.hasMissingStoragePath) {
        query = query.or('storage_path.is.null,storage_path.eq.');
      }

      // Add a limit
      if (filter.limit) {
        query = query.limit(filter.limit);
      } else {
        query = query.limit(100); // Default limit
      }
      
      // Order by created_at to get newest first
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      // Cast the database response to the Message type
      return (data || []) as Message[];
    } catch (error) {
      console.error('Error filtering messages:', error);
      toast({
        title: "Error",
        description: "Failed to filter messages. See console for details.",
        variant: "destructive"
      });
      return [];
    }
  };

  // Select messages for repair
  const selectMessages = (messages: Message[]) => {
    setSelectedMessages(messages);
  };

  // Clear selected messages
  const clearSelection = () => {
    setSelectedMessages([]);
  };

  // Cancel ongoing repair process
  const cancelRepair = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
      toast({
        title: "Cancelled",
        description: "Repair operation was cancelled",
      });
    }
  };

  // Repair selected messages with specified options
  const repairMessages = async (options: RepairOption, onlySelected: boolean = true): Promise<RepairStats> => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setResults(null);

      // Create a new AbortController for this operation
      abortControllerRef.current = new AbortController();

      if (onlySelected && (!selectedMessages || selectedMessages.length === 0)) {
        throw new Error("No messages selected for repair");
      }

      const messageIds = onlySelected 
        ? selectedMessages.map(msg => msg.id)
        : (await filterMessages({})).map(msg => msg.id);

      if (messageIds.length === 0) {
        throw new Error("No messages available to repair");
      }

      // Call the repair-media function
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: options,
          messageIds,
          options: {
            fixContentDisposition: options === 'fix_content_disposition' || options === 'repair_all',
            fixMimeTypes: options === 'fix_mime_types' || options === 'repair_all',
            repairStoragePaths: options === 'repair_storage_paths' || options === 'repair_all',
            recoverMetadata: options === 'recover_metadata' || options === 'repair_all',
          }
        }
      });

      if (error) throw error;

      setResults(data.results);

      toast({
        title: "Success",
        description: `Repaired ${data.results.successful} of ${messageIds.length} messages`,
      });

      return {
        successful: data.results.successful || 0,
        failed: data.results.failed || 0,
        contentDispositionFixed: data.results.contentDispositionFixed || 0,
        mimeTypesFixed: data.results.mimeTypesFixed || 0,
        storagePathsRepaired: data.results.storagePathsRepaired || 0,
        metadataRecovered: data.results.metadataRecovered || 0
      };
    } catch (error) {
      console.error('Error repairing messages:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to repair messages",
        variant: "destructive"
      });
      
      return {
        successful: 0,
        failed: 0,
        contentDispositionFixed: 0,
        mimeTypesFixed: 0,
        storagePathsRepaired: 0,
        metadataRecovered: 0
      };
    } finally {
      setIsProcessing(false);
      setProgress(100);
      abortControllerRef.current = null;
    }
  };

  // Validate messages to check their health status
  const validateMessages = async (messageIds?: string[]): Promise<any> => {
    try {
      setIsProcessing(true);
      
      const ids = messageIds || selectedMessages.map(msg => msg.id);
      
      if (!ids || ids.length === 0) {
        throw new Error("No messages selected for validation");
      }

      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: { 
          action: 'validate_messages',
          messageIds: ids
        }
      });

      if (error) throw error;

      toast({
        title: "Validation Complete",
        description: `Checked ${data.total} messages, found ${data.issues} issues`,
      });

      return data;
    } catch (error) {
      console.error('Error validating messages:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to validate messages",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    selectedMessages,
    results,
    progress,
    filterMessages,
    selectMessages,
    clearSelection,
    repairMessages,
    validateMessages,
    cancelRepair
  };
}
