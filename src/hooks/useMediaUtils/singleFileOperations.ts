import { supabase } from '@/integrations/supabase/client';
import { withRetry } from './utils';

/**
 * Fix content disposition for a message
 */
export async function fixContentDisposition(messageId: string): Promise<boolean> {
  try {
    const { data, error } = await withRetry(
      () => supabase.functions.invoke('utility-functions', {
        body: { 
          action: 'fix_content_disposition',
          messageId 
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
      console.error('Error fixing content disposition:', error);
      return false;
    }
    
    if (data && typeof data === 'object') {
      const path = data.path || data.filePath;
      if (path) {
        console.log('Content disposition fixed for:', path);
        return true;
      }
    }
    
    return false;
  } catch (err) {
    console.error('Error in fixContentDisposition:', err);
    return false;
  }
}
