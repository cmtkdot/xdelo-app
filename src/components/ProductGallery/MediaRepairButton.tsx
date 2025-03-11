
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useToast } from '@/hooks/useToast';
import { Wrench, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function MediaRepairButton() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [progress, setProgress] = useState({ fixed: 0, total: 0 });
  const { validateStorageFile, repairFile } = useMediaUpload();
  const { toast } = useToast();

  const handleRepairMedia = async () => {
    setIsRepairing(true);
    setProgress({ fixed: 0, total: 0 });
    
    try {
      // Get messages with media
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, storage_path, mime_type, public_url')
        .is('deleted_from_telegram', false)
        .not('storage_path', 'is', null)
        .not('mime_type', 'is', null)
        .limit(100);
        
      if (error) throw error;
      
      if (!messages || messages.length === 0) {
        toast({
          title: "No media to repair",
          description: "No media files need content disposition repair."
        });
        return;
      }
      
      setProgress({ fixed: 0, total: messages.length });
      
      let fixedCount = 0;
      
      // Process each message sequentially
      for (const message of messages) {
        try {
          // Skip if file doesn't exist
          const exists = await validateStorageFile(message.storage_path);
          if (!exists) continue;
          
          // Repair file's content disposition
          const fixed = await repairFile(message.storage_path, message.mime_type);
          if (fixed) fixedCount++;
          
          setProgress({ fixed: fixedCount, total: messages.length });
        } catch (err) {
          console.error(`Error processing message ${message.id}:`, err);
        }
      }
      
      toast({
        title: "Media repair completed",
        description: `Fixed content disposition for ${fixedCount} out of ${messages.length} files.`
      });
    } catch (error) {
      console.error('Error in repair process:', error);
      toast({
        title: "Repair process error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleRepairMedia}
      disabled={isRepairing}
    >
      {isRepairing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Repairing ({progress.fixed}/{progress.total})
        </>
      ) : (
        <>
          <Wrench className="mr-2 h-4 w-4" />
          Repair Media Content Disposition
        </>
      )}
    </Button>
  );
}
