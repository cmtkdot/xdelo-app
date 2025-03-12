
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message } from '@/types';

interface FixContentDispositionResult {
  success: boolean;
  message: string;
  data?: {
    messageId: string;
    contentDisposition: 'inline' | 'attachment';
    mimeType: string;
    publicUrl: string;
  };
}

export function useMediaFix() {
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const fixContentDisposition = async (messageId: string) => {
    try {
      setIsFixing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageId }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.success) {
        toast({
          title: 'Fixed content disposition',
          description: data.message
        });
      } else {
        toast({
          title: 'Failed to fix content disposition',
          description: data.message,
          variant: 'destructive'
        });
      }
      
      return data as FixContentDispositionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: 'Error fixing content disposition',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsFixing(false);
    }
  };

  const batchFixContentDisposition = async (messageIds: string[]) => {
    try {
      setIsFixing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageIds }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      
      toast({
        title: 'Batch fix completed',
        description: `Successfully fixed ${successCount}/${messageIds.length} messages`
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: 'Error with batch fix',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsFixing(false);
    }
  };

  const runAutoFix = async (limit = 50) => {
    try {
      setIsFixing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { limit }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const totalCount = data.count || 0;
      
      toast({
        title: 'Auto-fix completed',
        description: `Successfully fixed ${successCount}/${totalCount} messages`
      });
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: 'Error with auto fix',
        description: errorMessage,
        variant: 'destructive'
      });
      
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setIsFixing(false);
    }
  };

  return {
    isFixing,
    results,
    fixContentDisposition,
    batchFixContentDisposition,
    runAutoFix
  };
}
