
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { ProcessingState } from '@/types';

export function useMessageQueue() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Process a single message by ID
  const processMessageById = async (messageId: string) => {
    try {
      setIsProcessing(true);
      
      // First, set the message to pending state
      const { error: updateError } = await supabase.from('messages')
        .update({ 
          processing_state: 'pending' as ProcessingState,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) throw updateError;
      
      // Call the direct caption processor edge function
      const { data, error } = await supabase.functions.invoke(
        'direct-caption-processor',
        {
          body: { 
            messageId,
            trigger_source: 'manual',
            force_reprocess: true
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Message Processed",
        description: `Successfully processed message ${messageId.substring(0, 8)}.`
      });
      
      return data;
    } catch (error) {
      console.error('Error processing message:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process message",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to fix files with incorrect MIME types
  const xdelo_fixMediaMimeTypes = async (limit: number = 50) => {
    try {
      setIsProcessing(true);
      
      // Call the RPC function
      const { data, error } = await supabase.rpc('xdelo_fix_mime_types', {
        p_limit: limit,
        p_only_octet_stream: true
      });
      
      if (error) throw error;
      
      // Fix type handling for fixedCount
      const fixedArray = Array.isArray(data) ? data : [];
      const fixedCount = fixedArray.length || 0;
      
      toast({
        title: "MIME Type Repair",
        description: `Fixed ${fixedCount} files with incorrect MIME types.`
      });
      
      return { success: true, updated: fixedCount };
    } catch (error) {
      console.error('Error fixing MIME types:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to fix MIME types",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to repair storage paths
  const xdelo_repairStoragePaths = async (limit: number = 100) => {
    try {
      setIsProcessing(true);
      
      // Call the repair-storage-paths edge function
      const { data, error } = await supabase.functions.invoke(
        'repair-storage-paths',
        {
          body: { 
            limit,
            checkStorage: true
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "Storage Path Repair",
        description: `Repaired ${data.data.fixed} storage paths. ${data.data.needs_redownload} files need redownload.`
      });
      
      return data;
    } catch (error) {
      console.error('Error repairing storage paths:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair storage paths",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to fix invalid file IDs
  const xdelo_fixInvalidFileIds = async (limit: number = 10) => {
    try {
      setIsProcessing(true);
      
      // Call the fix-file-ids edge function
      const { data, error } = await supabase.functions.invoke(
        'fix-file-ids',
        {
          body: { 
            limit,
            errorCode: 'DOWNLOAD_FAILED' // Target specific error type
          }
        }
      );
      
      if (error) throw error;
      
      toast({
        title: "File ID Repair",
        description: `Fixed ${data.data?.succeeded || 0} of ${data.data?.processed || 0} files with invalid file_ids.`
      });
      
      return data;
    } catch (error) {
      console.error('Error fixing invalid file IDs:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to fix invalid file IDs",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processMessageById,
    xdelo_fixMediaMimeTypes,
    xdelo_repairStoragePaths,
    xdelo_fixInvalidFileIds,
    isProcessing
  };
}
