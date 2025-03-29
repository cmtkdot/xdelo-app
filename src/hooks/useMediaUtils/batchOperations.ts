import { supabase } from '@/integrations/supabase/client';
import { withRetry } from './utils';
import { RepairResult } from './types';

export async function repairMediaBatch(messageIds?: string[]): Promise<RepairResult> {
  try {
    // Call edge function to repair media
    const { data, error } = await withRetry(
      () => supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'repair_media_batch',
          messageIds
        }
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        retryableErrors: ['timeout', 'connection', 'network']
      }
    );
    
    if (error) {
      return {
        success: false,
        repaired: 0,
        error: error.message
      };
    }
    
    // Safely handle the data object
    const response = data as Record<string, any>;
    
    return {
      success: true,
      repaired: response?.repaired || 0,
      message: response?.message || 'Repair completed',
      successful: response?.successful || 0,
      failed: response?.failed || 0,
      details: response?.details || []
    };
  } catch (err) {
    console.error('Error in repairMediaBatch:', err);
    return {
      success: false,
      repaired: 0,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}
