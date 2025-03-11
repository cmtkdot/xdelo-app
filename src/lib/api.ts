
import { supabase } from "@/integrations/supabase/client";

/**
 * Redownload a file from its media group
 */
export async function xdelo_redownloadMediaFile(messageId: string, mediaGroupId?: string) {
  try {
    const { data, error } = await supabase.functions.invoke('redownload-from-media-group', {
      body: { 
        messageId,
        mediaGroupId
      }
    });
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error redownloading file:', error);
    return { 
      success: false, 
      error: error.message || "Failed to redownload file" 
    };
  }
}
