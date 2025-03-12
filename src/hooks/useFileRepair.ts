
import { useState } from 'react';
import { useToast } from './useToast';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';

interface FileRepairOptions {
  messageIds?: string[];
  limit?: number;
  dryRun?: boolean;
}

interface StandardizeResponse {
  success: boolean;
  message: string;
  stats?: {
    fixed: number;
    skipped: number;
    needs_redownload: number;
    details: any[];
  };
  error?: string;
}

export function useFileRepair() {
  const { supabase } = useSupabase();
  const [isLoading, setIsLoading] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [results, setResults] = useState<StandardizeResponse | null>(null);
  const { toast } = useToast();

  const standardizeStoragePaths = async (options: FileRepairOptions = {}) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: {
          messageIds: options.messageIds || [],
          limit: options.limit || 100,
          dryRun: options.dryRun || false
        }
      });

      if (error) {
        throw error;
      }

      const response = data as StandardizeResponse;
      setResults(response);

      if (response.success) {
        toast({
          title: "Storage paths standardized",
          description: `${response.stats?.fixed || 0} file paths were updated successfully.`,
        });
      } else {
        toast({
          title: "Error standardizing paths",
          description: response.error || "An unknown error occurred",
          variant: "destructive",
        });
      }

      return response;
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Error standardizing paths",
        description: errorMessage,
        variant: "destructive",
      });
      
      return {
        success: false,
        message: "Error processing request",
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  const repairFiles = async (mode: 'all' | 'selected', messageIds?: string[]) => {
    setIsRepairing(true);
    try {
      const response = await standardizeStoragePaths({
        messageIds: mode === 'selected' ? messageIds : undefined,
        limit: mode === 'all' ? 1000 : undefined
      });
      return response;
    } finally {
      setIsRepairing(false);
    }
  };

  return {
    standardizeStoragePaths,
    repairFiles,
    isLoading,
    isRepairing,
    results
  };
}
