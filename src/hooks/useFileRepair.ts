
import { useState } from 'react';
import { useToast } from './useToast';
import { supabase } from '@/integrations/supabase/client';

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
  const [isLoading, setIsLoading] = useState(false);
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
        const fixedCount = response.stats?.fixed || 0;
        toast({
          title: "Storage paths standardized",
          description: `${fixedCount} file paths were updated successfully.`,
          variant: "success",
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
      
      setResults({
        success: false,
        message: "Error processing request",
        error: errorMessage
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

  return {
    standardizeStoragePaths,
    isLoading,
    results
  };
}
